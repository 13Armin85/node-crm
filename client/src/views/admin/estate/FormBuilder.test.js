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
  getApi.mockImplementation(async path => ({ status: 200, data: path === 'api/estate/definitions' ? ['Properties', 'Residences'] : { ...definition, moduleName: path.split('/').pop() } }));
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
const click = selector => act(async () => Simulate.click(container.querySelector(selector)));
const save = () => click('[data-testid="save-form"]');

test('changes persist only after explicitly clicking Save', async () => {
  await render();
  await change('[data-testid="field-enabled"] input', { checked: false });
  await settleSave();
  expect(putApi).not.toHaveBeenCalled();
  expect(container.querySelector('[data-testid="save-form"]').disabled).toBe(false);
  await save();
  expect(putApi).toHaveBeenCalledTimes(1);
  expect(putApi).toHaveBeenCalledWith('api/estate/definitions/Properties', expect.objectContaining({ fields: [expect.objectContaining({ enabled: false })] }));
  expect(container.querySelector('[data-testid="save-form"]').disabled).toBe(true);
});

test('edits made during a pending save survive its response and save with the next revision', async () => {
  let resolveFirst;
  putApi.mockImplementationOnce((path, body) => new Promise(resolve => { resolveFirst = () => resolve({ status: 200, data: { ...body, revision: 1 } }); }));
  await render();
  await change('[data-testid="field-enabled"] input', { checked: false });
  await save();
  await change('[data-testid="field-label-en"]', { value: 'Renamed while saving' });
  await act(async () => resolveFirst());
  expect(container.querySelector('[data-testid="field-label-en"]').value).toBe('Renamed while saving');
  await settleSave();
  expect(putApi).toHaveBeenCalledTimes(1);
  await save();
  expect(putApi).toHaveBeenCalledTimes(2);
  expect(putApi.mock.calls[1][1]).toMatchObject({ revision: 1, fields: [{ enabled: false, label: { en: 'Renamed while saving' } }] });
});

test('deleting the final custom field keeps Save available and saves an empty definition', async () => {
  definition.fields = [{ ...system, kind: 'CUSTOM_FIELD' }];
  await render();
  await act(async () => Simulate.click(container.querySelector('button[aria-label="Delete"]')));
  expect(container.querySelector('[data-testid="save-form"]')).not.toBeNull();
  await settleSave();
  expect(putApi).not.toHaveBeenCalled();
  await save();
  expect(putApi.mock.calls[0][1].fields).toEqual([]);
});

test('failed saves retain changes and do not retry in a loop', async () => {
  putApi.mockResolvedValue({ status: 409, data: { code: 'conflict' } });
  await render();
  await change('[data-testid="field-enabled"] input', { checked: false });
  await save();
  await settleSave(); await settleSave();
  expect(putApi).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[data-testid="field-enabled"] input').checked).toBe(false);
  expect(container.querySelector('[data-testid="save-form"]').disabled).toBe(false);
});


test('formerly locked system fields allow changing behavior, type and deletion', async () => {
  definition.fields[0] = { ...system, locked: true, required: true };
  await render();
  expect(container.querySelector('[data-testid="field-type"]').disabled).toBe(false);
  expect(container.querySelector('[data-testid="field-enabled"] input').disabled).toBe(false);
  expect(container.querySelector('[data-testid="field-required"] input').disabled).toBe(false);
  await change('[data-testid="field-required"] input', { checked: false });
  await change('[data-testid="field-type"]', { value: 'textarea' });
  await settleSave();
  expect(putApi).not.toHaveBeenCalled();
  await save();
  expect(putApi.mock.calls[0][1].fields[0]).toMatchObject({ type: 'textarea', required: false });
  await act(async () => Simulate.click(container.querySelector('button[aria-label="Delete"]')));
  await settleSave();
  expect(putApi).toHaveBeenCalledTimes(1);
  await save();
  expect(putApi.mock.calls.at(-1)[1].fields).toEqual([]);
});

test('changing modules never saves and restores each unsaved draft on return', async () => {
  await render();
  await change('[data-testid="field-label-en"]', { value: 'Properties draft' });
  await change('[data-testid="module-select"]', { value: 'Residences' });
  await change('[data-testid="field-label-en"]', { value: 'Residences draft' });
  await change('[data-testid="module-select"]', { value: 'Properties' });
  expect(container.querySelector('[data-testid="field-label-en"]').value).toBe('Properties draft');
  await settleSave(); expect(putApi).not.toHaveBeenCalled();
  await save();
  expect(putApi).toHaveBeenCalledWith('api/estate/definitions/Properties', expect.objectContaining({ fields: [expect.objectContaining({ label: expect.objectContaining({ en: 'Properties draft' }) })] }));
  await change('[data-testid="module-select"]', { value: 'Residences' });
  expect(container.querySelector('[data-testid="field-label-en"]').value).toBe('Residences draft');
  expect(container.querySelector('[data-testid="save-form"]').disabled).toBe(false);
  expect(putApi).toHaveBeenCalledTimes(1);
});

test.each(['select', 'multiselect'])('deleting a %s option removes a stale default and waits for Save', async type => {
  definition.fields = [{ ...system, type, defaultValue: type === 'multiselect' ? ['A', 'B'] : 'A',
    options: [{ value: 'A', label }, { value: 'B', label }] }];
  await render(); await click('[data-testid="delete-option-0"]');
  await settleSave(); expect(putApi).not.toHaveBeenCalled();
  await save();
  expect(putApi.mock.calls[0][1].fields[0]).toMatchObject({ options: [{ value: 'B' }] });
  expect(putApi.mock.calls[0][1].fields[0].defaultValue).toEqual(type === 'multiselect' ? ['B'] : undefined);
});

test('a field deleted during an in-flight save stays deleted and requires another manual save', async () => {
  let resolveFirst;
  putApi.mockImplementationOnce((path, body) => new Promise(resolve => { resolveFirst = () => resolve({ status: 200, data: { ...body, revision: 1 } }); }));
  await render(); await change('[data-testid="field-enabled"] input', { checked: false }); await save();
  await click('[data-testid="delete-field"]'); await act(async () => resolveFirst());
  expect(container.querySelector('[data-testid="field-editor"]')).toBeNull();
  await settleSave(); expect(putApi).toHaveBeenCalledTimes(1);
  await save(); expect(putApi.mock.calls[1][1]).toMatchObject({ revision: 1, fields: [] });
});

test('deleting the last option leaves an optional field empty until explicitly saved', async () => {
  definition.fields = [{ ...system, type: 'select', required: false, defaultValue: 'A', options: [{ value: 'A', label }] }];
  await render(); await click('[data-testid="delete-option-0"]');
  await settleSave(); expect(putApi).not.toHaveBeenCalled();
  await save(); expect(putApi.mock.calls[0][1].fields[0]).toMatchObject({ options: [], required: false });
  expect(putApi.mock.calls[0][1].fields[0].defaultValue).toBeUndefined();
});

test('new incomplete fields are not saved and can be deleted before saving other changes', async () => {
  await render(); await click('[data-testid="add-field"]');
  await settleSave(); expect(putApi).not.toHaveBeenCalled();
  await click('[data-testid="delete-field"]'); await change('[data-testid="field-label-en"]', { value: 'Manual update' });
  await save(); expect(putApi.mock.calls[0][1].fields).toHaveLength(1);
  expect(putApi.mock.calls[0][1].fields[0].name).toBe('notes');
});
