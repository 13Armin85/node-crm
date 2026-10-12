import { formValue } from './formValue';

export const LEAD_SELECTION_MESSAGE = 'Select exactly one: a lead, a partner customer, or a contact.';
export const LEAD_SELECTION_ERROR = 'leadSelectionRequired';
const relationNames = ['lead', 'contact', 'partnerCustomer'];
export const hasLeadSelection = values => relationNames.filter(name => formValue(values[name])).length === 1;

export const isLeadRelationVisible = (name, values) => {
  const selected = relationNames.find(key => formValue(values[key]));
  return !relationNames.includes(name) || !selected || selected === name;
};

// Older records can contain multiple relations; keep one when opening the form.
export const normalizeLeadRelations = values => {
  const selected = relationNames.find(name => formValue(values[name]));
  return { ...values, ...Object.fromEntries(relationNames.map(name => [name, name === selected ? values[name] : null])) };
};
