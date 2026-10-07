export const FORM_DEFINITION_CHANGED = 'crm:form-definition-changed';
export const FORM_DEFINITION_STORAGE_KEY = 'crm:form-definition-update';
export function announceFormDefinition(definition) {
  window.dispatchEvent(new CustomEvent(FORM_DEFINITION_CHANGED, { detail: definition }));
  try {
    localStorage.setItem(FORM_DEFINITION_STORAGE_KEY, JSON.stringify({ moduleName: definition.moduleName, revision: definition.revision, timestamp: Date.now() }));
  } catch (_) { /* Same-tab updates remain available if storage is disabled. */ }
}
