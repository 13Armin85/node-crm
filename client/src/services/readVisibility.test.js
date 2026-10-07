import { readVisibilityPath } from './readVisibility';
import { HasAccess } from 'redux/accessUtils';
const user = { role: 'user', _id: 'ordinary-user' };
afterEach(() => localStorage.clear());

test.each(['contact', 'lead', 'property', 'status', 'calendar', 'reporting/line-chart'])('loads shared %s data while preserving other filters', module => {
  expect(readVisibilityPath('api/' + module + '?createBy=ordinary-user&status=active', user)).toBe('api/' + module + '?status=active');
});
test('removes the obsolete self filter on reports', () => {
  expect(readVisibilityPath('api/reporting?_id=ordinary-user', user)).toBe('api/reporting');
});
test('keeps explicit filters for other users and private endpoints', () => {
  expect(readVisibilityPath('api/contact?createBy=another-user', user)).toBe('api/contact?createBy=another-user');
  expect(readVisibilityPath('api/task?createBy=ordinary-user', user)).toBe('api/task?createBy=ordinary-user');
  expect(readVisibilityPath('api/notification?before=cursor', user)).toBe('api/notification?before=cursor');
  expect(readVisibilityPath('api/contact?createBy=admin', { role: 'admin' })).toBe('api/contact?createBy=admin');
});
test('ordinary users see account records without administrative actions', () => {
  localStorage.setItem('user', JSON.stringify(user));
  expect(HasAccess(['Users'])).toEqual([{ view: true, export: true }]);
  expect(HasAccess(['Contacts'])[0].view).toBe(true);
});
