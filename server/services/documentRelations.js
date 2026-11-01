const { readScope } = require('./recordAccess');
const { objectId } = require('./estateValidation');
const { optionLabel } = require('./relationSearch');
const types = () => ({
  Property: [require('../model/schema/property').Property, 'Properties'],
  Contact: [require('../model/schema/contact').Contact, 'Contacts'],
  Lead: [require('../model/schema/lead').Lead, 'Leads'],
  Opportunity: [require('../model/schema/opprtunity'), 'Opportunities'],
  PartnerCustomer: [require('../model/schema/partnerCustomer'), 'Partner Customers'],
});
const linkFields = { Property: 'linkProperty', Contact: 'linkContact', Lead: 'linkLead',
  Opportunity: 'linkOpportunity', PartnerCustomer: 'linkPartnerCustomer' };
// Legacy record upload forms encode an unselected relation as multipart "false".
const selectedLink = value => Boolean(value) && value !== 'false';
const fail = (code, status = 400) => { throw Object.assign(new Error(code), { code, status }); };
async function findRecord(req, type, id) {
  if (!types()[type] || !objectId(id)) fail('invalid');
  const [Model, moduleName] = types()[type];
  const record = await Model.findOne(readScope(req, req.actor, moduleName, { _id: id, deleted: false })).lean();
  if (!record) fail('relationNotFound', 404);
  return record;
}
async function relatedOptions(req, type, id, selectedRecord) {
  const record = selectedRecord || await findRecord(req, type, id);
  const result = { contacts: [], properties: [] };
  const option = item => ({ value: String(item._id), label: optionLabel(item) });
  if (type === 'Property' && record.propertyOwner) {
    const [Contact, moduleName] = types().Contact;
    result.contacts = (await Contact.find(readScope(req, req.actor, moduleName,
      { _id: record.propertyOwner, deleted: false })).lean()).map(option);
  }
  if (['Contact', 'Lead'].includes(type)) {
    const [Property, moduleName] = types().Property;
    const ids = type === 'Lead' ? [record.associatedListing].filter(Boolean)
      : [...(record.interestProperty || []), ...(record.relatedProperties || [])];
    const relation = type === 'Lead' ? { $or: [{ _id: { $in: ids } }, { relatedLeads: record._id }] }
      : { $or: [{ _id: { $in: ids } }, { propertyOwner: record._id }, { relatedContacts: record._id }] };
    result.properties = (await Property.find(readScope(req, req.actor, moduleName, { deleted: false, ...relation })).lean()).map(option);
  }
  return result;
}
async function documentRelations(req, primary) {
  if (!primary.entityId) {
    if (Object.values(linkFields).some(field => selectedLink(req.body[field]))) fail('invalid');
    return primary;
  }
  const record = await findRecord(req, primary.entityType, primary.entityId);
  const result = { ...primary, relatedRecords: [{ entityType: primary.entityType,
    entityId: record._id, label: optionLabel(record) }] };
  const options = await relatedOptions(req, primary.entityType, primary.entityId, record);
  for (const [type, field] of Object.entries(linkFields)) {
    const id = req.body[field];
    if (!selectedLink(id) || type === primary.entityType) continue;
    const allowed = type === 'Contact' ? options.contacts : type === 'Property' ? options.properties : [];
    const selected = allowed.find(option => option.value === String(id));
    if (!selected) fail('relationNotFound');
    result[field] = id;
    result.relatedRecords.push({ entityType: type, entityId: id, label: selected.label });
  }
  return result;
}
async function hydrateDocumentRelations(req, files) {
  const registry = types();
  const relations = file => {
    const entries = [...(file.relatedRecords || [])];
    if (file.entityType && file.entityId) entries.push({ entityType: file.entityType, entityId: file.entityId });
    for (const [entityType, field] of Object.entries(linkFields)) if (file[field]) entries.push({ entityType, entityId: file[field] });
    const seen = new Set();
    return entries.filter(record => {
      const key = record.entityType + ':' + record.entityId;
      if (!registry[record.entityType] || !objectId(String(record.entityId)) || seen.has(key)) return false;
      seen.add(key); return true;
    });
  };
  const names = new Map();
  await Promise.all(Object.entries(registry).map(async ([type, [Model, moduleName]]) => {
    const ids = [...new Set(files.flatMap(relations).filter(record => record.entityType === type && !record.label).map(record => String(record.entityId)))];
    if (!ids.length) return;
    const records = await Model.find(readScope(req, req.actor, moduleName, { _id: { $in: ids }, deleted: false }))
      .select('title name companyName fullName firstName lastName email leadName leadEmail opportunityName propertyAddress').lean();
    for (const record of records) names.set(type + ':' + record._id, optionLabel(record));
  }));
  return files.map(file => ({ ...file, relatedRecords: relations(file).map(record => ({ ...record,
    label: record.label || names.get(record.entityType + ':' + record.entityId) || '' })) }));
}
module.exports = { relatedOptions, documentRelations, hydrateDocumentRelations };
