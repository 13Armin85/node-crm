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
  { name: 'listedFor', kind: 'SYSTEM_FIELD', type: 'select', label: 'Transaction Type', options: [
    { value: 'Rent', label: 'Rent' }, { value: 'Buy', label: 'Sale' },
  ] },
  ...['lead', 'contact', 'partnerCustomer', 'associatedListing', 'assignUser'].map(name => ({
    name, kind: 'SYSTEM_FIELD', type: 'select', relation: name === 'associatedListing' ? 'Properties' : 'Contacts', label: name === 'associatedListing' ? 'Related Property' : name, required: true, external: true,
  })),
] };
let container;
beforeEach(() => {
  localStorage.setItem('user', JSON.stringify({ _id: '64d33173fd7ff3fa0924a101', role: 'user' }));
  getApi.mockReset(); postApi.mockReset();
  getApi.mockImplementation(async path => ({ status: 200, data: path.includes('/definitions/') ? definition : [{ value: '64d33173fd7ff3fa0924a111', label: 'Selected Property' }] }));
  postApi.mockResolvedValue({ status: 200 });
  container = document.createElement('div'); document.body.appendChild(container);
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); });
const render = async onClose => act(async () => { ReactDOM.render(<ChakraProvider><Add isOpen onClose={onClose}
  setAction={jest.fn()} leadData={{ _id: 'module', moduleName: 'Leads', fields: [] }} /></ChakraProvider>, container); });
test('a user can save an independent lead without selecting a property or any existing customer', async () => {
  const close = jest.fn();
  await render(close);
  expect(document.querySelectorAll('.crm-record-form [role="combobox"]')).toHaveLength(1);
  expect(document.querySelector('[name="associatedListing"]')).not.toBeNull();
  expect(document.querySelectorAll('.crm-record-form [required]')).toHaveLength(0);
  await act(async () => { Simulate.click(document.querySelector('.crm-record-form button[type="submit"]')); });
  expect(postApi).toHaveBeenCalledWith('api/form/add', expect.objectContaining({ moduleId: 'module', lead: null, contact: null, partnerCustomer: null }));
  expect(close).toHaveBeenCalled();
  expect(getApi.mock.calls.every(([path]) => path.includes('/definitions/') || path.includes('/Properties/options'))).toBe(true);
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

test('the searchable property list saves the selected property as the related listing', async () => {
  const close = jest.fn(); await render(close);
  const transaction = document.querySelector('[name="listedFor"]');
  expect([...transaction.options].map(option => option.textContent)).toEqual(['Select', 'Rent', 'Sale']);
  await act(async () => Simulate.change(transaction, { target: { value: 'Buy' } }));
  await act(async () => { Simulate.focus(document.querySelector('[name="associatedListing"]')); });
  await act(async () => { Simulate.change(document.querySelector('[name="associatedListing"]'), { target: { value: 'Selected' } }); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
  expect(getApi).toHaveBeenCalledWith('api/estate/Properties/options?q=Selected');
  const option = [...document.querySelectorAll('[role="option"]')].find(option => option.textContent === 'Selected Property');
  expect(option).toBeDefined();
  await act(async () => Simulate.click(option));
  await act(async () => Simulate.click(document.querySelector('.crm-record-form button[type="submit"]')));
  expect(postApi).toHaveBeenCalledWith('api/form/add', expect.objectContaining({ listedFor: 'Buy', associatedListing: '64d33173fd7ff3fa0924a111' }));
  expect(close).toHaveBeenCalled();
}, 20000);
