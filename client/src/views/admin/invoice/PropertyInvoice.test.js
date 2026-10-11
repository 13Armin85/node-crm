/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Test invoice entry, preview and submitted property details. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { LanguageProvider } from 'i18n';
import AddEdit from './AddEdit';
import { getApi, postApi } from 'services/api';
jest.mock('@chakra-ui/react', () => {
  const original = jest.requireActual('@chakra-ui/react');
  const Box = ({ children }) => <div>{children}</div>;
  return { ...original, Drawer: ({ isOpen, children }) => isOpen ? <div>{children}</div> : null,
    DrawerContent: Box, DrawerBody: Box, DrawerHeader: Box, DrawerFooter: Box, DrawerOverlay: () => null };
});
jest.mock('services/api', () => ({ getApi: jest.fn(), postApi: jest.fn(), putApi: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useDispatch: () => jest.fn(), useSelector: () => undefined }));
jest.mock('components/dynamicForm/DynamicFormRenderer', () => ({ ...jest.requireActual('components/dynamicForm/DynamicFormRenderer'),
  __esModule: true, AsyncRelationSelect: ({ value, onChange, name, moduleName }) => <select name={name} value={value || ''} onChange={event => onChange(event.target.value)}>
    <option value="">Select</option>{moduleName === 'Properties' && <option value="64d33173fd7ff3fa0924a109">Test home</option>}
  </select>,
}));
test('invoice entry infers rental type, previews the home, and submits the selected property', async () => {
  localStorage.setItem('user', JSON.stringify({ _id: 'admin', role: 'admin' }));
  const id = '64d33173fd7ff3fa0924a109';
  getApi.mockImplementation(async path => ({ status: 200, data: path.includes('/definitions/') ? { moduleName: 'Invoices', fields: [
    { name: 'title', kind: 'SYSTEM_FIELD', type: 'text', required: true, label: { en: 'Title' } },
    { name: 'property', kind: 'SYSTEM_FIELD', type: 'select', relation: 'Properties', label: { en: 'Property' } },
    { name: 'transactionType', kind: 'SYSTEM_FIELD', type: 'select', label: { en: 'Transaction Type' }, options: [{ value: 'SALE' }, { value: 'RENT' }] },
  ] } : path === `api/estate/Properties/${id}` ? { _id: id, title: 'Test home', transactionType: 'RENT' } : [] }));
  postApi.mockResolvedValue({ status: 200, data: {} });
  const container = document.createElement('div'); document.body.appendChild(container);
  const button = text => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === text);
  try {
    await act(async () => { ReactDOM.render(<ChakraProvider><LanguageProvider><AddEdit isOpen type="add" size="lg" onClose={jest.fn()} setAction={jest.fn()} /></LanguageProvider></ChakraProvider>, container); });
    expect(document.body.textContent).toContain('Title');
    await act(async () => Simulate.change(document.querySelector('input[name="title"]'), { target: { name: 'title', value: 'Rent invoice' } }));
    await act(async () => Simulate.change(document.querySelector('select[name="property"]'), { target: { value: id } }));
    expect(document.querySelector('select[name="transactionType"]').value).toBe('RENT');
    await act(async () => Simulate.click(button('Preview')));
    expect(document.querySelector('.invoice-details').textContent).toContain('Test home');
    expect(document.querySelector('.invoice-details').textContent).toContain('Rented');
    await act(async () => Simulate.click(button('Hide')));
    await act(async () => Simulate.click(button('Save')));
    expect(postApi).toHaveBeenCalledWith('api/invoices/add', expect.objectContaining({ title: 'Rent invoice', property: id, transactionType: 'RENT' }));
  } finally { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); }
});
