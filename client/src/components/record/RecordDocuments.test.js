/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercise document display, downloads and post-upload refresh. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { LanguageProvider } from 'i18n';
import { deleteApi, downloadApiFile, getApi, postApi } from 'services/api';
import RecordDocuments from './RecordDocuments';

jest.mock('services/api', () => ({ getApi: jest.fn(), postApi: jest.fn(), deleteApi: jest.fn(), downloadApiFile: jest.fn() }));
jest.mock('views/admin/document/component/Upload', () => props => <input aria-label="Test document file" type="file"
  onChange={event => props.onFileSelect(Array.from(event.target.files))} />);
const recordId = '6ae1b409f48a9ea51d6dc631';
const definition = { moduleName: 'Documents', fields: [
  { name: 'folderName', kind: 'SYSTEM_FIELD', type: 'text', required: true, label: { en: 'Folder Name' } },
  { name: 'reference', kind: 'CUSTOM_FIELD', type: 'text', label: { en: 'Reference number' } },
] };
let container, folders, confirm;
const fixture = entityType => [{ _id: 'folder', folderName: 'Contracts', files: [{ _id: 'file', fileName: 'Agreement.pdf', mimeType: 'application/pdf', size: 2048,
  entityType, entityId: recordId, relatedRecords: [{ entityType, entityId: recordId, label: 'Related customer or opportunity' },
    { entityType: 'Property', entityId: 'property', label: 'Garden Villa' }], customFields: { reference: 'DOC-123', pages: 0, signed: false } }] }];
const render = moduleName => act(async () => ReactDOM.render(<ChakraProvider><LanguageProvider>
  <RecordDocuments moduleName={moduleName} recordId={recordId} />
</LanguageProvider></ChakraProvider>, container));
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); localStorage.setItem('user', JSON.stringify({ _id: 'admin', role: 'admin' }));
  folders = [];
  getApi.mockImplementation(async path => ({ status: 200, data: path.includes('/definitions/') ? definition : path.startsWith('api/document/?') ? folders : [] }));
  downloadApiFile.mockResolvedValue({ status: 200 });
  deleteApi.mockReset(); deleteApi.mockResolvedValue({ status: 200 });
  confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  container = document.createElement('div'); document.body.appendChild(container);
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); confirm.mockRestore(); });

test.each([['Leads', 'Lead'], ['Contacts', 'Contact'], ['Opportunities', 'Opportunity']])('%s shows the sidebar document card with saved details, names and a direct download', async (moduleName, entityType) => {
  folders = fixture(entityType);
  await render(moduleName);
  expect(getApi).toHaveBeenCalledWith(`api/document/?entityType=${entityType}&entityId=${recordId}`);
  const card = container.querySelector('.crm-document-card');
  for (const value of ['Agreement.pdf', '2 KB', moduleName, 'Contracts', 'Related customer or opportunity', 'Garden Villa', 'Reference number', 'DOC-123', '0', 'false']) {
    expect(card.textContent).toContain(value);
  }
  expect(card.textContent).not.toContain(recordId);
  await act(async () => Simulate.click(card.querySelector('button[aria-label="Download"]')));
  expect(downloadApiFile).toHaveBeenCalledWith('api/document/download/file', 'Agreement.pdf');
});

test('uploading from a contact immediately refreshes its complete document card with its relation and custom values', async () => {
  postApi.mockImplementation(async () => { folders = fixture('Contact'); return { status: 200, data: {} }; });
  await render('Contacts');
  expect(container.querySelector('.crm-document-card')).toBeNull();
  await act(async () => Simulate.click([...container.querySelectorAll('button')].find(button => button.textContent === 'Add Document')));
  const modal = document.querySelector('[role="dialog"]');
  await act(async () => Simulate.change(modal.querySelector('input[name="folderName"]'), { target: { name: 'folderName', value: 'Contracts' } }));
  await act(async () => Simulate.change(modal.querySelector('input[type="file"]'), { target: { files: [new File(['document'], 'Agreement.pdf', { type: 'application/pdf' })] } }));
  await act(async () => Simulate.click([...modal.querySelectorAll('button')].find(button => button.textContent === 'Save')));
  const [route, payload] = postApi.mock.calls[0];
  expect(route).toBe('api/document/add');
  expect(payload.get('entityType')).toBe('Contact'); expect(payload.get('entityId')).toBe(recordId);
  expect(payload.get('linkContact')).toBe(recordId); expect(payload.get('files').name).toBe('Agreement.pdf');
  expect(container.querySelector('.crm-document-information').textContent).toContain('Related customer or opportunity');
  expect(container.querySelector('.crm-document-information').textContent).toContain('DOC-123');
});

test('unfiled documents use the same storage label as the sidebar and failed downloads remain retryable', async () => {
  folders = fixture('Lead'); folders[0].isRoot = true; folders[0].folderName = '__ROOT__';
  await render('Leads');
  expect(container.querySelector('.crm-document-information').textContent).toContain('Files without folder');
  expect(container.textContent).not.toContain('__ROOT__');
  downloadApiFile.mockResolvedValueOnce({ status: 404 });
  const download = container.querySelector('button[aria-label="Download"]');
  await act(async () => Simulate.click(download));
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => Simulate.click(download));
  expect(downloadApiFile).toHaveBeenCalledTimes(2);
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test('lead detail uploads can omit a folder even when the folder schema requires its name', async () => {
  postApi.mockImplementation(async () => { folders = fixture('Lead'); folders[0].isRoot = true; return { status: 200 }; });
  await render('Leads');
  await act(async () => Simulate.click([...container.querySelectorAll('button')].find(button => button.textContent === 'Add Document')));
  const modal = document.querySelector('[role="dialog"]');
  expect(modal.querySelector('input[name="folderName"]').getAttribute('aria-required')).not.toBe('true');
  await act(async () => Simulate.change(modal.querySelector('input[type="file"]'), { target: { files: [new File(['lead document'], 'lead.txt', { type: 'text/plain' })] } }));
  await act(async () => Simulate.click([...modal.querySelectorAll('button')].find(button => button.textContent === 'Save')));
  expect(postApi).toHaveBeenCalledTimes(1);
  const payload = postApi.mock.calls[0][1];
  expect(payload.get('folderName')).toBe(''); expect(payload.get('filename')).toBe('');
  expect(payload.get('entityType')).toBe('Lead'); expect(payload.get('linkLead')).toBe(recordId);
  expect(payload.get('entityId')).toBe(recordId); expect(payload.has('linkContact')).toBe(false);
  expect(container.querySelector('.crm-document-information').textContent).toContain('Files without folder');
});

test('lead upload failures show the server reason in the form and keep the selected file for retry', async () => {
  postApi.mockResolvedValue({ status: 409, data: { code: 'duplicate', field: 'files' } });
  await render('Leads');
  await act(async () => Simulate.click([...container.querySelectorAll('button')].find(button => button.textContent === 'Add Document')));
  const modal = document.querySelector('[role="dialog"]');
  await act(async () => Simulate.change(modal.querySelector('input[type="file"]'), { target: { files: [new File(['lead document'], 'lead.txt', { type: 'text/plain' })] } }));
  const save = [...modal.querySelectorAll('button')].find(button => button.textContent === 'Save');
  await act(async () => Simulate.click(save));
  expect(modal.textContent).toContain('This record already exists. Duplicate entries are not allowed.');
  postApi.mockResolvedValueOnce({ status: 200 });
  await act(async () => Simulate.click(save));
  expect(postApi).toHaveBeenCalledTimes(2);
  expect(postApi.mock.calls[1][1].get('files').name).toBe('lead.txt');
});

test.each([['Leads', 'Lead'], ['Contacts', 'Contact'], ['Opportunities', 'Opportunity']])('%s deletes the original document and refreshes its list', async (moduleName, entityType) => {
  folders = fixture(entityType);
  deleteApi.mockImplementation(async () => { folders = []; return { status: 200 }; });
  await render(moduleName);
  await act(async () => Simulate.click(container.querySelector('button[aria-label="Delete"]')));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Agreement.pdf'));
  expect(deleteApi).toHaveBeenCalledWith('api/document/delete/', 'file');
  expect(container.querySelector('.crm-document-card')).toBeNull();
});

test('cancelled or unsuccessful deletions preserve the document, and foreign files remain download-only', async () => {
  folders = fixture('Lead');
  await render('Leads');
  confirm.mockReturnValueOnce(false);
  await act(async () => Simulate.click(container.querySelector('button[aria-label="Delete"]')));
  expect(deleteApi).not.toHaveBeenCalled();
  deleteApi.mockResolvedValueOnce({ status: 500 });
  await act(async () => Simulate.click(container.querySelector('button[aria-label="Delete"]')));
  expect(container.querySelector('.crm-document-card')).not.toBeNull(); expect(container.querySelector('[role="alert"]')).not.toBeNull();
  localStorage.setItem('user', JSON.stringify({ _id: 'viewer', role: 'user' }));
  folders[0].createBy = { _id: 'owner' };
  await render('Leads');
  expect(container.querySelector('button[aria-label="Delete"]')).toBeNull();
  expect(container.querySelector('button[aria-label="Download"]')).not.toBeNull();
});

test('a deletion in another browser tab refreshes an already open record document list', async () => {
  folders = fixture('Contact'); await render('Contacts');
  folders = [];
  await act(async () => window.dispatchEvent(new StorageEvent('storage', { key: 'crm:documents-changed', newValue: 'changed' })));
  expect(container.querySelector('.crm-document-card')).toBeNull();
});
