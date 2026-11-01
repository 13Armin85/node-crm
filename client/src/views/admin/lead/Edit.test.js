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
test.each(['keep', 'replace', 'clear'])('editing a lead supports %s for the related property while keeping legacy customer relations', async action => {
  const id = '64d33173fd7ff3fa0924a101';
  const contact = { _id: '64d33173fd7ff3fa0924a102', fullName: 'Existing Contact' };
  const property = { _id: '64d33173fd7ff3fa0924a103', title: 'Existing Property' };
  const replacement = { value: '64d33173fd7ff3fa0924a104', label: 'Replacement Property' };
  const definition = { moduleName: 'Leads', fields: [
    { name: 'leadName', type: 'text', required: true, label: 'Lead Name' },
    { name: 'leadEmail', type: 'email', required: true, label: 'Lead Email' },
    ...['lead', 'contact', 'partnerCustomer', 'associatedListing', 'assignUser'].map(name => ({ name, kind: 'SYSTEM_FIELD', type: 'select', relation: name === 'associatedListing' ? 'Properties' : 'Contacts', label: name, external: true })),
  ] };
  localStorage.setItem('user', JSON.stringify({ _id: id, role: 'admin' }));
  getApi.mockImplementation(async path => ({ status: 200, data: path.includes('/definitions/') ? definition : path.includes('?id=') ? [{ value: property._id, label: property.title }] : [replacement] }));
  putApi.mockResolvedValue({ status: 200 });
  const onClose = jest.fn(), setAction = jest.fn();
  const container = document.createElement('div'); document.body.appendChild(container);
  try {
    await act(async () => { ReactDOM.render(<ChakraProvider><MemoryRouter><Edit isOpen onClose={onClose} setAction={setAction}
      moduleId={id} leadData={{ _id: id, moduleName: 'Leads', fields: [] }}
      data={{ _id: id, leadName: 'Original', leadEmail: '', contact, associatedListing: property }}
    /></MemoryRouter></ChakraProvider>, container); });
    expect(document.querySelectorAll('[id^="relation-"]')).toHaveLength(0);
    expect(document.querySelector('[name="associatedListing"]').value).toBe('Existing Property');
    if (action === 'clear') {
      await act(async () => Simulate.click(document.querySelector('button[aria-label="Clear selection"]')));
    }
    if (action === 'replace') {
      await act(async () => Simulate.focus(document.querySelector('[name="associatedListing"]')));
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
      const option = [...document.querySelectorAll('[role="option"]')].find(option => option.textContent === replacement.label);
      await act(async () => Simulate.click(option));
    }
    await act(async () => { const input = document.querySelector('#field-leadName'); input.value = ''; Simulate.change(input); });
    await act(async () => { Simulate.click(document.querySelector('button[type="submit"]')); });
    expect(putApi).toHaveBeenCalledWith(`api/form/edit/${id}`, expect.objectContaining({ leadName: '', leadEmail: '', contact: contact._id, moduleId: id,
      associatedListing: action === 'clear' ? null : action === 'replace' ? replacement.value : property._id }));
    expect(onClose).toHaveBeenCalled(); expect(setAction).toHaveBeenCalled();
  } finally {
    act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear();
  }
}, 20000);
