/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { getApi, putApi } from 'services/api';
import Edit from './Edit';

jest.mock('services/api', () => ({ getApi: jest.fn(), putApi: jest.fn() }));
jest.mock('react-redux', () => ({ useDispatch: () => jest.fn() }));
jest.mock('components/commonTableModel/UserModel', () => () => null);
jest.mock('components/commonTableModel/SelectPorpertyModel', () => () => null);

test('a loaded lead shows saved relations and Save submits edited values with relation IDs', async () => {
  const id = '64d33173fd7ff3fa0924a101';
  const contact = { _id: '64d33173fd7ff3fa0924a102', fullName: 'علی رضایی', email: 'ali@example.com' };
  const relatedLead = { _id: '64d33173fd7ff3fa0924a104', leadName: 'Related lead', leadEmail: 'related@example.com' };
  const anotherLead = { _id: '64d33173fd7ff3fa0924a105', leadName: 'Another lead' };
  const partner = { _id: '64d33173fd7ff3fa0924a103', fullName: 'Partner' };
  const definition = { moduleName: 'Leads', fields: [
    { name: 'leadName', type: 'text', required: true, label: 'Lead Name' },
    { name: 'leadEmail', type: 'email', required: true, label: 'Lead Email' },
    { name: 'lead', type: 'select', relation: 'Leads', external: true },
    { name: 'contact', type: 'select', relation: 'Contacts', external: true },
    { name: 'partnerCustomer', type: 'select', relation: 'Partner Customers', external: true },
    { name: 'associatedListing', type: 'select', relation: 'Properties', external: true },
    { name: 'assignUser', type: 'select', relation: 'Users', external: true },
  ] };
  localStorage.setItem('user', JSON.stringify({ _id: id, role: 'admin' }));
  getApi.mockImplementation(async path => ({ status: 200, data:
    path.includes('/definitions/') ? definition : path === 'api/lead' ? [relatedLead, anotherLead, { _id: id, leadName: 'Original' }] : path === 'api/contact' ? [contact]
      : path.includes('Partner%20Customers') ? { items: [partner] } : [],
  }));
  putApi.mockResolvedValue({ status: 200 });
  const onClose = jest.fn();
  const setAction = jest.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  try {
    await act(async () => {
      ReactDOM.render(<ChakraProvider><MemoryRouter><Edit isOpen size="lg" onClose={onClose} setAction={setAction}
        moduleId={id} leadData={{ _id: id, moduleName: 'Leads', fields: [{ name: 'hiddenLegacyField', validation: [{ require: true }] }] }}
        data={{ _id: id, leadName: 'Original', leadEmail: 'lead@example.com', lead: relatedLead, contact, partnerCustomer: partner, associatedListing: null }}
      /></MemoryRouter></ChakraProvider>, container);
    });
    expect(document.querySelector('#relation-lead').value).toBe(relatedLead.leadName);
    await act(async () => Simulate.focus(document.querySelector('#relation-lead')));
    expect([...document.querySelectorAll('[role=option]')].some(option => option.textContent === 'Original')).toBe(false);
    await act(async () => Simulate.keyDown(document.querySelector('#relation-lead'), { key: 'Escape' }));
    await act(async () => Simulate.focus(document.querySelector('#relation-lead')));
    await act(async () => Simulate.click([...document.querySelectorAll('[role=option]')].find(option => option.textContent === anotherLead.leadName)));
    expect(document.querySelector('#relation-contact')).toBeNull();
    expect(document.querySelector('#relation-partnerCustomer')).toBeNull();
    await act(async () => {
      const input = document.querySelector('#field-leadName');
      input.value = 'Updated';
      Simulate.change(input);
    });
    await act(async () => { Simulate.click(document.querySelector('button[type="submit"]')); });
    expect(putApi).toHaveBeenCalledWith(`api/form/edit/${id}`, expect.objectContaining({
      leadName: 'Updated', lead: anotherLead._id, contact: null, partnerCustomer: null, associatedListing: null, moduleId: id,
    }));
    expect(onClose).toHaveBeenCalled();
    expect(setAction).toHaveBeenCalled();
  } finally {
    act(() => { ReactDOM.unmountComponentAtNode(container); });
    container.remove();
    localStorage.clear();
  }
});
