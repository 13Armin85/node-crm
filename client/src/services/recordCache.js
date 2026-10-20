// These are server responses, not user preferences or unsaved form values.
export const RECORD_CACHE_KEYS = ['persist:image', 'persist:route', 'persist:lead', 'persist:contact'];

export function clearRecordCache() {
  for (const key of RECORD_CACHE_KEYS) {
    try { localStorage.removeItem(key); } catch (_) { /* Storage may be unavailable. */ }
  }
}
