/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Real ReactDOM buttons and modal portals. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import PageHelp from './PageHelp';
let mockLanguage = 'en';
jest.mock('i18n', () => ({ useLanguage: () => ({ language: mockLanguage, t: value => value }) }));
let container;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container);
  localStorage.setItem('user', JSON.stringify({ _id: 'ordinary-user', role: 'user' }));
});
afterEach(() => {
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  container.remove(); localStorage.clear();
});
const render = async (props, path = '/view/task-id') => {
  await act(async () => ReactDOM.render(
    <ChakraProvider><MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><PageHelp {...props} /></MemoryRouter></ChakraProvider>, container,
  ));
};
test.each([
  ['en', 'Page description', 'Tasks guide', 'Only admins and developers'],
  ['fa', 'توضیحات صفحه', 'راهنمای وظایف', 'فقط ادمین و دولوپر'],
  ['tr', 'Sayfa açıklaması', 'Görevler rehberi', 'Yalnızca yöneticiler ve geliştiriciler'],
])('page descriptions open in %s and explain ordinary-user task permissions', async (language, label, heading, action) => {
  mockLanguage = language;
  await render({ routes: [{ path: '/view/:id', name: 'Task detail', parentName: 'Tasks' }], activeRouteName: 'Dashboard' });
  const button = container.querySelector('.crm-page-help');
  expect(button.textContent).toContain(label);
  await act(async () => Simulate.click(button));
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.textContent).toContain(heading);
  expect(dialog.textContent).toContain(action);
  expect(dialog.getAttribute('dir')).toBe(language === 'fa' ? 'rtl' : 'ltr');
});
test('form-builder alias has a specific description', async () => {
  mockLanguage = 'en';
  await render({ routes: [{ path: '/form-builder', name: 'estate.formBuilder' }] }, '/form-builder');
  await act(async () => Simulate.click(container.querySelector('.crm-page-help')));
  expect(document.querySelector('[role="dialog"]').textContent).toContain('Custom fields guide');
});
