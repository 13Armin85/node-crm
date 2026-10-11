/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Verify table mutations and sectioned entity forms. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from 'i18n';
import { EntityPage } from './EntityPage';
import { getApi, postApi, putApi } from 'services/api';
import { HasAccess } from '../../../redux/accessUtils';
jest.mock('services/api', () => ({ getApi: jest.fn(), postApi: jest.fn(), putApi: jest.fn(), deleteApi: jest.fn() }));
jest.mock('../../../redux/accessUtils', () => ({ HasAccess: jest.fn() }));
jest.mock('components/ExcelExportButton', () => () => null);
jest.mock('components/ShareRecordButton', () => () => null);
jest.mock('components/SharedRecordBadge', () => () => null);
jest.mock('components/CurrencyAmount', () => ({ amount, currency }) => <span>{amount} {currency}</span>);
let container, definition, rows;
const field = (name, type = 'text', extra = {}) => ({ name, type, kind: 'SYSTEM_FIELD', label: { en: name }, enabled: true, ...extra });
const button = text => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === text);
const render = moduleName => act(async () => ReactDOM.render(<ChakraProvider><LanguageProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><EntityPage moduleName={moduleName} /></MemoryRouter></LanguageProvider></ChakraProvider>, container));
beforeEach(() => {
  jest.clearAllMocks(); localStorage.setItem('user', JSON.stringify({ role: 'admin' }));
  container = document.createElement('div'); document.body.appendChild(container);
  rows = [{ _id: 'partner-1', fullName: 'Alice', status: 'ACTIVE' }];
  HasAccess.mockReturnValue([{ create: true, update: true, delete: true }]);
  definition = { moduleName: 'Partner Customers', fields: [field('status', 'select', { label: { en: 'Status' }, options: [{ value: 'ACTIVE', label: { en: 'Active' } }, { value: 'CONTACTED', label: { en: 'Contacted' } }] })] };
  getApi.mockImplementation(async path => ({ status: 200, data: path.includes('/definitions/') ? definition : { items: rows, total: rows.length } }));
  putApi.mockImplementation(async (path, values) => { rows = rows.map(row => ({ ...row, ...values })); return { status: 200, data: rows[0] }; });
  postApi.mockResolvedValue({ status: 201, data: {} });
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); });
test('partner status dropdown saves from the table and displays the persisted value', async () => {
  await render('Partner Customers');
  const select = () => container.querySelector('select[aria-label="Status · Alice"]');
  expect([...select().options].map(option => option.value)).toEqual(['', 'ACTIVE', 'CONTACTED']);
  await act(async () => Simulate.change(select(), { target: { value: 'CONTACTED' } }));
  expect(putApi).toHaveBeenCalledWith('api/estate/Partner%20Customers/partner-1', { status: 'CONTACTED' });
  expect(select().value).toBe('CONTACTED'); expect(select().disabled).toBe(false);
});
test('a rejected status change retains the saved value and shows an error', async () => {
  putApi.mockResolvedValue({ response: { status: 400, data: { code: 'invalid', field: 'status' } } });
  await render('Partner Customers');
  const select = container.querySelector('select[aria-label="Status · Alice"]');
  await act(async () => Simulate.change(select, { target: { value: 'CONTACTED' } }));
  expect(select.value).toBe('ACTIVE'); expect(container.textContent).toContain('Please enter a valid value');
});
test('users without update permission see a disabled status dropdown', async () => {
  HasAccess.mockReturnValue([{ update: false }]); await render('Partner Customers');
  expect(container.querySelector('select[aria-label="Status · Alice"]').disabled).toBe(true);
  expect(putApi).not.toHaveBeenCalled();
});
test('residence form groups details and blocks incomplete or fractional counts before saving', async () => {
  rows = []; definition = { moduleName: 'Residences', fields: [field('name', 'text', { required: true }), field('city'), field('unitCount', 'number', { integer: true, min: 1 }), field('amenities', 'multiselect', { options: [{ value: 'POOL', label: { en: 'Pool' } }] }), field('phone'), field('notes')] };
  await render('Residences');
  await act(async () => Simulate.click(button('Add New')));
  expect(document.body.textContent).toContain('Building and Units'); expect(document.body.textContent).toContain('Management and Maintenance');
  await act(async () => Simulate.click(button('Save')));
  expect(postApi).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('Required');
  await act(async () => Simulate.change(document.querySelector('input[name="name"]'), { target: { value: 'Residence' } }));
  await act(async () => Simulate.change(document.querySelector('input[name="city"]'), { target: { value: 'Istanbul' } }));
  await act(async () => Simulate.change(document.querySelector('input[name="unitCount"]'), { target: { value: '2.5' } }));
  await act(async () => Simulate.click(button('Save')));
  expect(postApi).not.toHaveBeenCalled(); expect(document.querySelector('input[name="unitCount"]').getAttribute('aria-invalid')).toBe('true');
  await act(async () => Simulate.change(document.querySelector('input[name="unitCount"]'), { target: { value: '20' } }));
  await act(async () => Simulate.click(button('Save')));
  expect(postApi).toHaveBeenCalledWith('api/estate/Residences', expect.objectContaining({ name: 'Residence', city: 'Istanbul', unitCount: 20 }));
});

test('sold and rented residences show the transaction customer in the table', async () => {
  definition = { moduleName: 'Residences', fields: [field('name')] };
  rows = [{ _id: 'sold', name: 'Sold Residence', transactionType: 'SALE', sale: { status: 'SOLD', customerName: 'Buyer Company' } }, { _id: 'rented', name: 'Rented Residence', transactionType: 'RENT', sale: { status: 'RENTED', customerName: 'Tenant Name' } }];
  await render('Residences');
  expect(container.textContent).toContain('Sold to: Buyer Company'); expect(container.textContent).toContain('Rented to: Tenant Name');
});
test('older residence edits receive defaults for newly added transaction fields', async () => {
  rows = [{ _id: 'old', name: 'Older Residence' }];
  definition = { moduleName: 'Residences', fields: [field('name', 'text', { required: true }), field('transactionType', 'select', { required: true, defaultValue: 'SALE', options: [{ value: 'SALE', label: { en: 'For Sale' } }] }), field('sale.status', 'select', { required: true, defaultValue: 'AVAILABLE', options: [{ value: 'AVAILABLE', label: { en: 'Available' } }] })] };
  await render('Residences');
  await act(async () => Simulate.click(container.querySelector('button[aria-label="Edit"]')));
  expect(document.querySelector('select[name="transactionType"]').value).toBe('SALE');
  expect(document.querySelector('select[name="sale.status"]').value).toBe('AVAILABLE');
  await act(async () => Simulate.click(button('Save')));
  expect(putApi).toHaveBeenCalledWith('api/estate/Residences/old', expect.objectContaining({ transactionType: 'SALE', sale: { status: 'AVAILABLE' } }));
});
