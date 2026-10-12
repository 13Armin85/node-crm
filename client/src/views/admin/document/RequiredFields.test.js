/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Test document dialogs and submitted multipart data. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import DocumentPage from './index';
import { LanguageProvider } from 'i18n';
import { getApi, postApi } from 'services/api';
jest.mock('services/api', () => ({ getApi: jest.fn(), postApi: jest.fn(), deleteApi: jest.fn(), getApiBlob: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('components/ExcelExportButton', () => () => null);
jest.mock('./component/Upload', () => ({ onFileSelect }) => <button onClick={() => onFileSelect([new File(['hello'], 'test.txt')])}>Choose test file</button>);
const button = text => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === text);
let container;
beforeEach(() => {
  jest.clearAllMocks(); localStorage.setItem('user', JSON.stringify({ role: 'admin', _id: 'admin' }));
  getApi.mockImplementation(async path => ({ status: 200, data: path.includes('/definitions/') ? { moduleName: 'Documents', fields: [
    { name: 'reference', kind: 'CUSTOM_FIELD', type: 'text', required: true, label: { en: 'Reference' }, validationMessage: { en: 'Enter the reference' } },
  ] } : [] }));
  postApi.mockResolvedValue({ status: 200, data: {} });
  container = document.createElement('div'); document.body.appendChild(container);
});
const render = async () => act(async () => { ReactDOM.render(<ChakraProvider><LanguageProvider><DocumentPage /></LanguageProvider></ChakraProvider>, container); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); });
test('an empty folder name shows an error beneath the input', async () => {
  await render();
  await act(async () => Simulate.click(button('New folder')));
  await act(async () => Simulate.click(button('Create folder')));
  expect(postApi).not.toHaveBeenCalled();
  expect(document.querySelector('input[aria-invalid="true"]')).not.toBeNull();
  expect(document.body.textContent).toContain('Required');
});
test('required document metadata blocks upload until filled and is included in multipart data', async () => {
  await render();
  await act(async () => Simulate.click(button('Upload document')));
  await act(async () => Simulate.click(button('Choose test file')));
  await act(async () => Simulate.click(button('Upload 1 Files')));
  expect(postApi).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('Enter the reference');
  await act(async () => Simulate.change(document.querySelector('input[name="customFields.reference"]'), { target: { value: 'DOC-1' } }));
  await act(async () => Simulate.click(button('Upload 1 Files')));
  expect(postApi).toHaveBeenCalledWith('api/document/add', expect.any(FormData));
  expect(JSON.parse(postApi.mock.calls[0][1].get('customFields'))).toEqual({ reference: 'DOC-1' });
});
