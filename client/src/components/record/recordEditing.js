import { createContext, useContext } from 'react';
import { getIn, setIn } from 'formik';
import { putApi } from 'services/api';
import { fieldPath } from 'components/dynamicForm/DynamicFormRenderer';
import { normalizeFormValues } from 'utils/managedForm';

export const RecordEditingContext = createContext(null);
export const useRecordEditing = () => useContext(RecordEditingContext);
const protectedFields = new Set(['_id', 'password', 'role', 'createBy', 'modifiedBy', 'createdDate', 'updatedDate', 'timestamp', 'deleted', 'authVersion', 'avatarFilename', 'avatarVersion']);
export const canEditRecordField = field => !field.readOnly && !protectedFields.has(field.name) && (!field.external || field.relation);
export function editableDefinition(definition, record) {
  return { ...definition, fields: (definition?.fields || []).filter(field => canEditRecordField(field)
    && (getIn(record, fieldPath(field)) == null || typeof getIn(record, fieldPath(field)) !== 'object' || field.relation || ['file', 'multiselect'].includes(field.type))) };
}
export function recordFormValues(definition, record) {
  let values = record || {};
  for (const field of definition?.fields || []) {
    const path = fieldPath(field);
    const value = getIn(values, path) ?? getIn(record, field.name) ?? field.defaultValue;
    if (value !== undefined) values = setIn(values, path, value);
  }
  return normalizeFormValues(definition, values);
}
export function changedRecordValues(definition, values, original) {
  const normalized = normalizeFormValues(definition, values), before = normalizeFormValues(definition, original);
  let changes = {};
  for (const field of definition.fields) {
    const path = fieldPath(field), value = getIn(normalized, path);
    if (JSON.stringify(value) !== JSON.stringify(getIn(before, path))) changes = setIn(changes, path, value);
  }
  return changes;
}
const paths = { Tasks: 'task', Meetings: 'meeting', Opportunities: 'opportunity', Invoices: 'invoices', Quotes: 'quotes', Users: 'user', 'Email Template': 'email-temp', 'Bank Details': 'bank-details', 'Opportunity Project': 'opportunityproject' };
export async function saveRecordChanges({ moduleName, record, legacyModuleId }, changes) {
  const estate = ['Properties', 'Residences', 'Partner Customers'].includes(moduleName);
  const activity = ['Calls', 'Emails'].includes(moduleName);
  const generic = !paths[moduleName] && !estate && !activity;
  const result = await putApi(activity ? `api/record-workspace/${moduleName}/${record._id}` : estate ? `api/estate/${encodeURIComponent(moduleName)}/${record._id}` : generic ? `api/form/edit/${record._id}` : `api/${paths[moduleName]}/edit/${record._id}`, generic ? { ...changes, moduleId: legacyModuleId } : changes);
  return result?.response || result;
}
