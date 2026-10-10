/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises the actual sharing modal and recipient controls. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import ShareRecordButton from './ShareRecordButton';
import { getApi, postApi, deleteApi } from 'services/api';
import { toast } from 'react-toastify';
jest.mock('services/api', () => ({ getApi: jest.fn(), postApi: jest.fn(), deleteApi: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('i18n', () => ({ useLanguage: () => ({ t: value => value, direction: 'ltr' }) }));
const users = [
  { _id: 'one', firstName: 'علی', lastName: 'کریمی', username: 'ali@example.test' },
  { _id: 'two', firstName: 'İpek', lastName: 'Yılmaz', username: 'ipek@example.test' },
];
let container;
beforeEach(() => {
  jest.clearAllMocks(); localStorage.setItem('user', JSON.stringify({ role: 'admin', _id: 'admin' }));
  getApi.mockImplementation(async path => ({ status: 200, data: path.endsWith('/users') ? users : [] }));
  postApi.mockResolvedValue({ status: 201, data: { shared: true } });
  deleteApi.mockResolvedValue({ status: 200, data: { shared: false } });
  container = document.createElement('div'); document.body.appendChild(container);
});
afterEach(() => { act(() => ReactDOM.unmountComponentAtNode(container)); container.remove(); localStorage.clear(); });
const modal = () => document.querySelector('.crm-share-record-modal');
const button = name => [...modal().querySelectorAll('button')].find(item => item.textContent === name);
const render = () => act(() => ReactDOM.render(<ChakraProvider><ShareRecordButton module="Leads" record={{ _id: 'record' }} /></ChakraProvider>, container));
const open = () => act(async () => Simulate.click(container.querySelector('.crm-share-record-button')));
const choose = value => act(async () => Simulate.change(modal().querySelector('select'), { target: { value } }));

test('admins send a single record to the selected user and can revoke exactly that grant', async () => {
  render(); await open();
  await act(async () => Simulate.change(modal().querySelector('input'), { target: { value: 'IPEK YILMAZ' } }));
  expect([...modal().querySelectorAll('option')].map(item => item.value)).toEqual(['', 'two']);
  await choose('two'); await act(async () => Simulate.click(button('Send')));
  expect(postApi).toHaveBeenCalledWith('api/record-sharing', { module: 'Leads', recordId: 'record', recipientId: 'two' });
  expect(toast.success).toHaveBeenCalledWith('Item sent to user');
  expect(button('Send')).toBeUndefined();
  expect(modal().textContent).toContain('This item has already been sent to this user');
  await act(async () => Simulate.click(button('Revoke access')));
  expect(deleteApi).toHaveBeenCalledWith('api/record-sharing/Leads/record/', 'two');
  expect(button('Send')).toBeDefined();
});

test('a failed send leaves the recipient available for retry and never claims success', async () => {
  postApi.mockResolvedValueOnce({ status: 500 });
  render(); await open();
  await act(async () => Simulate.change(modal().querySelector('input'), { target: { value: 'علي كريمي' } }));
  expect([...modal().querySelectorAll('option')].map(item => item.value)).toEqual(['', 'one']);
  await choose('one'); await act(async () => Simulate.click(button('Send')));
  expect(toast.success).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith('Failed to send item');
  expect(button('Revoke access')).toBeUndefined();
  await act(async () => Simulate.click(button('Send')));
  expect(toast.success).toHaveBeenCalledWith('Item sent to user');
});

test('ordinary users have no sending action or recipient directory request', () => {
  localStorage.setItem('user', JSON.stringify({ role: 'user', _id: 'one' }));
  render();
  expect(container.querySelector('.crm-share-record-button')).toBeNull();
  expect(getApi).not.toHaveBeenCalled();
});
