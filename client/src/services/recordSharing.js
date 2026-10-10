import { isAdmin } from 'roles';
import { getStoredUser } from './authSession';
export const sharedModules = ['Contacts', 'Leads', 'Opportunities', 'Invoices', 'Meetings', 'Calls', 'Emails', 'Documents', 'Partner Customers'];
const names = { Contacts: ['Contacts'], Leads: ['Leads'], Opportunities: ['Opportunities', 'Opprtunities'], Invoices: ['Invoices'], Meetings: ['Meetings', 'Meeting'], Calls: ['Calls'], Emails: ['Emails', 'Email'] };
export const shareModuleForTitle = (title, t) => Object.entries(names).find(([, aliases]) => aliases.some(name => name === title || t(name) === title))?.[0];
export const canSendRecord = module => isAdmin(getStoredUser()) && sharedModules.includes(module);
