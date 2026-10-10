/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- These tests exercise actual sidebar links with ReactDOM. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { getApi } from 'services/api';
import UserLayout from './index';
import configuredRoutes from 'routes.js';

let mockState;
jest.mock('react-redux', () => {
  const dispatch = jest.fn();
  return { useDispatch: () => dispatch, useSelector: selector => selector(mockState) };
});
jest.mock('services/api', () => ({ getApi: jest.fn() }));
jest.mock('../../redux/slices/imageSlice', () => ({ fetchImage: () => ({ type: 'images/test' }) }));
jest.mock('../../redux/slices/moduleSlice', () => ({ fetchModules: () => ({ type: 'modules/test' }) }));
jest.mock('components/navbar/NavbarAdmin.js', () => () => null);
jest.mock('components/footer/FooterAdmin.js', () => () => null);
jest.mock('components/help/PageHelp', () => () => null);
jest.mock('views/admin/dynamicPage', () => () => null);
jest.mock('routes.js', () => {
  const Page = () => null;
  const layout = ['/user'];
  return Object.freeze([
    { name: 'Dashboard', path: '/default', layout, component: Page },
    { name: 'Dashboard duplicate', path: '/default', layout, component: Page },
    { name: 'Tasks', path: '/task', layout, component: Page },
    { name: 'Tasks', path: '/view/:id', layout, under: 'task', parentName: 'Tasks', component: Page },
    { name: 'Calender', path: '/calender', layout, component: Page },
    { name: 'Calendar duplicate', path: '/calender', layout, component: Page },
    { name: 'Users', path: '/user', layout: ['/admin'], component: Page },
  ]);
});

let container;
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('user', JSON.stringify({ _id: 'ordinary-user', role: 'user' }));
  mockState = { modules: { data: [] }, images: { images: [] } };
  Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true, writable: true });
  getApi.mockImplementation(async path => path === 'api/visibility/me' ? { status: 200, data: { visibility: { Tasks: true } } } : { status: 200, data: [
    { moduleName: 'Custom Module' }, { moduleName: ' custom  module ' },
    { moduleName: 'Dashboard' }, { moduleName: 'default' },
  ] });
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(() => {
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  container.remove();
  localStorage.clear();
});

const sidebarLinks = () => [...container.querySelectorAll('#crm-sidebar nav a')];
async function render(path = '/default') {
  await act(async () => {
    ReactDOM.render(
      <ChakraProvider><MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <UserLayout />
      </MemoryRouter></ChakraProvider>,
      container,
    );
  });
}
async function click(path) {
  const link = sidebarLinks().find(item => item.getAttribute('href') === path);
  expect(link).toBeDefined();
  await act(async () => { Simulate.click(link, { button: 0 }); });
}

test('ordinary users see each static or dynamic sidebar item once', async () => {
  await render();
  const paths = sidebarLinks().map(item => item.getAttribute('href'));
  expect(paths).toEqual(['/default', '/task', '/calender', '/custom-module']);
  expect(container.querySelectorAll('#crm-sidebar .is-active')).toHaveLength(1);
  expect(configuredRoutes).toHaveLength(7);
});

test('repeated navigation keeps the item count fixed and selects exactly the clicked item', async () => {
  await render();
  const initialCount = sidebarLinks().length;
  for (const path of ['/task', '/task', '/calender', '/custom-module', '/default', '/task']) {
    await click(path);
    expect(sidebarLinks()).toHaveLength(initialCount);
    const selected = container.querySelectorAll('#crm-sidebar a[aria-current="page"]');
    expect(selected).toHaveLength(1);
    expect(selected[0].getAttribute('href')).toBe(path);
    expect(container.querySelectorAll('#crm-sidebar .is-active')).toHaveLength(1);
  }
  expect(getApi.mock.calls.filter(([path]) => path === 'api/route/')).toHaveLength(1);
  expect(getApi.mock.calls.filter(([path]) => path === 'api/visibility/me')).toHaveLength(1);
  expect(configuredRoutes).toHaveLength(7);
});

test('opening a task detail keeps the Tasks sidebar item selected', async () => {
  await render('/view/task-id');
  const selected = container.querySelector('#crm-sidebar a[aria-current="page"]');
  expect(selected.getAttribute('href')).toBe('/task');
  expect(container.querySelectorAll('#crm-sidebar .is-active')).toHaveLength(1);
});

test('global module availability does not disable ordinary user tabs or duplicate links', async () => {
  await render();
  mockState = { ...mockState, modules: { data: [{ moduleName: 'Tasks', isActive: false }] } };
  await render();
  expect(sidebarLinks().map(item => item.getAttribute('href'))).toEqual(['/default', '/task', '/calender', '/custom-module']);
  mockState = { ...mockState, modules: { data: [{ moduleName: 'Tasks', isActive: true }] } };
  await render();
  expect(sidebarLinks().map(item => item.getAttribute('href'))).toEqual(['/default', '/task', '/calender', '/custom-module']);
});

test('a mobile click selects the item and closes the sidebar once', async () => {
  window.innerWidth = 800;
  await render();
  await click('/task');
  expect(container.querySelector('.crm-shell').getAttribute('data-sidebar-open')).toBe('false');
  expect(container.querySelector('#crm-sidebar a[aria-current="page"]').getAttribute('href')).toBe('/task');
  expect(sidebarLinks()).toHaveLength(4);
});

test('per-user visibility updates data restrictions without removing sidebar tabs', async () => {
  let visibility = { Tasks: false };
  getApi.mockImplementation(async path => path === 'api/visibility/me'
    ? { status: 200, data: { visibility } }
    : { status: 200, data: [] });
  await render();
  expect(sidebarLinks().map(link => link.getAttribute('href'))).toEqual(['/default', '/task', '/calender']);
  visibility = { Tasks: true, Calender: false };
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(sidebarLinks().map(link => link.getAttribute('href'))).toEqual(['/default', '/task', '/calender']);
});

test('tabs stay available even when no own or sent records exist', async () => {
  let accessibleModules = [];
  getApi.mockImplementation(async path => path === 'api/visibility/me' ? { status: 200, data: { visibility: { Tasks: false }, accessibleModules } } : { status: 200, data: [] });
  await render(); expect(sidebarLinks().map(link => link.getAttribute('href'))).toContain('/task');
  accessibleModules = ['Tasks']; await act(async () => window.dispatchEvent(new Event('focus')));
  expect(sidebarLinks().map(link => link.getAttribute('href'))).toContain('/task');
  accessibleModules = []; await act(async () => window.dispatchEvent(new Event('focus')));
  expect(sidebarLinks().map(link => link.getAttribute('href'))).toContain('/task');
});
