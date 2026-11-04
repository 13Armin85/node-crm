/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercise ReactDOM field editing and keyboard interactions. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from 'i18n';
import RecordFields from './RecordFields';
import { RecordEditingContext } from './recordEditing';
let container, editing;
const definition = { moduleName: 'Contacts', fields: [
  { name: 'fullName', kind: 'SYSTEM_FIELD', type: 'text', label: 'Full Name', required: true, order: 1 },
  { name: 'email', kind: 'SYSTEM_FIELD', type: 'email', label: 'Email', order: 2 },
  { name: 'budget', kind: 'CUSTOM_FIELD', type: 'number', label: 'Budget', order: 0 },
] };
const render = () => act(async () => ReactDOM.render(<ChakraProvider><LanguageProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><RecordEditingContext.Provider value={editing}><RecordFields definition={definition} record={editing.record} /></RecordEditingContext.Provider></MemoryRouter></LanguageProvider></ChakraProvider>, container));
const save = () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Save');
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container);
  editing = { editable: true, definition, moduleName: 'Contacts', record: { _id: 'test', fullName: 'Original Name', email: 'keep@example.test', customFields: { budget: 0 } }, save: jest.fn().mockResolvedValue({ status: 200 }) };
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); });
test('double-click edits a value directly and saves only that changed field', async () => {
  await render();
  expect([...container.querySelectorAll('[data-record-field]')].map(node => node.dataset.recordField)).toEqual(['customFields.budget', 'fullName', 'email']);
  await act(async () => Simulate.doubleClick(container.querySelector('[data-record-field="fullName"] dd')));
  const input = container.querySelector('input[name="fullName"]');
  expect(input.value).toBe('Original Name');
  await act(async () => Simulate.change(input, { target: { value: 'Updated Name' } }));
  await act(async () => Simulate.click(save()));
  expect(editing.save).toHaveBeenCalledWith({ fullName: 'Updated Name' });
  expect(container.querySelector('input')).toBeNull();
});
test('Escape cancels keyboard editing and preserves zero-valued custom fields', async () => {
  await render();
  await act(async () => Simulate.keyDown(container.querySelector('[data-record-field="customFields.budget"] dd'), { key: 'F2' }));
  const input = container.querySelector('input[name="customFields.budget"]');
  expect(input.value).toBe('0');
  await act(async () => Simulate.change(input, { target: { value: '100' } }));
  await act(async () => Simulate.keyDown(input, { key: 'Escape' }));
  expect(editing.save).not.toHaveBeenCalled();
  expect(container.querySelector('[data-record-field="customFields.budget"] dd').textContent).toBe('0');
});
test('invalid input stays open and a rejected save retains the user input', async () => {
  await render();
  await act(async () => Simulate.doubleClick(container.querySelector('[data-record-field="fullName"] dd')));
  const input = container.querySelector('input');
  await act(async () => Simulate.change(input, { target: { value: ' ' } }));
  await act(async () => Simulate.click(save()));
  expect(editing.save).not.toHaveBeenCalled();
  expect(input.getAttribute('aria-invalid')).toBe('true');
  editing.save.mockResolvedValue({ status: 400, data: { code: 'invalid', field: 'fullName' } });
  await act(async () => Simulate.change(input, { target: { value: 'Retain Me' } }));
  await act(async () => Simulate.click(save()));
  expect(container.querySelector('input').value).toBe('Retain Me');
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});
test('view-only permissions prevent double-click editing', async () => {
  editing.editable = false; await render();
  await act(async () => Simulate.doubleClick(container.querySelector('[data-record-field="fullName"] dd')));
  expect(container.querySelector('input')).toBeNull(); expect(editing.save).not.toHaveBeenCalled();
});
