const { categories, ages, bedrooms, floors, fieldTypes } = require('./estateCatalog');
const { safeName } = require('./formDefinitions');
class InputError extends Error {
  constructor(code, field) { super(code); this.code = code; this.field = field; this.status = 400; }
}
const fail = (field, code = 'invalid') => { throw new InputError(code, field); };
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const set = (object, path, value) => { const keys = path.split('.'); const last = keys.pop(); let parent = object; for (const key of keys) parent = parent[key] ||= {}; parent[last] = value; };
const visible = (field, values) => field.enabled !== false && Object.entries(field.condition || {}).every(([key, expected]) => get(values, key) === expected);
const empty = value => value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);
const oneOf = (value, allowed, field, optional = false) => { if (!(optional && empty(value)) && !allowed.includes(value)) fail(field); };
const objectId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
function validateValue(field, value) {
  if (empty(value)) { if (field.required) fail(field.name, 'required'); return; }
  if (['number', 'currency'].includes(field.type)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || (field.min != null && value < field.min) || (field.max != null && value > field.max)) fail(field.name);
  } else if (field.type === 'checkbox') {
    if (typeof value !== 'boolean' || (field.required && !value)) fail(field.name);
  } else if (field.type === 'multiselect') {
    if (!Array.isArray(value) || value.some(v => !field.options?.some(o => o.value === v))) fail(field.name);
  } else if (field.type === 'file') {
    if (!Array.isArray(value) || value.some(v => !v || !objectId(v.id || v._id))) fail(field.name);
  } else {
    if (typeof value !== 'string' || value.length > 20000) fail(field.name);
    if (field.required && !value.trim()) fail(field.name, 'required');
    if (['select', 'radio'].includes(field.type) && !field.relation) oneOf(value, field.options?.map(o => o.value) || [], field.name);
    if (field.relation && !objectId(value)) fail(field.name);
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail(field.name);
    if (field.type === 'phone' && !/^[+\d\s().-]{3,30}$/.test(value)) fail(field.name);
    if (['date', 'datetime'].includes(field.type) && !Number.isFinite(Date.parse(value))) fail(field.name);
    if (field.type === 'url') { try { if (!['https:', 'http:'].includes(new URL(value).protocol)) fail(field.name); } catch { fail(field.name); } }
  }
}
function validateFields(definition, body, existing = {}) {
  const output = { customFields: { ...(existing.customFields || {}) } };
  const values = { ...existing, ...body };
  for (const field of definition.fields) {
    if (!safeName(field.name)) fail(field.name);
    const path = field.kind === 'CUSTOM_FIELD' ? `customFields.${field.name}` : field.name;
    let value = get(body, path);
    if (value === undefined) value = get(existing, path);
    if (value === undefined) value = field.defaultValue;
    if (!visible(field, values)) continue;
    validateValue(field, value);
    if (value !== undefined) set(output, path, value);
  }
  return output;
}
function normalizeProperty(input) {
  const p = structuredClone(input);
  oneOf(p.category, Object.keys(categories), 'category');
  oneOf(p.subtype, categories[p.category], 'subtype');
  oneOf(p.transactionType, ['SALE', 'RENT'], 'transactionType');
  if (typeof p.price?.amount !== 'number' || !Number.isFinite(p.price.amount) || p.price.amount < 0) fail('price.amount');
  oneOf(p.price?.currency, ['TRY', 'USD', 'EUR'], 'price.currency');
  if (typeof p.area?.value !== 'number' || !Number.isFinite(p.area.value) || p.area.value <= 0) fail('area.value');
  oneOf(p.area?.type, ['NET', 'GROSS'], 'area.type');
  p.area.unit = 'M2';
  oneOf(p.buildingAge, ages, 'buildingAge', true); oneOf(p.floor, floors, 'floor', true);
  oneOf(p.occupancyStatus, ['EMPTY', 'TENANTED', 'OWNER_OCCUPIED'], 'occupancyStatus', true);
  for (const key of ['buildingAge', 'floor', 'occupancyStatus', 'bedroom']) if (p[key] === '') p[key] = undefined;
  if (p.category === 'COMMERCIAL') p.bedroom = null; else oneOf(p.bedroom, bedrooms, 'bedroom', true);
  if (p.isInsideResidence !== true) { p.isInsideResidence = false; p.residence = null; }
  else if (!objectId(p.residence)) fail('residence', 'required');
  p.sale ||= { status: 'AVAILABLE' };
  oneOf(p.sale.status, ['AVAILABLE', 'SOLD'], 'sale.status');
  if (p.sale.status !== 'SOLD') p.sale = { status: 'AVAILABLE', buyerType: null, lead: null, partnerCustomer: null, soldAt: null };
  else {
    oneOf(p.sale.buyerType, ['LEAD', 'PARTNER_CUSTOMER'], 'sale.buyerType');
    const key = p.sale.buyerType === 'LEAD' ? 'lead' : 'partnerCustomer';
    if (!objectId(p.sale[key])) fail(`sale.${key}`, 'required');
    p.sale[key === 'lead' ? 'partnerCustomer' : 'lead'] = null;
    if (p.sale.soldAt && !Number.isFinite(Date.parse(p.sale.soldAt))) fail('sale.soldAt');
    p.sale.soldAt ||= new Date().toISOString();
  }
  return p;
}
function validateDefinition(input, current, baseline) {
  if (!Array.isArray(input.fields) || input.fields.length > 200) fail('fields');
  const names = new Set();
  const fields = input.fields.map((field, order) => {
    if (!safeName(field.name) || names.has(field.name)) fail('name'); names.add(field.name);
    oneOf(field.type, fieldTypes, 'type');
    const system = baseline.fields.find(f => f.name === field.name && f.kind === 'SYSTEM_FIELD');
    if (field.kind === 'SYSTEM_FIELD' && !system) fail(field.name);
    if (!system && (field.kind !== 'CUSTOM_FIELD' || field.name.includes('.'))) fail(field.name);
    for (const key of ['label', 'placeholder', 'helpText', 'validationMessage']) {
      if (key === 'label' || field[key]) for (const lang of ['en', 'fa', 'tr']) {
        if (typeof field[key]?.[lang] !== 'string' || (key === 'label' && !field[key][lang].trim())) fail(key, 'translationsRequired');
      }
    }
    const result = {
      ...field,
      order,
      relation: system?.relation,
      condition: system?.condition,
      external: Boolean(system?.external),
      locked: system?.locked || false,
    };
    if (system) {
      result.kind = 'SYSTEM_FIELD'; result.type = system.type;
      if (system.options) result.options = system.options.map(option => ({ ...option, label: field.options?.find(o => o.value === option.value)?.label || option.label }));
      if (system.locked) { result.enabled = true; result.required = system.required; }
      result.min = system.min; result.max = system.max;
    }
    const previous = current.fields.find(f => f.name === field.name);
    if (previous && previous.type !== result.type) fail(field.name, 'fieldTypeImmutable');
    if (['select', 'radio', 'multiselect'].includes(result.type) && !result.relation) {
      if (!result.options?.length || new Set(result.options.map(o => o.value)).size !== result.options.length) fail('options');
      for (const option of result.options) {
        if (typeof option.value !== 'string' || !option.value) fail('options');
        for (const lang of ['en', 'fa', 'tr']) if (!option.label?.[lang]?.trim()) fail('options', 'translationsRequired');
      }
    }
    if (!empty(result.defaultValue)) validateValue(result, result.defaultValue);
    return result;
  });
  for (const system of baseline.fields.filter(f => f.kind === 'SYSTEM_FIELD')) if (!names.has(system.name)) fail(system.name, 'systemFieldProtected');
  return fields;
}
module.exports = { InputError, fail, get, set, visible, empty, objectId, validateValue, validateFields, normalizeProperty, validateDefinition };
