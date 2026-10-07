import { dataScopeHeaders, getDataUser, setDataUser } from './adminDataScope';
const admin = { _id: 'admin-account', role: 'admin' };
const developer = { _id: 'developer-account', role: 'developer' };
const ordinary = { _id: 'ordinary-account', role: 'user' };
const subject = '64d33173fd7ff3fa0924a103';
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { localStorage.clear(); sessionStorage.clear(); });

test.each(['task', 'task/assignees', 'contact', 'lead', 'property', 'opportunity', 'invoices', 'meeting', 'phoneCall', 'email', 'email-temp', 'calendar', 'status', 'document', 'reporting', 'quotes', 'text-msg', 'bank-details', 'opportunityproject', 'estate/Properties', 'form?moduleId=module', 'user'])('admin can switch all %s records to an individual', path => {
  expect(dataScopeHeaders('api/' + path, 'get', admin)).toEqual({});
  setDataUser(subject, admin);
  expect(dataScopeHeaders('api/' + path, 'get', admin)).toEqual({ 'X-CRM-Data-User': subject });
  setDataUser('', admin);
  expect(dataScopeHeaders('api/' + path, 'get', admin)).toEqual({});
});
test('selection persists across pages and remains isolated by account and role', () => {
  setDataUser(subject, admin);
  expect(getDataUser(admin)).toBe(subject);
  expect(getDataUser(developer)).toBe('');
  setDataUser(subject, developer);
  expect(getDataUser(developer)).toBe(subject);
  setDataUser(subject, ordinary);
  expect(getDataUser(ordinary)).toBe('');
  expect(dataScopeHeaders('api/invoices', 'get', ordinary)).toEqual({});
});
test('filters affect reporting reads but cannot change mutations, login, notifications or form definitions', () => {
  setDataUser(subject, admin);
  expect(dataScopeHeaders('api/reporting/index', 'post', admin)).toEqual({ 'X-CRM-Data-User': subject });
  for (const [path, method] of [['api/task/add', 'post'], ['api/task/edit/id', 'put'], ['api/user/login', 'post'], ['api/notification', 'get'], ['api/estate/definitions/Invoices', 'get']]) {
    expect(dataScopeHeaders(path, method, admin)).toEqual({});
  }
});
test('malformed saved selections never reach an API header', () => {
  sessionStorage.setItem('crm:data-user:' + admin._id, 'invalid');
  expect(getDataUser(admin)).toBe('');
  expect(dataScopeHeaders('api/invoices', 'get', admin)).toEqual({});
});
