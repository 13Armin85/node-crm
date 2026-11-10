const { categories, ages, floors, fieldTypes } = require('./estateCatalog');
const { safeName } = require('./formDefinitions');
const { normalizeRoomPlan, normalizeBedroom, isBedroomField, isRoomPlanField, roomPlanMatches } = require('./roomPlans');
class InputError extends Error {
  constructor(code, field) { super(code); this.name = 'InputError'; this.code = code; this.field = field; this.status = 400; }
}
const fail = (field, code = 'invalid') => { throw new InputError(code, field); };
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const set = (object, path, value) => { const keys = path.split('.'); const last = keys.pop(); let parent = object; for (const key of keys) parent = parent[key] ||= {}; parent[last] = value; };
const visible = (field, values) => field.enabled !== false && Object.entries(field.condition || {}).every(([key, expected]) => (Array.isArray(expected) ? expected.includes(get(values, key)) : get(values, key) === expected));
const empty = value => value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);
const oneOf = (value, allowed, field, optional = false) => { if (!(optional && empty(value)) && !allowed.includes(value)) fail(field); };
const objectId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
function validateValue(field, value) {
  if (empty(value)) { if (field.required) fail(field.name, 'required'); return; }
  if (isBedroomField(field)) {
    if (!['string', 'number'].includes(typeof value) || String(value).length > 20000) fail(field.name);
    return;
  }
  if (field.external && field.relation && field.type === 'text') {
    if (!Array.isArray(value) || value.some(id => !objectId(id))) fail(field.name);
  } else if (['number', 'currency'].includes(field.type)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || (field.min != null && value < field.min) || (field.max != null && value > field.max) || (field.integer && !Number.isInteger(value))) fail(field.name);
  } else if (field.type === 'checkbox') {
    if (typeof value !== 'boolean' || (field.required && !value)) fail(field.name);
  } else if (field.type === 'multiselect') {
    if (!Array.isArray(value) || value.some(v => !field.options?.some(o => isRoomPlanField(field) ? roomPlanMatches(o.value, v) : o.value === v))) fail(field.name);
  } else if (field.type === 'file') {
    if (!Array.isArray(value) || value.some(v => !v || !objectId(v.id || v._id))) fail(field.name);
  } else {
    if (typeof value !== 'string' || value.length > 20000) fail(field.name);
    if (field.required && !value.trim()) fail(field.name, 'required');
    if (['select', 'radio'].includes(field.type) && !field.relation && !(isRoomPlanField(field) && field.options?.some(option => roomPlanMatches(option.value, value)))) oneOf(value, field.options?.map(o => o.value) || [], field.name);
    if (field.relation && !objectId(value)) fail(field.name);
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail(field.name);
    if (field.type === 'phone' && !/^[+\d\s().-]{3,30}$/.test(value)) fail(field.name);
    if (['date', 'datetime'].includes(field.type) && !Number.isFinite(Date.parse(value))) fail(field.name);
    if (field.type === 'url') { try { if (!['https:', 'http:'].includes(new URL(value).protocol)) fail(field.name); } catch { fail(field.name); } }
  }
}
function validateRequiredFields(definition, body, existing = {}) {
  const values = { ...existing, ...body };
  for (const field of definition.fields) {
    if (!field.required || !visible(field, values)) continue;
    const path = field.kind === 'CUSTOM_FIELD' ? `customFields.${field.name}` : field.name;
    const value = get(body, path) !== undefined ? get(body, path) : get(existing, path) ?? field.defaultValue;
    if (empty(value) || (typeof value === 'string' && !value.trim()) || (field.type === 'checkbox' && value !== true)) fail(path, 'required');
  }
}
function validateFields(definition, body, existing = {}, { partial = false } = {}) {
  const output = { customFields: { ...(existing.customFields || {}) } };
  const values = { ...existing, ...body };
  for (const field of definition.fields) {
    if (!safeName(field.name)) fail(field.name);
    const path = field.kind === 'CUSTOM_FIELD' ? `customFields.${field.name}` : field.name;
    let value = get(body, path);
    // A single-field edit must not revalidate obsolete choices on other fields.
    // A controlling change still validates any fields that become visible.
    if (partial && value === undefined && (visible(field, existing) || !visible(field, values))) continue;
    if (value === undefined) {
      value = get(existing, path);
      // Partial edits reuse persisted BSON values; validate their API representation.
      if (field.relation && value != null) value = Array.isArray(value) ? value.map(String) : String(value);
      else if (['date', 'datetime'].includes(field.type) && value instanceof Date) value = value.toISOString();
      else if (field.type === 'multiselect' && typeof value === 'string') value = value ? [value] : [];
    }
    if (value === undefined) value = field.defaultValue;
    if (!visible(field, values)) continue;
    try { validateValue(field, value); } catch (error) {
      if (error instanceof InputError) error.field = path;
      throw error;
    }
    if (isBedroomField(field)) value = normalizeBedroom(value);
    else if (isRoomPlanField(field) && value != null && value !== '') value = Array.isArray(value) ? [...new Set(value.map(normalizeRoomPlan))] : normalizeRoomPlan(value);
    if (value !== undefined) set(output, path, value);
  }
  return output;
}
function normalizeSale(input, transactionType) {
  oneOf(transactionType, ['SALE', 'RENT'], 'transactionType');
  const p = { sale: structuredClone(input || {}), transactionType };
  p.sale.status ||= 'AVAILABLE';
  // Older rentals may have been recorded using the sold status.
  if (p.transactionType === 'RENT' && p.sale.status === 'SOLD') p.sale.status = 'RENTED';
  oneOf(p.sale.status, p.transactionType === 'RENT' ? ['AVAILABLE', 'RENTED'] : ['AVAILABLE', 'SOLD'], 'sale.status');
  if (p.sale.status === 'AVAILABLE') p.sale = { status: 'AVAILABLE', buyerType: null, lead: null, partnerCustomer: null, soldAt: null };
  else {
    oneOf(p.sale.buyerType, ['LEAD', 'PARTNER_CUSTOMER'], 'sale.buyerType');
    const key = p.sale.buyerType === 'LEAD' ? 'lead' : 'partnerCustomer';
    if (!objectId(p.sale[key])) fail(`sale.${key}`, 'required');
    p.sale[key === 'lead' ? 'partnerCustomer' : 'lead'] = null;
    if (p.sale.soldAt && !Number.isFinite(Date.parse(p.sale.soldAt))) fail('sale.soldAt');
    p.sale.soldAt ||= new Date().toISOString();
  }
  return p.sale;
}

// Without a definition the built-in catalog applies. With the saved Form
// Builder definition, removed, disabled or optional fields and edited option
// lists are honoured instead of the original hard-coded rules.
function normalizeProperty(input, definition) {
  const p = structuredClone(input);
  const configured = name => definition
    ? definition.fields.find(field => field.kind === 'SYSTEM_FIELD' && field.name === name && field.enabled !== false)
    : { required: true };
  const choose = (name, builtin, builtinOptional = false) => {
    const field = configured(name);
    if (!field) return;
    if (definition && !['select', 'radio'].includes(field.type)) return;
    const allowed = definition && Array.isArray(field.options) && !field.relation ? field.options.map(option => option.value) : builtin;
    oneOf(get(p, name), allowed, name, definition ? !field.required : builtinOptional);
  };
  const amount = (name, positive) => {
    const field = configured(name); const value = get(p, name);
    if (!field || (definition && !field.required && empty(value))) return;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (!definition && positive && value <= 0)) fail(name);
  };
  choose('category', Object.keys(categories));
  const builtinSubtypes = Object.values(categories).flat();
  if (definition) {
    choose('subtype', builtinSubtypes);
    // Keep the built-in category/subtype pairing; administrator-added values may pair freely.
    if (configured('category') && configured('subtype') && categories[p.category] && builtinSubtypes.includes(p.subtype) && !categories[p.category].includes(p.subtype)) fail('subtype');
  } else oneOf(p.subtype, categories[p.category], 'subtype');
  if (definition && empty(p.transactionType)) p.transactionType = 'SALE';
  choose('transactionType', ['SALE', 'RENT']);
  amount('price.amount', false);
  choose('price.currency', ['TRY', 'USD', 'EUR']);
  amount('area.value', true);
  choose('area.type', ['NET', 'GROSS']);
  if (p.area) p.area.unit = 'M2';
  choose('buildingAge', ages, true); choose('floor', floors, true);
  choose('occupancyStatus', ['EMPTY', 'TENANTED', 'OWNER_OCCUPIED'], true);
  for (const key of ['buildingAge', 'floor', 'occupancyStatus', 'bedroom']) if (p[key] === '') p[key] = undefined;
  p.bedroom = p.category === 'COMMERCIAL' ? null : normalizeBedroom(p.bedroom);
  if (p.isInsideResidence !== true) { p.isInsideResidence = false; p.residence = null; }
  else if (!objectId(p.residence)) fail('residence', 'required');
  p.sale = normalizeSale(p.sale, p.transactionType);
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
      locked: false,
    };
    if (system) {
      result.kind = 'SYSTEM_FIELD';
      if (field.name === 'district' && ['Properties', 'Residences', 'Partner Customers'].includes(current.moduleName)) {
        result.type = 'text'; result.options = undefined; result.relation = undefined;
      }
    }
    for (const key of ['enabled', 'required', 'integer']) if (result[key] != null && typeof result[key] !== 'boolean') fail(key);
    for (const key of ['min', 'max']) if (result[key] != null && (typeof result[key] !== 'number' || !Number.isFinite(result[key]))) fail(key);
    if (result.min != null && result.max != null && result.min > result.max) fail('min');
    if (['select', 'radio', 'multiselect'].includes(result.type) && !result.relation) {
      if (!Array.isArray(result.options) || new Set(result.options.map(o => o.value)).size !== result.options.length) fail('options');
      if (!result.options.length && result.required && result.enabled !== false) fail('options', 'optionsRequired');
      for (const option of result.options) {
        if (typeof option.value !== 'string' || !option.value) fail('options');
        for (const lang of ['en', 'fa', 'tr']) if (!option.label?.[lang]?.trim()) fail('options', 'translationsRequired');
      }
    }
    if (!empty(result.defaultValue)) validateValue(result, result.defaultValue);
    return result;
  });
  return fields;
}
module.exports = { InputError, fail, get, set, visible, empty, objectId, validateValue, validateRequiredFields, validateFields, normalizeProperty, normalizeSale, validateDefinition };
