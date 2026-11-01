// A lead is entered independently; legacy customer relations remain optional.
const relationNames = ['lead', 'contact', 'partnerCustomer'];
const normalizeLeadRelations = (body, previous = {}) => {
  const relations = Object.fromEntries(relationNames
    .map(name => [name, body[name] !== undefined ? body[name] : previous[name]?.toHexString?.() ?? previous[name] ?? null]));
  const explicit = relationNames.filter(name => body[name]);
  // Reject simultaneous selections instead of silently choosing between them.
  if (explicit.length > 1) return { ...body, ...relations };
  const selected = explicit[0] || relationNames.find(name => relations[name]);
  return { ...body, ...Object.fromEntries(relationNames.map(name => [name, name === selected ? relations[name] : null])) };
};

const isLeadRelationVisible = (field, values) => {
  if (field.kind === 'CUSTOM_FIELD') return true;
  const selected = relationNames.find(name => values[name]);
  return !relationNames.includes(field.name) || !selected || selected === field.name;
};

const validateLeadSelection = values => {
  if (relationNames.filter(name => values[name]).length > 1) {
    throw Object.assign(new Error('leadSelectionRequired'), { code: 'leadSelectionRequired', field: 'leadRelations' });
  }
};

const optionalLeadFields = definition => definition?.moduleName === 'Leads'
  ? { ...definition, fields: definition.fields.map(field => ({ ...field, required: false })) }
  : definition;

async function validateLeadProperty(req, body) {
  if (body.associatedListing === undefined) return;
  const { fail, objectId } = require('./estateValidation');
  if (body.associatedListing === '' || body.associatedListing === null) { body.associatedListing = null; return; }
  if (!objectId(body.associatedListing)) fail('associatedListing');
  const { Property } = require('../model/schema/property');
  const { readScope } = require('./recordAccess');
  if (!await Property.exists(readScope(req, req.actor, 'Properties', { _id: body.associatedListing, deleted: false }))) fail('associatedListing', 'relationNotFound');
}

module.exports = { optionalLeadFields, normalizeLeadRelations, isLeadRelationVisible, validateLeadSelection, validateLeadProperty };
