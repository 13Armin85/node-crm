/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { getApi, postApi } from 'services/api';
import Add from './Add';
jest.mock('services/api', () => ({ getApi: jest.fn(), postApi: jest.fn() }));
const definition = { moduleName: 'Leads', fields: [
  { name: 'leadName', type: 'text', required: true, label: 'Lead Name' },
  { name: 'leadEmail', type: 'email', required: true, label: 'Lead Email' },
  { name: 'score', kind: 'CUSTOM_FIELD', type: 'number', required: true, label: 'Score' },
  ...['lead', 'contact', 'partnerCustomer', 'associatedListing', 'assignUser'].map(name => ({
    name, kind: 'SYSTEM_FIELD', type: 'select', relation: 'Contacts', required: true, external: true,
  })),
] };
let container;
beforeEach(() => {
  localStorage.setItem('user', JSON.stringify({ _id: '64d33173fd7ff3fa0924a101', role: 'user' }));
  getApi.mockReset(); postApi.mockReset();
  getApi.mockResolvedValue({ status: 200, data: definition });
  postApi.mockResolvedValue({ status: 200 });
  container = document.createElement('div'); document.body.appendChild(container);
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); });
const render = async onClose => act(async () => { ReactDOM.render(<ChakraProvider><Add isOpen onClose={onClose}
  setAction={jest.fn()} leadData={{ _id: 'module', moduleName: 'Leads', fields: [] }} /></ChakraProvider>, container); });
test('a user saves an empty independent lead despite legacy required fields, without fetching any existing people or properties', async () => {
  const close = jest.fn();
  await render(close);
  expect(document.querySelectorAll('[id^="relation-"], .crm-record-form [role="combobox"]')).toHaveLength(0);
  expect(document.querySelectorAll('.crm-record-form [required]')).toHaveLength(0);
  await act(async () => { Simulate.click(document.querySelector('.crm-record-form button[type="submit"]')); });
  expect(postApi).toHaveBeenCalledWith('api/form/add', expect.objectContaining({ moduleId: 'module', lead: null, contact: null, partnerCustomer: null }));
  expect(close).toHaveBeenCalled();
  expect(getApi.mock.calls.every(([path]) => path.includes('/definitions/'))).toBe(true);
});
test('populated optional fields still validate their format', async () => {
  await render(jest.fn());
  await act(async () => {
    const input = document.querySelector('#field-leadEmail');
    input.value = 'invalid-email'; Simulate.change(input);
  });
  await act(async () => { Simulate.click(document.querySelector('.crm-record-form button[type="submit"]')); });
  expect(postApi).not.toHaveBeenCalled();
});
