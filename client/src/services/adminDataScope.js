import { isAdmin } from 'roles';
import { getStoredUser } from './authSession';

const storageKey = user => 'crm:data-user:' + user._id;
export const getDataUser = (user = getStoredUser()) => {
  if (!isAdmin(user) || !user?._id) return '';
  const value = sessionStorage.getItem(storageKey(user)) || '';
  return /^[a-f\d]{24}$/i.test(value) ? value : '';
};
export const setDataUser = (value, user = getStoredUser()) => {
  if (!isAdmin(user) || !user?._id) return;
  if (value && /^[a-f\d]{24}$/i.test(value)) sessionStorage.setItem(storageKey(user), value);
  else sessionStorage.removeItem(storageKey(user));
};
export const dataScopeHeaders = (path, method = 'get', user = getStoredUser()) => {
  const subject = getDataUser(user);
  if (!subject) return {};
  const url = new URL(path, 'http://crm.local/');
  if (!/^\/api\/(?:task|contact|lead|property|opportunity|invoices|meeting|email|email-temp|phoneCall|calendar|status|document|form|reporting|quotes|text-msg|bank-details|opportunityproject|estate|user)(?:\/|$)/.test(url.pathname)) return {};
  if (method !== 'get' && !(method === 'post' && url.pathname === '/api/reporting/index')) return {};
  if (/^\/api\/estate\/(?:definitions|dashboard\/exchange-rate)(?:\/|$)/.test(url.pathname)) return {};
  return { 'X-CRM-Data-User': subject };
};
