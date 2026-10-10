import { useEffect, useState } from 'react';
import { getApi } from './api';
import { getStoredUser } from './authSession';
import { isAdmin } from 'roles';
export const VISIBILITY_CHANGED = 'crm:module-visibility-changed';
export const defaultHidden = new Set(['Leads', 'Contacts', 'Partner Customers', 'Tasks', 'Opportunities', 'Invoices', 'Meetings', 'Calls', 'Emails', 'Documents', 'Reporting and Analytics']);
const aliases = { User: 'Users', Calendar: 'Calender', PartnerCustomers: 'Partner Customers', EmailTemps: 'Email Template', TextMsg: 'Texts', BankDetails: 'Bank Details', OpportunityProject: 'Opportunity Project', OpportunityProjects: 'Opportunity Project' };
const canonical = name => aliases[String(name).trim()] || String(name).trim();
export const canViewAllModule = (name, user = getStoredUser()) => isAdmin(user) || (user?.moduleVisibility?.[canonical(name)] ?? !defaultHidden.has(canonical(name))) === true;
// Data visibility never removes page access or data-entry actions.
export const canViewModule = (name, user = getStoredUser()) => isAdmin(user) || user?.role === 'user';
const persist = data => {
  const user = getStoredUser();
  if (user) localStorage.setItem('user', JSON.stringify({ ...user, moduleVisibility: data.visibility || {}, accessibleModules: data.accessibleModules || [] }));
};
export async function refreshModuleAccess() {
  const response = await getApi('api/visibility/me');
  if (response?.status !== 200) return false;
  persist(response.data);
  window.dispatchEvent(new CustomEvent(VISIBILITY_CHANGED, { detail: response.data }));
  return true;
}
export function useModuleVisibility() {
  const [state, setState] = useState({ ready: false, error: false, visibility: {}, accessibleModules: [] });
  useEffect(() => {
    let active = true, pending = false;
    const consume = data => {
      if (!active) return;
      const next = { ready: true, error: false, visibility: data.visibility || {}, accessibleModules: data.accessibleModules || [] };
      persist(data);
      setState(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await getApi('api/visibility/me');
        if (!active) return;
        if (response?.status !== 200) { setState(previous => ({ ...previous, error: true })); return; }
        consume(response.data);
      } finally { pending = false; }
    };
    const changed = event => event.detail ? consume(event.detail) : refresh();
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener(VISIBILITY_CHANGED, changed);
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; window.removeEventListener('focus', refresh); window.removeEventListener(VISIBILITY_CHANGED, changed); window.clearInterval(timer); };
  }, []);
  return state;
}
