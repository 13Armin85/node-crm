/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises the actual control form with ReactDOM. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import DataVisibility from './DataVisibility';
import { getApi, putApi } from 'services/api';
jest.mock('services/api', () => ({ getApi: jest.fn(), putApi: jest.fn() }));
jest.mock('i18n', () => ({ useLanguage: () => ({ language: 'en', t: value => value }) }));
let container;
const users = [{ _id: 'first', username: 'first@example.test' }, { _id: 'second', username: 'second@example.test' }];
beforeEach(() => {
  jest.clearAllMocks();
  getApi.mockResolvedValue({ status: 200, data: { users, modules: ['Opportunities', 'Meetings'] } });
  container = document.createElement('div'); document.body.appendChild(container);
});
afterEach(() => {
  act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove();
});
const button = title => [...container.querySelectorAll('button')].find(node => node.textContent === title);
const inputs = () => [...container.querySelectorAll('input[type="checkbox"]')];
const render = async () => act(async () => {
  ReactDOM.render(<ChakraProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DataVisibility /></MemoryRouter></ChakraProvider>, container);
});
const select = async id => act(async () => Simulate.change(container.querySelector('#visibility-user'), { target: { value: id } }));
test('defaults the requested sections to hidden and saves only the selected user changes', async () => {
  putApi.mockImplementation(async (path, body) => ({ status: 200, data: { visibility: body.visibility } }));
  await render(); await select('first');
  expect(inputs().every(input => !input.checked)).toBe(true);
  await act(async () => Simulate.change(inputs()[0], { target: { checked: true } }));
  expect(container.querySelector('#visibility-user').disabled).toBe(true);
  await act(async () => Simulate.click(button('Save changes')));
  expect(putApi).toHaveBeenCalledWith('api/visibility/first', { visibility: { Opportunities: true } });
  expect(inputs()[0].checked).toBe(true);
  expect(container.textContent).toContain('Visibility settings saved');
  await select('second');
  expect(inputs().every(input => !input.checked)).toBe(true);
  await select('first');
  expect(inputs()[0].checked).toBe(true);
  await act(async () => Simulate.click(button('Show all existing data')));
  await act(async () => Simulate.click(button('Save changes')));
  expect(putApi).toHaveBeenLastCalledWith('api/visibility/first', { visibility: { Meetings: true } });
});
test('a failed save preserves changes for retry without switching users', async () => {
  putApi.mockResolvedValue({ status: 500, data: { code: 'serverError' } });
  await render(); await select('first');
  await act(async () => Simulate.change(inputs()[1], { target: { checked: true } }));
  await act(async () => Simulate.click(button('Save changes')));
  expect(container.textContent).toContain('Could not load or save settings');
  expect(inputs()[1].checked).toBe(true);
  expect(container.querySelector('#visibility-user').disabled).toBe(true);
  putApi.mockResolvedValue({ status: 200, data: { visibility: { Meetings: true } } });
  await act(async () => Simulate.click(button('Save changes')));
  expect(container.querySelector('#visibility-user').disabled).toBe(false);
  expect(inputs()[1].checked).toBe(true);
});
