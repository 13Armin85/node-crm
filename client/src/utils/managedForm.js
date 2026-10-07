import { useEffect, useState } from 'react';
import { getIn, setIn } from 'formik';
import { getApi } from 'services/api';
import { formValue } from './formValue';
import { FORM_DEFINITION_CHANGED, FORM_DEFINITION_STORAGE_KEY } from 'services/formDefinitionEvents';

export function useFormDefinition(moduleName, enabled = true) {
  const [definition, setDefinition] = useState(null);
  const [definitionError, setDefinitionError] = useState(false);
  useEffect(() => {
    let active = true, request = 0;
    setDefinition(null);
    setDefinitionError(false);
    if (!moduleName || !enabled) return undefined;
    const load = async () => {
      const current = ++request;
      try {
        const result = await getApi(`api/estate/definitions/${encodeURIComponent(moduleName)}`);
        if (!active || current !== request) return;
        if (result.status === 200) { setDefinition(result.data); setDefinitionError(false); }
        else setDefinitionError(true);
      } catch (_) { if (active && current === request) setDefinitionError(true); }
    };
    const changed = event => {
      if (event.detail?.moduleName !== moduleName) return;
      ++request; // Ignore a fetch started before this confirmed save.
      setDefinition(event.detail); setDefinitionError(false);
    };
    const stored = event => {
      if (event.key !== FORM_DEFINITION_STORAGE_KEY) return;
      try { if (JSON.parse(event.newValue)?.moduleName === moduleName) load(); } catch (_) {}
    };
    load();
    window.addEventListener(FORM_DEFINITION_CHANGED, changed);
    window.addEventListener('storage', stored);
    window.addEventListener('focus', load);
    return () => {
      active = false;
      window.removeEventListener(FORM_DEFINITION_CHANGED, changed);
      window.removeEventListener('storage', stored);
      window.removeEventListener('focus', load);
    };
  }, [moduleName, enabled]);
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
