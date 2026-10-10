import { canViewModule, canViewAllModule, defaultHidden } from './moduleVisibility';
import { HasAccess } from 'redux/accessUtils';
afterEach(() => localStorage.clear());

test('eleven sections restrict general data by default while every page stays accessible', () => {
  const user = { role: 'user', _id: 'one' };
  expect(defaultHidden.size).toBe(11);
  for (const name of defaultHidden) { expect(canViewModule(name, user)).toBe(true); expect(canViewAllModule(name, user)).toBe(false); }
  expect(canViewModule('Dashboard', user)).toBe(true);
  expect(canViewModule('Properties', user)).toBe(true);
});

test('page and create permissions do not depend on general visibility or existing items', () => {
  const user = { role: 'user', _id: 'one', moduleVisibility: { Leads: false }, accessibleModules: ['Leads'] };
  expect(canViewModule('Leads', user)).toBe(true);
  expect(canViewAllModule('Leads', user)).toBe(false);
  expect(canViewModule('Contacts', user)).toBe(true);
  localStorage.setItem('user', JSON.stringify(user));
  for (const name of [...defaultHidden].filter(name => name !== 'Tasks')) expect(HasAccess([name])[0]).toEqual({ create: true, update: true, delete: true, view: true, import: true, export: true });
  expect(HasAccess(['Users'])[0].create).toBeUndefined();
  for (const name of ['Tasks', 'Task', 'Completed Tasks']) expect(HasAccess([name])[0]).toEqual({ view: true, export: true });
  for (const role of ['admin', 'developer']) {
    localStorage.setItem('user', JSON.stringify({ ...user, role }));
    expect(HasAccess(['Tasks'])[0]).toMatchObject({ create: true, update: true, delete: true });
  }
});

test('explicitly enabled sections and administrator roles keep full access', () => {
  expect(canViewAllModule('Leads', { role: 'user', moduleVisibility: { Leads: true } })).toBe(true);
  for (const role of ['admin', 'developer']) for (const name of defaultHidden) expect(canViewAllModule(name, { role })).toBe(true);
});
