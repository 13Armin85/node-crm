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
test('saved column order applies equally to estate headers and their record values', async () => {
  rows = [{ _id: 'residence-1', name: 'Garden Residence', city: 'Istanbul' }];
  definition = { moduleName: 'Residences', fields: [field('name'), field('city')] };
  localStorage.setItem('crm-table-columns::Residences', JSON.stringify({ hidden: [], order: ['city', 'name'] }));
  await render('Residences');
  expect([...container.querySelectorAll('th')].slice(0,2).map(item=>item.textContent)).toEqual(['city','name']);
  expect([...container.querySelectorAll('.crm-record-row td')].slice(0,2).map(item=>item.textContent)).toEqual(['Istanbul','Garden Residence']);
  expect(container.querySelector('table').getAttribute('dir')).toBe('ltr');
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
test('residence form preserves configured order and blocks incomplete or fractional counts before saving', async () => {
  rows = []; definition = { moduleName: 'Residences', fields: [field('name', 'text', { required: true }), field('city'), field('unitCount', 'number', { integer: true, min: 1 }), field('amenities', 'multiselect', { options: [{ value: 'POOL', label: { en: 'Pool' } }] }), field('phone'), field('notes')] };
  await render('Residences');
  await act(async () => Simulate.click(button('Add New')));
  expect([...document.querySelectorAll('.crm-dynamic-field')].map(item => item.dataset.fieldPath)).toEqual(['name', 'city', 'unitCount', 'amenities', 'phone', 'notes']);
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

test.each([false, true])('partner company details survive customer type changes before saving (editing: %s)', async editing => {
  const companyValues = { companyName: 'Example Company', contactPerson: 'Company Contact', taxNumber: '1234567890' };
  definition = { moduleName: 'Partner Customers', fields: [
    field('customerType', 'radio', { required: true, defaultValue: 'INDIVIDUAL', options: [
      { value: 'INDIVIDUAL', label: { en: 'Individual' } }, { value: 'COMPANY', label: { en: 'Company' } },
    ] }),
    field('fullName', 'text', { required: true, condition: { customerType: 'INDIVIDUAL' } }),
    ...Object.keys(companyValues).map(name => field(name, 'text', {
      required: name === 'companyName', condition: { customerType: 'COMPANY' },
    })),
    field('phone', 'phone'),
  ] };
  rows = editing ? [{ _id: 'partner-1', customerType: 'COMPANY', ...companyValues }] : [];
  await render('Partner Customers');
  await act(async () => Simulate.click(editing ? container.querySelector('button[aria-label="Edit"]') : button('Add New')));
  const selectType = async value => {
    const radio = document.querySelector('input[type="radio"][value="' + value + '"]');
    await act(async () => Simulate.change(radio, { target: { value, checked: true } }));
  };
  const fill = async (name, value) => {
    await act(async () => Simulate.change(document.querySelector('input[name="' + name + '"]'), { target: { value } }));
  };
  if (!editing) {
    await selectType('COMPANY');
    for (const [name, value] of Object.entries(companyValues)) await fill(name, value);
  }
  await fill('phone', '+905551234567');
  await selectType('INDIVIDUAL');
  expect(document.querySelector('input[name="companyName"]')).toBeNull();
  await fill('fullName', 'Individual Name');
  await selectType('COMPANY');
  for (const [name, value] of Object.entries(companyValues)) {
    expect(document.querySelector('input[name="' + name + '"]').value).toBe(value);
  }
  expect(document.querySelector('input[name="phone"]').value).toBe('+905551234567');
  await selectType('INDIVIDUAL');
  expect(document.querySelector('input[name="fullName"]').value).toBe('Individual Name');
  await selectType('COMPANY');
  await act(async () => Simulate.click(button('Save')));
  const payload = expect.objectContaining({ customerType: 'COMPANY', ...companyValues, phone: '+905551234567' });
  expect(editing ? putApi : postApi).toHaveBeenCalledWith(editing ? 'api/estate/Partner%20Customers/partner-1' : 'api/estate/Partner%20Customers', payload);
});

const agentId = '64d33173fd7ff3fa0924a101';
const ownerId = '64d33173fd7ff3fa0924a102';
const propertyDefinition = () => ({ moduleName: 'Properties', fields: [
  field('title', 'text', { required: true }),
  field('bedroom', 'select', { options: ['1+4', '4+2'].map(value => ({ value, label: { en: value } })) }),
  field('floor', 'select', { options: [{ value: '3', label: { en: '3' } }] }),
  field('propertyAgent', 'select', { label: { en: 'Assigned Property Agent' }, relation: 'Users' }),
  field('propertyOwner', 'select', { label: { en: 'Property Owner' }, relation: 'Contacts' }),
] });
const propertyApi = () => {
  definition = propertyDefinition();
  getApi.mockImplementation(async path => {
    if (path.includes('/definitions/Contacts')) return { status: 200, data: { moduleName: 'Contacts', fields: [field('fullName', 'text', { required: true }), field('email', 'email', { required: true }), field('phoneNumber', 'phone', { required: true })] } };
    if (path.includes('/definitions/')) return { status: 200, data: definition };
    if (path.includes('/options')) return { status: 200, data: path.includes('/Users/') ? [{ value: agentId, label: 'Assigned Agent' }] : [{ value: ownerId, label: 'Owner Name · +12345678' }] };
    return { status: 200, data: { items: rows, total: rows.length } };
  });
};
const fillProperty = async () => {
  for (const [name, value] of [['title', 'New Property'], ['bedroom', '1+4'], ['floor', '3']]) {
    await act(async () => Simulate.change(document.querySelector(`[name="${name}"]`), { target: { value } }));
  }
};
const chooseRelation = async (name, value) => {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
  await act(async () => Simulate.focus(document.querySelector(`[name="${name}"]`)));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
  const option = [...document.querySelectorAll('[role="option"]')].find(option => option.textContent.includes(value));
  expect(option).toBeDefined();
  await act(async () => Simulate.click(option));
};

test('property form saves 1+4 with searchable existing owner and assigned agent selections', async () => {
  rows = []; propertyApi(); await render('Properties');
  await act(async () => Simulate.click(button('Add New')));
  await fillProperty(); await chooseRelation('propertyAgent', 'Assigned Agent'); await chooseRelation('propertyOwner', 'Owner Name');
  await act(async () => Simulate.click(button('Save')));
  expect(postApi).toHaveBeenCalledTimes(1);
  expect(postApi).toHaveBeenCalledWith('api/estate/Properties', expect.objectContaining({ title: 'New Property', bedroom: '1+4', floor: '3', propertyAgent: agentId, propertyOwner: ownerId }));
}, 20000);

test('new property owner validates contact details, saves a reusable contact and selects it for the property', async () => {
  rows = []; propertyApi();
  postApi.mockImplementation(async path => ({ status: 201, data: path.endsWith('/owners') ? { _id: ownerId, fullName: 'New Owner' } : {} }));
  await render('Properties'); await act(async () => Simulate.click(button('Add New'))); await fillProperty();
  await act(async () => Simulate.click(button('Create New Property Owner')));
  await act(async () => Simulate.click(button('Save Contact and Select')));
  expect(postApi).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('Required');
  for (const [name, value] of [['fullName', 'New Owner'], ['email', 'owner@example.test'], ['phoneNumber', '+12345678']]) {
    await act(async () => Simulate.change(document.querySelector(`[name="${name}"]`), { target: { value } }));
  }
  await act(async () => Simulate.click(button('Save Contact and Select')));
  expect(postApi).toHaveBeenCalledWith('api/estate/Properties/owners', expect.objectContaining({ fullName: 'New Owner', email: 'owner@example.test', phoneNumber: '+12345678' }));
  await act(async () => Simulate.click(button('Save')));
  expect(postApi).toHaveBeenLastCalledWith('api/estate/Properties', expect.objectContaining({ bedroom: '1+4', propertyOwner: ownerId }));
}, 20000);

test('property table uses the assigned agent and populated references normalize back to IDs on edit', async () => {
  propertyApi(); rows = [{ _id: 'property-1', title: 'Existing Property', bedroom: '1+4', floor: '3',
    createBy: { firstName: 'Creator' }, propertyAgent: { _id: agentId, firstName: 'Assigned', lastName: 'Agent' },
    propertyOwner: { _id: ownerId, fullName: 'Owner Name' } }];
  await render('Properties');
  expect(container.textContent).toContain('Assigned Agent'); expect(container.textContent).not.toContain('Creator');
  await act(async () => Simulate.click(container.querySelector('button[aria-label="Edit"]')));
  expect(document.querySelector('[name="bedroom"]').value).toBe('1+4');
  await act(async () => Simulate.change(document.querySelector('[name="bedroom"]'), { target: { value: '4+2' } }));
  await act(async () => Simulate.click(button('Save')));
  expect(putApi).toHaveBeenCalledWith('api/estate/Properties/property-1', expect.objectContaining({ bedroom: '4+2', propertyAgent: agentId, propertyOwner: ownerId }));
}, 20000);
