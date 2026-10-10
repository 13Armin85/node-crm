const { isAdmin } = require('./userRoles');
const modules = ['Dashboard', 'Leads', 'Contacts', 'Properties', 'Partner Customers', 'Residences', 'Users', 'Tasks', 'Calender', 'Opportunities', 'Invoices', 'Meetings', 'Calls', 'Emails', 'Documents', 'Reporting and Analytics', 'Email Template', 'Quotes', 'Texts', 'Bank Details', 'Opportunity Project'];
const aliases = { Contact: 'Contacts', Lead: 'Leads', Document: 'Documents', Email: 'Emails', PhoneCall: 'Calls', MeetingHistory: 'Meetings', Meeting: 'Meetings', Task: 'Tasks', User: 'Users', Calendar: 'Calender', PartnerCustomers: 'Partner Customers', EmailTemps: 'Email Template', TextMsg: 'Texts', Texts: 'Texts', TextMsges: 'Texts', BankDetails: 'Bank Details', OpportunityProject: 'Opportunity Project', OpportunityProjects: 'Opportunity Project', 'Completed Tasks': 'Tasks' };
const canonicalModule = name => aliases[name] || name;
const defaultHidden = new Set(['Leads', 'Contacts', 'Partner Customers', 'Tasks', 'Opportunities', 'Invoices', 'Meetings', 'Calls', 'Emails', 'Documents', 'Reporting and Analytics']);
const visibilityValue = (actor, name) => actor?.moduleVisibility?.[canonicalModule(name)] ?? !defaultHidden.has(canonicalModule(name));
const effectiveVisibility = actor => ({ ...Object.fromEntries([...defaultHidden].map(name => [name, false])), ...(actor?.moduleVisibility || {}) });
const canView = (actor, name) => isAdmin(actor) || visibilityValue(actor, name) === true;
const canRead = actor => isAdmin(actor) || actor?.role === 'user';
const routeModules = { contact: 'Contacts', lead: 'Leads', property: 'Properties', task: 'Tasks', user: 'Users', opportunity: 'Opportunities', invoices: 'Invoices', meeting: 'Meetings', phoneCall: 'Calls', email: 'Emails', document: 'Documents', calendar: 'Calender', status: 'Dashboard', reporting: 'Reporting and Analytics', quotes: 'Quotes', 'email-temp': 'Email Template', 'bank-details': 'Bank Details', opportunityproject: 'Opportunity Project', 'text-msg': 'Texts' };
const requestViewModule = req => {
  const route = (req.baseUrl || '').split('/').pop();
  if (route === 'user' && (req.path === '/login' || req.path === '/options')) return null;
  if (route === 'reporting' && req.path === '/line-chart') return canView(req.actor, 'Dashboard') ? 'Dashboard' : 'Reporting and Analytics';
  if (route === 'estate') {
    const parts = req.path.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] === 'definitions' || (parts[0] === 'dashboard' && parts[1] === 'exchange-rate')) return null;
    if (parts[0] === 'dashboard') return 'Dashboard';
    if (parts[0] === 'files') return 'Documents';
    return modules.includes(parts[0]) ? parts[0] : null;
  }
  return routeModules[route];
};
const publicModules = new Set(['Dashboard', 'Contacts', 'Properties', 'Partner Customers', 'Residences', 'Users', 'User', 'Tasks', 'Calender', 'Calendar']);
const lookupScope = (req, name) => require('./recordAccess').readScope(req, req.actor, canonicalModule(name));
const hiddenModules = actor => isAdmin(actor) ? [] : [...new Set(Object.entries(effectiveVisibility(actor)).filter(([, value]) => value === false).flatMap(([name]) => [name, ...Object.keys(aliases).filter(alias => aliases[alias] === name)]))];
module.exports = { defaultHidden, visibilityValue, effectiveVisibility, canRead, modules, canonicalModule, canView, requestViewModule, publicModules, lookupScope, hiddenModules };
