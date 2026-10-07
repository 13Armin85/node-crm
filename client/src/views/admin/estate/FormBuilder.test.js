/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { getApi, putApi } from 'services/api';
import FormBuilder from './FormBuilder';

jest.mock('services/api', () => ({ getApi: jest.fn(), putApi: jest.fn() }));
const label = { en: 'Notes', fa: 'Notes fa', tr: 'Notes tr' };
const system = { name: 'notes', kind: 'SYSTEM_FIELD', type: 'text', label, enabled: true };
let container, definition;
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify({ role: 'admin' }));
  definition = { moduleName: 'Properties', revision: 0, fields: [{ ...system }] };
  getApi.mockImplementation(async path => ({ status: 200, data: path === 'api/estate/definitions' ? ['Properties', 'Residences'] : definition }));
  putApi.mockImplementation(async (path, body) => ({ status: 200, data: { ...body, revision: body.revision + 1 } }));
  container = document.createElement('div'); document.body.appendChild(container);
});
afterEach(() => {
  act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove();
  jest.clearAllMocks(); localStorage.clear();
});
const render = () => act(async () => ReactDOM.render(<ChakraProvider><FormBuilder /></ChakraProvider>, container));
const change = (selector, patch) => act(async () => Simulate.change(container.querySelector(selector), { target: patch }));
const settleSave = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 850)); });

test('turning off a field automatically persists visibility', async () => {
  await render();
  await change('[data-testid="field-enabled"] input', { checked: false });
  await settleSave();
  expect(putApi).toHaveBeenCalledTimes(1);
  expect(putApi).toHaveBeenCalledWith('api/estate/definitions/Properties', expect.objectContaining({ fields: [expect.objectContaining({ enabled: false })] }));
  expect(container.querySelector('[data-testid="save-form"]').disabled).toBe(true);
});

test('edits made during a pending save survive its response and save with the next revision', async () => {
  let resolveFirst;
  putApi.mockImplementationOnce((path, body) => new Promise(resolve => { resolveFirst = () => resolve({ status: 200, data: { ...body, revision: 1 } }); }));
  await render();
  await change('[data-testid="field-enabled"] input', { checked: false });
  await settleSave();
  await change('[data-testid="field-label-en"]', { value: 'Renamed while saving' });
  await act(async () => resolveFirst());
  expect(container.querySelector('[data-testid="field-label-en"]').value).toBe('Renamed while saving');
  await settleSave();
  expect(putApi).toHaveBeenCalledTimes(2);
  expect(putApi.mock.calls[1][1]).toMatchObject({ revision: 1, fields: [{ enabled: false, label: { en: 'Renamed while saving' } }] });
});

test('deleting the final custom field keeps Save available and saves an empty definition', async () => {
  definition.fields = [{ ...system, kind: 'CUSTOM_FIELD' }];
  await render();
  await act(async () => Simulate.click(container.querySelector('button[aria-label="Delete"]')));
  expect(container.querySelector('[data-testid="save-form"]')).not.toBeNull();
  await settleSave();
  expect(putApi.mock.calls[0][1].fields).toEqual([]);
});

test('failed saves retain changes and do not retry in a loop', async () => {
  putApi.mockResolvedValue({ status: 409, data: { code: 'conflict' } });
  await render();
  await change('[data-testid="field-enabled"] input', { checked: false });
  await settleSave(); await settleSave();
  expect(putApi).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[data-testid="field-enabled"] input').checked).toBe(false);
  expect(container.querySelector('[data-testid="save-form"]').disabled).toBe(false);
});
