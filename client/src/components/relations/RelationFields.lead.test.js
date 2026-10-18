/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises relation visibility and submitted values. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { useFormik } from 'formik';
import { getApi } from 'services/api';
import { normalizeFormValues, validateFormValues } from 'utils/managedForm';
import RelationFields from './RelationFields';
import { LanguageProvider } from 'i18n';

jest.mock('services/api', () => ({ getApi: jest.fn() }));
const ids = { lead: '64d33173fd7ff3fa0924a101', contact: '64d33173fd7ff3fa0924a102', partnerCustomer: '64d33173fd7ff3fa0924a103' };
const definition = { moduleName: 'Leads', fields: [
  { name: 'lead', type: 'select', relation: 'Leads', external: true, required: true },
  { name: 'contact', type: 'select', relation: 'Contacts', external: true, required: true },
  { name: 'partnerCustomer', type: 'select', relation: 'Partner Customers', external: true, required: true },
] };
let container;
function Harness({ onSubmit, moduleName = 'Leads' }) {
  const activeDefinition = { ...definition, moduleName };
  const formik = useFormik({
    initialValues: { lead: null, contact: null, partnerCustomer: null },
    validate: values => validateFormValues(activeDefinition, values),
    onSubmit: values => onSubmit(normalizeFormValues(activeDefinition, values)),
  });
  return <><RelationFields definition={activeDefinition} formik={formik} values={formik.values} setFieldValue={formik.setFieldValue} lead contact partner />
    <button id="save-relations" onClick={formik.handleSubmit}>Save</button></>;
}
beforeEach(() => {
  getApi.mockImplementation(async path => ({ status: 200, data: path === 'api/lead' ? [{ _id: ids.lead, leadName: 'Lead' }]
    : path === 'api/contact' ? [{ _id: ids.contact, fullName: 'Contact' }] : { items: [{ _id: ids.partnerCustomer, fullName: 'Partner' }] } }));
  container = document.createElement('div'); document.body.appendChild(container);
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.removeItem('crm-language'); });
const choose = async (name, value) => {
  const input = document.querySelector('#relation-' + name);
  if (!value) {
    await act(async () => Simulate.click(input.parentElement.querySelector('button')));
    return;
  }
  await act(async () => Simulate.focus(input));
  const option = [...document.querySelectorAll('[role=option]')].find(option => option.id.startsWith('relation-' + name + '-option-'));
  await act(async () => Simulate.click(option));
};

test.each(['lead', 'contact', 'partnerCustomer'])('selecting only %s saves successfully and hides both other options', async name => {
  const onSubmit = jest.fn();
  await act(async () => { ReactDOM.render(<ChakraProvider><Harness onSubmit={onSubmit} /></ChakraProvider>, container); });
  await choose(name, ids[name]);
  for (const other of Object.keys(ids).filter(key => key !== name)) {
    expect(document.querySelector('#relation-' + other)).toBeNull();
  }
  await act(async () => { Simulate.click(document.querySelector('#save-relations')); });
  expect(onSubmit).toHaveBeenLastCalledWith({ lead: null, contact: null, partnerCustomer: null, [name]: ids[name] });
  await choose(name, '');
  for (const key of Object.keys(ids)) expect(document.querySelector('#relation-' + key)).not.toBeNull();
});
test('other CRM forms retain independent lead, contact and partner selections', async () => {
  const onSubmit = jest.fn();
  await act(async () => { ReactDOM.render(<ChakraProvider><Harness moduleName="Opportunities" onSubmit={onSubmit} /></ChakraProvider>, container); });
  await choose('lead', ids.lead);
  await choose('contact', ids.contact);
  await choose('partnerCustomer', ids.partnerCustomer);
  await act(async () => { Simulate.click(document.querySelector('#save-relations')); });
  expect(onSubmit).toHaveBeenLastCalledWith(ids);
});


test.each([
  ['en', 'Select exactly one: a lead, a partner customer, or a contact.'],
  ['fa', 'فقط یکی از سرنخ، مشتری همکار یا مخاطب را انتخاب کنید.'],
  ['tr', 'Yalnızca birini seçin: müşteri adayı, iş ortağı müşterisi veya kişi.'],
])('an empty selection shows the required choice in %s and either contact or partner alone can be saved', async (language, message) => {
  localStorage.setItem('crm-language', language);
  const onSubmit = jest.fn();
  await act(async () => { ReactDOM.render(<ChakraProvider><LanguageProvider><Harness onSubmit={onSubmit} /></LanguageProvider></ChakraProvider>, container); });
  expect(document.querySelector('[data-testid="lead-selection-error"]')).toBeNull();
  await act(async () => { Simulate.click(document.querySelector('#save-relations')); });
  expect(onSubmit).not.toHaveBeenCalled();
  expect(document.querySelector('[data-testid="lead-selection-error"]').textContent).toBe(message);
  await choose('contact', ids.contact);
  await act(async () => { Simulate.click(document.querySelector('#save-relations')); });
  expect(onSubmit).toHaveBeenLastCalledWith({ lead: null, contact: ids.contact, partnerCustomer: null });
  expect(document.querySelector('[data-testid="lead-selection-error"]')).toBeNull();
  await choose('contact', '');
  await act(async () => { Simulate.click(document.querySelector('#save-relations')); });
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[data-testid="lead-selection-error"]').textContent).toBe(message);
  await choose('partnerCustomer', ids.partnerCustomer);
  await act(async () => { Simulate.click(document.querySelector('#save-relations')); });
  expect(onSubmit).toHaveBeenLastCalledWith({ lead: null, contact: null, partnerCustomer: ids.partnerCustomer });
  expect(document.querySelector('[data-testid="lead-selection-error"]')).toBeNull();
});
