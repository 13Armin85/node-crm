/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- These tests render navigation links with ReactDOM. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import SidebarLinks from './Links';

let container;
beforeEach(() => {
  localStorage.setItem('user', JSON.stringify({ role: 'user' }));
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(() => {
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  container.remove();
  localStorage.clear();
});
const item = (name, path, rest = {}) => ({ name, path, layout: ['/user', '/admin'], ...rest });
function render(routes, path, close = jest.fn()) {
  act(() => { ReactDOM.render(
    <ChakraProvider><MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SidebarLinks routes={routes} openSidebar setOpenSidebar={close} />
    </MemoryRouter></ChakraProvider>,
    container,
  ); });
}

test('duplicate paths across groups render only one navigation item', () => {
  render([
    item('Tasks', '/task'),
    { name: 'More', category: true, items: [item('Tasks again', '/TASK/'), item('Calendar', '/calender')] },
  ], '/task');
  expect(container.querySelectorAll('a')).toHaveLength(2);
  expect(container.querySelectorAll('.is-active')).toHaveLength(1);
  const link = container.querySelector('a[href="/calender"]');
  act(() => Simulate.click(link, { button: 0 }));
  expect(container.querySelectorAll('a')).toHaveLength(2);
  expect(container.querySelector('a[aria-current="page"]').getAttribute('href')).toBe('/calender');
});

test('overlapping paths select only the most specific visible item', () => {
  render([item('Projects', '/projects'), item('Reports', '/projects/reports')], '/projects/reports/latest');
  expect(container.querySelectorAll('.is-active')).toHaveLength(1);
  expect(container.querySelector('a[aria-current="page"]').getAttribute('href')).toBe('/projects/reports');
});

test('developer detail pages retain their parent menu selection', () => {
  localStorage.setItem('user', JSON.stringify({ role: 'developer' }));
  render([
    item('Leads', '/lead'),
    item('Leads', '/leadView/:id', { under: 'lead', parentName: 'Leads' }),
    item('Tasks', '/task'),
  ], '/leadView/example');
  expect(container.querySelectorAll('a')).toHaveLength(2);
  expect(container.querySelectorAll('.is-active')).toHaveLength(1);
  expect(container.querySelector('a[aria-current="page"]').getAttribute('href')).toBe('/lead');
});
