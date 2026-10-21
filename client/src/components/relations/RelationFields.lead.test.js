/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { useFormik } from 'formik';
import { getApi } from 'services/api';
import { normalizeFormValues, validateFormValues } from 'utils/managedForm';
import RelationFields from './RelationFields';
jest.mock('services/api', () => ({ getApi: jest.fn() }));
const ids = { lead: '64d33173fd7ff3fa0924a101', contact: '64d33173fd7ff3fa0924a102', partnerCustomer: '64d33173fd7ff3fa0924a103' };
const definition = { moduleName: 'Leads', fields: Object.keys(ids).map(name => ({ name, type: 'select', relation: 'Contacts', external: true, required: true })) };
let container;
function Harness({ onSubmit, moduleName = 'Leads' }) {
  const activeDefinition = { ...definition, moduleName };
  const formik = useFormik({ initialValues: { lead: null, contact: null, partnerCustomer: null },
    validate: values => validateFormValues(activeDefinition, values), onSubmit: values => onSubmit(normalizeFormValues(activeDefinition, values)) });
  return <><RelationFields definition={activeDefinition} formik={formik} values={formik.values} setFieldValue={formik.setFieldValue} lead contact partner />
    <button id="save-relations" onClick={formik.handleSubmit}>Save</button></>;
}
beforeEach(() => {
  getApi.mockImplementation(async path => ({ status: 200, data: path === 'api/lead' ? [{ _id: ids.lead, leadName: 'Lead' }]
    : path === 'api/contact' ? [{ _id: ids.contact, fullName: 'Contact' }] : { items: [{ _id: ids.partnerCustomer, fullName: 'Partner' }] } }));
  container = document.createElement('div'); document.body.appendChild(container);
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); });
test('lead forms have no customer pickers or required selection', async () => {
  const onSubmit = jest.fn();
  await act(async () => { ReactDOM.render(<ChakraProvider><Harness onSubmit={onSubmit} /></ChakraProvider>, container); });
  expect(document.querySelectorAll('[id^="relation-"]')).toHaveLength(0);
  await act(async () => { Simulate.click(document.querySelector('#save-relations')); });
  expect(onSubmit).toHaveBeenCalledWith({ lead: null, contact: null, partnerCustomer: null });
  expect(document.querySelector('[data-testid="lead-selection-error"]')).toBeNull();
});
test('other CRM forms retain independent lead, contact and partner selections', async () => {
  const onSubmit = jest.fn();
  await act(async () => { ReactDOM.render(<ChakraProvider><Harness moduleName="Opportunities" onSubmit={onSubmit} /></ChakraProvider>, container); });
  for (const name of Object.keys(ids)) {
    await act(async () => { Simulate.focus(document.querySelector('#relation-' + name)); });
    const option = [...document.querySelectorAll('[role=option]')].find(option => option.id.startsWith('relation-' + name + '-option-'));
    await act(async () => { Simulate.click(option); });
  }
  await act(async () => { Simulate.click(document.querySelector('#save-relations')); });
  expect(onSubmit).toHaveBeenCalledWith(ids);
});
