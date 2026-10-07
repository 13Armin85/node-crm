import { useEffect, useState } from 'react';
import { getIn, setIn } from 'formik';
import { getApi } from 'services/api';
import { formValue } from './formValue';

export function useFormDefinition(moduleName) {
  const [definition, setDefinition] = useState(null);
  const [definitionError, setDefinitionError] = useState(false);
  useEffect(() => {
    let active = true;
    setDefinition(null);
    setDefinitionError(false);
    getApi(`api/estate/definitions/${encodeURIComponent(moduleName)}`).then(result => {
      if (!active) return;
      if (result.status === 200) setDefinition(result.data);
      else setDefinitionError(true);
    }).catch(() => {
      if (active) setDefinitionError(true);
    });
    return () => { active = false; };
  }, [moduleName]);
  return { definition, definitionError };
}

export function normalizeFormValues(definition, values) {
  let normalized = { ...values };
  for (const field of definition?.fields || []) {
    const path = field.kind === 'CUSTOM_FIELD' ? `customFields.${field.name}` : field.name;
    const value = getIn(values, path);
    if (value === undefined) continue;
    let next = value;
    if (field.relation) next = Array.isArray(value)
      ? value.map(formValue).filter(Boolean) : formValue(value) || null;
    else if (['number', 'currency'].includes(field.type) && value !== '' && value != null) next = Number(value);
    else if (field.type === 'phone' && typeof value === 'number') next = String(value);
    normalized = setIn(normalized, path, next);
  }
  return normalized;
}

// Validate the fields that the configured form actually shows, including custom fields.
export function validateFormValues(definition, values) {
  const normalized = normalizeFormValues(definition, values);
  let errors = {};
  for (const field of definition?.fields || []) {
    if (field.enabled === false || !Object.entries(field.condition || {}).every(([key, expected]) => getIn(values, key) === expected)) continue;
    const path = field.kind === 'CUSTOM_FIELD' ? `customFields.${field.name}` : field.name;
    const value = getIn(normalized, path);
    const empty = value == null || value === '' || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);
    if (empty) {
      if (field.required) errors = setIn(errors, path, 'required');
      continue;
    }
    let invalid = false;
    if (field.relation) invalid = (Array.isArray(value) ? value : [value]).some(id => !/^[a-f\d]{24}$/i.test(id));
    else if (['number', 'currency'].includes(field.type)) invalid = !Number.isFinite(value) || (field.min != null && value < field.min) || (field.max != null && value > field.max);
    else if (field.type === 'email') invalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    else if (field.type === 'phone') invalid = !/^[+\d\s().-]{3,30}$/.test(value);
    else if (['date', 'datetime'].includes(field.type)) invalid = !Number.isFinite(Date.parse(value));
    else if (['select', 'radio', 'multiselect'].includes(field.type)) invalid = (Array.isArray(value) ? value : [value]).some(item => !field.options?.some(option => option.value === item));
    if (invalid) errors = setIn(errors, path, 'invalid');
  }
  return errors;
}
