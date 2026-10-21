const mongoose = require('mongoose');
const { Lead } = require('../model/schema/lead');
const { Contact } = require('../model/schema/contact');
const Opportunity = require('../model/schema/opprtunity');
const { scope, can } = require('../middelwares/permissions');
const { getDefinition } = require('./formDefinitions');
const { syncOpportunity, unlinkLead } = require('./relationshipSync');

const fail = (code, status = 400) => Object.assign(new Error(code), { code, status });
const usable = value => value !== undefined && value !== null && value !== '';
const contactValues = lead => ({
  fullName: lead.leadName,
  email: lead.leadEmail,
  phoneNumber: lead.leadPhoneNumber || lead.leadMobile,
  mobileNumber: lead.leadMobile,
  physicalAddress: lead.leadAddress,
  campaign: lead.leadCampaign,
  state: lead.leadState,
  message: lead.leadMessage || lead.leadNotes,
  communicationTool: lead.communicationTool,
  listedFor: lead.listedFor,
  partnerCustomer: lead.partnerCustomer,
});
const opportunityValues = (lead, contactId) => ({
  opportunityName: lead.leadName,
  contact: contactId,
  accountName: lead.partnerCustomer,
  properties: lead.associatedListing ? [lead.associatedListing] : [],
  assignUser: lead.assignUser,
  type: 'New Business',
  leadSource: lead.leadSource,
  salesStage: 'Prospecting',
  description: [lead.leadMessage, lead.leadNotes].filter(Boolean).join('\n\n'),
  nextStep: lead.leadNextAction,
  probability: lead.leadConversionRate,
});

// Every step is repeatable. Persist destination IDs before writing them, so a
// failed request can resume on standalone MongoDB without creating duplicates.
const transferHistory = async (leadId, contactId, snapshot) => {
  for (const name of ['email', 'phoneCall']) {
    const Model = require('../model/schema/' + name);
    await Model.updateMany({ createByLead: leadId }, { $set: { createByContact: contactId }, $unset: { createByLead: 1 } });
  }
  await require('../model/schema/task').updateMany({ assignToLead: leadId }, {
    $set: { assignTo: contactId, category: 'Contact' }, $unset: { assignToLead: 1 },
  });
  await require('../model/schema/meeting').updateMany({ attendesLead: leadId }, {
    $addToSet: { attendes: contactId }, $pull: { attendesLead: leadId },
  });
  await require('../model/schema/meeting').updateMany({ attendes: contactId, related: 'Lead', attendesLead: { $size: 0 } }, { $set: { related: 'Contact' } });
  await require('../model/schema/document').updateMany({ 'file.linkLead': leadId }, {
    $set: { 'file.$[linked].linkContact': contactId, 'file.$[linked].entityType': 'Contact', 'file.$[linked].entityId': contactId, 'file.$[linked].category': 'CONTACTS' },
    $unset: { 'file.$[linked].linkLead': 1 },
  }, { arrayFilters: [{ 'linked.linkLead': leadId }] });
  // Existing opportunities and quotes must keep their customer after conversion.
  const opportunities = await Opportunity.find({ lead: leadId, deleted: false });
  for (const opportunity of opportunities) {
    opportunity.convertedLeads = [...(opportunity.convertedLeads || []).filter(item => item.leadId !== snapshot.leadId), snapshot];
    opportunity.contact = contactId;
    opportunity.lead = null;
    await opportunity.save();
    await syncOpportunity(opportunity);
  }
  await require('../model/schema/quotes').updateMany({ lead: leadId }, { $set: { contact: contactId }, $unset: { lead: 1 } });
};

const convertLead = async (req) => {
  const mode = req.body?.mode;
  if (!['contact', 'contactAndOpportunity'].includes(mode)) throw fail('invalid');
  if (!can(req.actor, 'Leads', 'update') || !can(req.actor, 'Leads', 'delete')
    || !can(req.actor, 'Contacts', 'create')
    || (mode === 'contactAndOpportunity' && !can(req.actor, 'Opportunities', 'create'))) throw fail('forbidden', 403);
  const lock = new mongoose.Types.ObjectId().toString();
  const lead = await Lead.findOneAndUpdate({
    _id: req.params.id, deleted: false, ...scope(req, 'Leads'),
    $or: [{ 'conversion.lock': { $exists: false } }, { 'conversion.lockedAt': { $lt: new Date(Date.now() - 300000) } }],
  }, { $set: { 'conversion.lock': lock, 'conversion.lockedAt': new Date() } }, { new: true }).lean();
  if (!lead) throw fail('conversionBusy', 409);
  try {
    if (lead.conversion.mode && lead.conversion.mode !== mode) throw fail('conversionModeMismatch', 409);
    const contactId = lead.conversion.contactId || lead.contact || new mongoose.Types.ObjectId();
    const opportunityId = lead.conversion.opportunityId || (mode === 'contactAndOpportunity' ? new mongoose.Types.ObjectId() : null);
    await Lead.updateOne({ _id: lead._id, 'conversion.lock': lock }, { $set: {
      'conversion.mode': mode, 'conversion.contactId': contactId, 'conversion.opportunityId': opportunityId,
    } });
    const definition = await getDefinition('Leads');
    const { conversion, _duplicateKeys, __v, deleted, ...values } = lead;
    const snapshot = { leadId: String(lead._id), values, fields: (definition?.fields || []).map(({ name, label, kind }) => ({ name, label, kind })) };
    let contact = await Contact.findOne({ _id: contactId, deleted: false, ...scope(req, 'Contacts') });
    if (!contact && (lead.contact || await Contact.exists({ _id: contactId }))) throw fail('relationNotFound', 404);
    if (contact && !can(req.actor, 'Contacts', 'update')) throw fail('forbidden', 403);
    contact ||= new Contact({ _id: contactId, createBy: lead.assignUser || lead.createBy, createdDate: new Date() });
    // Copy shared schema fields as well as aliases; preserve an existing contact's
    // own values, and retain every original value in its source snapshot.
    const mapped = { ...values, ...contactValues(lead) };
    for (const [name, value] of Object.entries(mapped)) {
      if (['_id', 'createBy', 'createdDate', 'updatedDate', 'customFields', 'relatedLeads', 'relatedOpportunities', 'lead', 'contact'].includes(name)) continue;
      if (Contact.schema.path(name) && usable(value) && !usable(contact.get(name))) contact.set(name, value);
    }
    contact.convertedLeads = [...(contact.convertedLeads || []).filter(item => item.leadId !== snapshot.leadId), snapshot];
    if (lead.associatedListing) {
      contact.interestProperty.addToSet(lead.associatedListing);
      contact.relatedProperties.addToSet(lead.associatedListing);
    }
    for (const id of lead.relatedOpportunities || []) contact.relatedOpportunities.addToSet(id);
    await contact.save();
    let opportunity = null;
    if (opportunityId) {
      opportunity = await Opportunity.findOne({ _id: opportunityId, deleted: false, ...scope(req, 'Opportunities') });
      if (!opportunity) {
        if (await Opportunity.exists({ _id: opportunityId })) throw fail('relationNotFound', 404);
        opportunity = new Opportunity({ _id: opportunityId, ...opportunityValues(lead, contactId),
          createBy: lead.assignUser || lead.createBy, modifiedBy: req.actor._id, convertedLeads: [snapshot] });
        await opportunity.save();
      }
      await syncOpportunity(opportunity);
    }
    await transferHistory(lead._id, contactId, snapshot);
    await unlinkLead(lead._id);
    const done = await Lead.updateOne({ _id: lead._id, 'conversion.lock': lock }, {
      $set: { deleted: true, 'conversion.completedAt': new Date() }, $unset: { 'conversion.lock': 1, 'conversion.lockedAt': 1 },
    });
    if (!done.modifiedCount) throw fail('conversionBusy', 409);
    return { contactId, opportunityId };
  } finally {
    await Lead.updateOne({ _id: lead._id, 'conversion.lock': lock }, { $unset: { 'conversion.lock': 1, 'conversion.lockedAt': 1 } });
  }
};

module.exports = { convertLead, contactValues, opportunityValues };
