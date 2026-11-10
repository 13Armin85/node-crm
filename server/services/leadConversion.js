const mongoose = require('mongoose');
const { Lead } = require('../model/schema/lead');
const { Contact } = require('../model/schema/contact');
const Opportunity = require('../model/schema/opprtunity');
const { scope, can } = require('../middelwares/permissions');
const { getDefinition } = require('./formDefinitions');
const { syncOpportunity, unlinkLead } = require('./relationshipSync');

const fail = (code, status = 400) => Object.assign(new Error(code), { code, status });
const usable = value => value !== undefined && value !== null && value !== ''
  && (!Array.isArray(value) || value.length > 0);
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
  assignUser: lead.assignUser,
});
const opportunityValues = (lead, contactId) => ({
  opportunityName: lead.leadName,
  contact: contactId,
  accountName: lead.partnerCustomer,
  properties: lead.associatedListing ? [lead.associatedListing] : [],
  assignUser: lead.assignUser,
  type: 'New Business',
  listedFor: lead.listedFor,
  leadSource: lead.leadSource,
  salesStage: 'Prospecting',
  description: [lead.leadMessage, lead.leadNotes].filter(Boolean).join('\n\n'),
  nextStep: lead.leadNextAction,
  probability: lead.leadConversionRate,
  leadStage: lead.leadState || (typeof lead.leadStatus === 'string' ? lead.leadStatus : lead.leadStatus?.value),
});

// Every step is repeatable. Persist destination IDs before writing them, so a
// failed request can resume on standalone MongoDB without creating duplicates.
const transferHistory = async (leadId, contactId, snapshot, contactLabel, opportunityId) => {
  const destinationType = contactId ? 'Contact' : 'Opportunity';
  const destinationId = contactId || opportunityId;
  const historyLink = { ...(contactId ? { createByContact: contactId } : {}), ...(opportunityId ? { opportunity: opportunityId } : {}) };
  for (const name of ['email', 'phoneCall']) {
    const Model = require('../model/schema/' + name);
    await Model.updateMany({ createByLead: leadId }, { $set: historyLink, $unset: { createByLead: 1 } });
  }
  await require('../model/schema/task').updateMany({ assignToLead: leadId }, {
    $set: { ...(contactId ? { assignTo: contactId, category: 'Contact' } : { category: 'None' }), ...(opportunityId ? { opportunity: opportunityId } : {}) }, $unset: { assignToLead: 1, leadCallFor: 1 },
  });
  await require('../model/schema/meeting').updateMany({ attendesLead: leadId }, {
    ...(contactId ? { $addToSet: { attendes: contactId } } : {}),
    ...(opportunityId ? { $set: { opportunity: opportunityId } } : {}), $pull: { attendesLead: leadId },
  });
  await require('../model/schema/meeting').updateMany({ ...(contactId ? { attendes: contactId } : { opportunity: opportunityId }), related: 'Lead', attendesLead: { $size: 0 } }, { $set: { related: contactId ? 'Contact' : 'None' } });
  const Document = require('../model/schema/document');
  const sourceFile = { $or: [{ 'linked.linkLead': leadId }, { 'linked.entityType': 'Lead', 'linked.entityId': leadId }] };
  await Document.updateMany({ file: { $elemMatch: { $or: [{ linkLead: leadId }, { entityType: 'Lead', entityId: leadId }] } } }, {
    $set: { ...(contactId ? { 'file.$[linked].linkContact': contactId } : {}), ...(opportunityId ? { 'file.$[linked].linkOpportunity': opportunityId } : {}),
      'file.$[linked].entityType': destinationType, 'file.$[linked].entityId': destinationId, 'file.$[linked].category': contactId ? 'CONTACTS' : 'OPPORTUNITIES' },
    $unset: { 'file.$[linked].linkLead': 1 },
  }, { arrayFilters: [sourceFile] });
  if (contactId && opportunityId) await Document.updateMany({ 'file.relatedRecords': { $elemMatch: { entityType: 'Lead', entityId: leadId } } }, {
    $set: { 'file.$[linked].linkOpportunity': opportunityId },
    $addToSet: { 'file.$[linked].relatedRecords': { entityType: 'Opportunity', entityId: opportunityId, label: snapshot.values.leadName || '—' } },
  }, { arrayFilters: [{ 'linked.relatedRecords': { $elemMatch: { entityType: 'Lead', entityId: leadId } } }] });
  await Document.updateMany({ 'file.relatedRecords': { $elemMatch: { entityType: 'Lead', entityId: leadId } } }, {
    $set: { 'file.$[linked].relatedRecords.$[source].entityType': destinationType,
      'file.$[linked].relatedRecords.$[source].entityId': destinationId, 'file.$[linked].relatedRecords.$[source].label': contactLabel || '—' },
  }, { arrayFilters: [{ 'linked.relatedRecords': { $elemMatch: { entityType: 'Lead', entityId: leadId } } },
    { 'source.entityType': 'Lead', 'source.entityId': leadId }] });
  if (contactId && opportunityId) await Document.updateMany({ 'file.linkOpportunity': opportunityId, 'file.linkContact': contactId }, {
    $addToSet: { 'file.$[linked].relatedRecords': { entityType: 'Opportunity', entityId: opportunityId, label: snapshot.values.leadName || '—' } },
  }, { arrayFilters: [{ 'linked.linkOpportunity': opportunityId, 'linked.linkContact': contactId }] });
  // Existing opportunities and quotes must keep their customer after conversion.
  const opportunities = await Opportunity.find({ lead: leadId, deleted: false });
  for (const opportunity of opportunities) {
    opportunity.convertedLeads = [...(opportunity.convertedLeads || []).filter(item => item.leadId !== snapshot.leadId), snapshot];
    if (contactId) opportunity.contact = contactId;
    opportunity.lead = null;
    await opportunity.save();
    await syncOpportunity(opportunity);
  }
  const Quote = require('../model/schema/quotes');
  const quotes = await Quote.find({ lead: leadId }).select('_id').lean();
  await Quote.updateMany({ lead: leadId }, { $set: { ...(contactId ? { contact: contactId } : {}), ...(opportunityId ? { opportunity: opportunityId } : {}) }, $unset: { lead: 1 } });
  if (contactId && quotes.length) await Contact.updateOne({ _id: contactId }, { $addToSet: { quotes: { $each: quotes.map(quote => quote._id) } } });
};

const convertLead = async (req) => {
  const mode = req.body?.mode;
  if (!['contact', 'opportunity', 'contactAndOpportunity'].includes(mode)) throw fail('invalid');
  const createsContact = mode !== 'opportunity';
  if (!can(req.actor, 'Leads', 'update') || !can(req.actor, 'Leads', 'delete')
    || (createsContact && !can(req.actor, 'Contacts', 'create'))
    || (mode !== 'contact' && !can(req.actor, 'Opportunities', 'create'))) throw fail('forbidden', 403);
  const lock = new mongoose.Types.ObjectId().toString();
  const lead = await Lead.findOneAndUpdate({
    _id: req.params.id, deleted: false, ...scope(req, 'Leads'),
    $or: [{ 'conversion.lock': { $exists: false } }, { 'conversion.lockedAt': { $lt: new Date(Date.now() - 300000) } }],
  }, { $set: { 'conversion.lock': lock, 'conversion.lockedAt': new Date() } }, { new: true }).lean();
  if (!lead) throw fail('conversionBusy', 409);
  try {
    if (lead.conversion.mode && lead.conversion.mode !== mode) throw fail('conversionModeMismatch', 409);
    const contactId = lead.conversion.contactId || (createsContact ? lead.contact || new mongoose.Types.ObjectId() : null);
    const opportunityId = lead.conversion.opportunityId || (mode !== 'contact' ? new mongoose.Types.ObjectId() : null);
    await Lead.updateOne({ _id: lead._id, 'conversion.lock': lock }, { $set: {
      'conversion.mode': mode, 'conversion.contactId': contactId, 'conversion.opportunityId': opportunityId,
    } });
    const definition = await getDefinition('Leads');
    const { conversion, _duplicateKeys, __v, deleted, ...values } = lead;
    // Keep every value and the full field metadata, including choices and file
    // definitions, even when destination forms use different field names.
    const snapshot = { leadId: String(lead._id), values, fields: definition?.fields || [] };
    let contact = null;
    if (createsContact) {
    contact = await Contact.findOne({ _id: contactId, deleted: false, ...scope(req, 'Contacts') });
    if (!contact && (lead.contact || await Contact.exists({ _id: contactId }))) throw fail('relationNotFound', 404);
    if (contact && !can(req.actor, 'Contacts', 'update')) throw fail('forbidden', 403);
    contact ||= new Contact({ _id: contactId, createBy: lead.assignUser || lead.createBy,
      createdDate: new Date(), updatedDate: new Date(), deleted: false });
    // Copy shared schema fields as well as aliases; preserve an existing contact's
    // own values, and retain every original value in its source snapshot.
    const mapped = { ...values, ...contactValues(lead) };
    for (const [name, value] of Object.entries(mapped)) {
      if (['_id', 'createBy', 'createdDate', 'updatedDate', 'customFields', 'relatedLeads', 'relatedOpportunities', 'lead', 'contact'].includes(name)) continue;
      if (Contact.schema.path(name) && usable(value) && !usable(contact.get(name))) contact.set(name, value);
    }
    contact.customFields = { ...(lead.customFields || {}), ...(contact.customFields || {}) };
    contact.convertedLeads = [...(contact.convertedLeads || []).filter(item => item.leadId !== snapshot.leadId), snapshot];
    if (lead.associatedListing) {
      contact.interestProperty.addToSet(lead.associatedListing);
      contact.relatedProperties.addToSet(lead.associatedListing);
    }
    for (const id of lead.relatedOpportunities || []) contact.relatedOpportunities.addToSet(id);
    // Visibility is part of the transfer, even with legacy Mixed form metadata.
    contact.set('deleted', false);
    await contact.save();
    if (!await Contact.exists({ _id: contactId, deleted: false, 'convertedLeads.leadId': snapshot.leadId })) {
      throw fail('conversionIncomplete', 409);
    }
    }
    let opportunity = null;
    if (opportunityId) {
      opportunity = await Opportunity.findOne({ _id: opportunityId, deleted: false, ...scope(req, 'Opportunities') });
      if (!opportunity) {
        if (await Opportunity.exists({ _id: opportunityId })) throw fail('relationNotFound', 404);
        opportunity = new Opportunity({ _id: opportunityId, ...opportunityValues(lead, contactId),
          customFields: lead.customFields || {},
          createBy: lead.assignUser || lead.createBy, modifiedBy: req.actor._id, convertedLeads: [snapshot] });
        await opportunity.save();
      } else {
        opportunity.convertedLeads = [...(opportunity.convertedLeads || []).filter(item => item.leadId !== snapshot.leadId), snapshot];
        opportunity.customFields = { ...(lead.customFields || {}), ...(opportunity.customFields || {}) };
        await opportunity.save();
      }
      if (!await Opportunity.exists({ _id: opportunityId, deleted: false, 'convertedLeads.leadId': snapshot.leadId })) throw fail('conversionIncomplete', 409);
      await syncOpportunity(opportunity);
    }
    await transferHistory(lead._id, contactId, snapshot, contact?.fullName || lead.leadName, opportunityId);
    const incomplete = await Promise.all([
      require('../model/schema/email').exists({ createByLead: lead._id }),
      require('../model/schema/phoneCall').exists({ createByLead: lead._id }),
      require('../model/schema/task').exists({ assignToLead: lead._id }),
      require('../model/schema/meeting').exists({ attendesLead: lead._id }),
      require('../model/schema/quotes').exists({ lead: lead._id }),
      require('../model/schema/document').exists({ $or: [{ 'file.linkLead': lead._id },
        { file: { $elemMatch: { entityType: 'Lead', entityId: lead._id } } },
        { 'file.relatedRecords': { $elemMatch: { entityType: 'Lead', entityId: lead._id } } }] }),
    ]);
    if (incomplete.some(Boolean)) throw fail('conversionIncomplete', 409);
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
