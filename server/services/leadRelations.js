// Each lead record selects exactly one lead, contact or partner customer.
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
  if (relationNames.filter(name => values[name]).length !== 1) {
    throw Object.assign(new Error('leadSelectionRequired'), { code: 'leadSelectionRequired', field: 'leadRelations' });
  }
};

module.exports = { normalizeLeadRelations, isLeadRelationVisible, validateLeadSelection };
