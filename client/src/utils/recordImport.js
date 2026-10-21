import { setIn } from 'formik';
import { normalizeSearchText } from './searchText';
import { invoiceNumber } from './invoiceCalculations';
import { validateFormValues } from './managedForm';

export const importModules = ['Contacts', 'Leads', 'Properties', 'Residences', 'Partner Customers', 'Opportunities', 'Invoices', 'Quotes', 'Opportunity Project'];
export const importModuleFor = (title, t) => importModules.find(name => [name, t(name), ...(name === 'Quotes' ? ['Offer Letter', t('Offer Letter')] : [])].includes(title));
const reserved = new Set(['_id', '__v', 'createdDate', 'updatedDate', 'modifiedDate', 'createBy', 'modifiedBy', 'deleted', 'password', 'role', '_duplicateKeys']);
export const importFields = definition => (definition?.fields || []).filter(field => field.enabled !== false && !reserved.has(field.name));
export const importFieldPath = field => field.kind === 'CUSTOM_FIELD' ? `customFields.${field.name}` : field.name;
const key = value => normalizeSearchText(value).replace(/[\s_.-]/g, '');
export const importFieldLabel = (field, language) => typeof field.label === 'object' ? field.label[language] || field.label.en || field.name : field.label || field.name;
export function automaticMapping(fields, headers) {
  return Object.fromEntries(fields.map(field => {
    const names = [field.name, ...(typeof field.label === 'object' ? Object.values(field.label) : [field.label])].filter(Boolean).map(key);
    return [importFieldPath(field), headers.find(header => names.includes(key(header))) || ''];
  }));
}
const invalid = () => { throw new Error('invalid'); };
export function importCell(value, field) {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) return value.toISOString();
  if (field.type === 'phone') return String(value).replace(/[\u06f0-\u06f9]/g, digit => String(digit.charCodeAt(0) - 1776)).replace(/[\u0660-\u0669]/g, digit => String(digit.charCodeAt(0) - 1632)).replace(/[\u200b-\u200f]/g, '').trim();
  if (['number', 'currency'].includes(field.type)) {
    const number = invoiceNumber(value);
    if (!Number.isFinite(number)) invalid();
    return number;
  }
  if (field.type === 'checkbox') {
    if (typeof value === 'boolean') return value;
    const text = key(value);
    if (['1', 'true', 'yes', 'بله', 'evet'].includes(text)) return true;
    if (['0', 'false', 'no', 'خیر', 'hayir'].includes(text)) return false;
    invalid();
  }
  const choice = item => {
    if (!field.options?.length || field.relation) return String(item);
    const option = field.options.find(option => [option.value, ...(typeof option.label === 'object' ? Object.values(option.label) : [option.label])].some(label => label != null && key(label) === key(item)));
    return option ? option.value : invalid();
  };
  if (['items', 'installments'].includes(field.name) || field.type === 'file') {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) invalid();
    return parsed;
  }
  if (field.type === 'multiselect' || (field.external && field.relation && field.type === 'text')) {
    const parsed = Array.isArray(value) ? value : String(value).trim().startsWith('[') ? JSON.parse(value) : String(value).split(/[,;]/).map(item => item.trim()).filter(Boolean);
    if (!Array.isArray(parsed)) invalid();
    return parsed.map(choice);
  }
  if (['select', 'radio'].includes(field.type) && !field.relation) return choice(value);
  if (typeof value === 'object') invalid();
  return String(value).trim();
}
function flattenErrors(errors, prefix = '') {
  return Object.entries(errors || {}).flatMap(([name, value]) => typeof value === 'string' ? [{ field: prefix + name, code: value }] : flattenErrors(value, prefix + name + '.'));
}
export function prepareImport(rows, definition, mapping, defaults = {}, moduleName) {
  const fields = importFields(definition), errors = [], records = [];
  rows.forEach((row, index) => {
    let values = { customFields: {} };
    fields.forEach(field => {
      const path = importFieldPath(field), mapped = mapping[path];
      const raw = mapped ? row[mapped] : defaults[path] ?? field.defaultValue;
      try {
        const value = importCell(raw, field);
        if (value !== undefined) values = setIn(values, path, value);
      } catch { errors.push({ row: index + 2, field: path, code: 'invalid' }); }
    });
    if (moduleName === 'Contacts' && !values.fullName) {
      const header = name => Object.keys(row).find(column => key(column) === name);
      values.fullName = [row[header('firstname')], row[header('lastname')]].filter(Boolean).join(' ').trim();
    }
    if (moduleName === 'Leads' && ['lead', 'contact', 'partnerCustomer'].filter(name => values[name]).length > 1) errors.push({ row: index + 2, field: 'leadRelations', code: 'leadSelectionRequired' });
    // Structured invoice/quote rows are validated by their persistence validators.
    const scalarDefinition = { ...definition, moduleName: moduleName || definition.moduleName, fields: definition.fields.filter(field => !['items', 'installments'].includes(field.name)) };
    errors.push(...flattenErrors(validateFormValues(scalarDefinition, values)).map(error => ({ row: index + 2, ...error })));
    records.push(values);
  });
  return { records, errors };
}
