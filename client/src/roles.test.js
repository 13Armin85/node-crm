import { ROLE_PATH, isAdmin, isDeveloper, canEditUser, canDeleteUser } from './roles';
import { HasAccess } from './redux/accessUtils';
import { getStoredUser } from './services/authSession';

const developer = { _id: 'developer-id', role: 'developer' };
const admin = { _id: 'admin-id', role: 'admin' };
const user = { _id: 'user-id', role: 'user' };

afterEach(() => localStorage.clear());

test('developer uses the admin layout and inherits administrative UI permissions', () => {
  expect(ROLE_PATH.developer).toBe(ROLE_PATH.admin);
  expect(isAdmin(developer)).toBe(true);
  expect(isDeveloper(developer)).toBe(true);
  expect(isDeveloper(admin)).toBe(false);
  localStorage.setItem('user', JSON.stringify(developer));
  expect(HasAccess(['Users', 'Custom Fields', 'Properties']).every(access => access.create && access.view)).toBe(true);
});

test('only developer receives the create-user UI permission', () => {
  localStorage.setItem('user', JSON.stringify(admin));
  expect(HasAccess(['Users'])[0]).toMatchObject({ create: false, view: true });
  localStorage.setItem('user', JSON.stringify(user));
  expect(HasAccess(['Users'])[0]).toEqual({ view: true, export: true });
});

test('admin cannot edit or delete developer accounts in the UI', () => {
  expect(canEditUser(admin, developer)).toBe(false);
  expect(canDeleteUser(admin, developer)).toBe(false);
  expect(canEditUser(developer, admin)).toBe(true);
  expect(canDeleteUser(developer, admin)).toBe(true);
  expect(canDeleteUser(developer, developer)).toBe(false);
  expect(canEditUser(user, user)).toBe(true);
  expect(canEditUser(user, admin)).toBe(false);
});

test('stored developer sessions retain their role', () => {
  localStorage.setItem('user', JSON.stringify(developer));
  expect(getStoredUser()).toEqual(developer);
  localStorage.setItem('user', JSON.stringify({ role: 'unknown' }));
  expect(getStoredUser()).toBeNull();
});
