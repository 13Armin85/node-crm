const Opportunity = require('../model/schema/opprtunity');
const { loadRecord, error } = require('./recordWorkspace');
const { can } = require('../middelwares/permissions');
const { syncOpportunity } = require('./relationshipSync');
async function convertContact(req) {
  if (!can(req.actor, 'Opportunities', 'create')) throw error('forbidden', 403);
  const { record: contact } = await loadRecord(req, 'Contacts', req.params.id);
  const definition = await require('./formDefinitions').getDefinition('Contacts');
  const { _duplicateKeys, __v, ...values } = contact;
  const snapshot = { contactId: String(contact._id), values, fields: definition?.fields || [] };
  const name = contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || 'Contact';
  const properties = [...new Set([...(contact.interestProperty || []), ...(contact.relatedProperties || [])].map(String))];
  const payload = { sourceContact: contact._id, contact: contact._id, opportunityName: name,
    accountName: contact.partnerCustomer, properties, assignUser: contact.assignUser || req.actor._id,
    type: 'New Business', salesStage: 'Prospecting',
    description: [contact.message, contact.notesandComments, contact.internalNotesOrComments].filter(Boolean).join('\n\n'),
    customFields: contact.customFields || {}, convertedContacts: [snapshot], convertedLeads: contact.convertedLeads || [],
    createBy: req.actor._id, modifiedBy: req.actor._id, deleted: false };
  let opportunity;
  try { opportunity = await Opportunity.findOneAndUpdate({ sourceContact: contact._id }, { $setOnInsert: payload }, { upsert: true, new: true, runValidators: true }); }
  catch (err) { if (err.code !== 11000) throw err; opportunity = await Opportunity.findOne({ sourceContact: contact._id }); }
  if (opportunity.deleted) throw error('notFound', 404);
  await syncOpportunity(opportunity);
  const Note = require('../model/schema/recordNote');
  for (const note of await Note.find({ module: 'Contacts', record: contact._id }).lean()) {
    const key = { module: 'Opportunities', record: opportunity._id, author: note.author, clientId: 'contact-transfer-' + note._id };
    await Note.updateOne(key, { $setOnInsert: { ...key, text: note.text, authorName: note.authorName, createdAt: note.createdAt, updatedAt: note.updatedAt } }, { upsert: true, timestamps: false });
  }
  return { opportunityId: opportunity._id, contactId: contact._id };
}
module.exports = { convertContact };
