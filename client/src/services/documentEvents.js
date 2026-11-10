import { useEffect, useRef } from 'react';

const eventName = 'crm:documents-changed';
const storageKey = 'crm:documents-changed';
export function notifyDocumentsChanged() {
  window.dispatchEvent(new Event(eventName));
  try { localStorage.setItem(storageKey, JSON.stringify({ at: Date.now(), nonce: Math.random() })); } catch (_) {}
}
export function useDocumentChanges(refresh) {
  const current = useRef(refresh); current.current = refresh;
  useEffect(() => {
    const changed = () => current.current();
    const stored = event => { if (event.key === storageKey) changed(); };
    window.addEventListener(eventName, changed);
    window.addEventListener('storage', stored);
    window.addEventListener('focus', changed);
    return () => {
      window.removeEventListener(eventName, changed);
      window.removeEventListener('storage', stored);
      window.removeEventListener('focus', changed);
    };
  }, []);
}
