/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises document actions and modal payloads. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import DocumentPage from './index';
import { LanguageProvider } from 'i18n';
import { getApi, postApi } from 'services/api';
import { toast } from 'react-toastify';
jest.mock('services/api', () => ({ getApi: jest.fn(), postApi: jest.fn(), deleteApi: jest.fn(), getApiBlob: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const folders = [
  { _id: 'root', isRoot: true, createBy: 'admin', files: [{ _id: 'root-file', fileName: 'Root.txt' }] },
  { _id: 'parent', folderName: 'Parent', createBy: 'admin', files: [{ _id: 'folder-file', fileName: 'Inside.txt' }] },
  { _id: 'child', folderName: 'Child', parentFolder: 'parent', createBy: 'admin', files: [] },
  { _id: 'sibling', folderName: 'Sibling', createBy: 'admin', files: [] },
  { _id: 'foreign', folderName: 'Foreign', createBy: 'other', files: [] },
];
jest.setTimeout(20000);
let container;
const button = text => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === text);
const shareModal = () => document.querySelector('.crm-share-record-modal');
const moveModal = () => document.querySelector('.crm-move-document-modal');
const render = async () => act(async () => ReactDOM.render(<ChakraProvider><LanguageProvider><DocumentPage /></LanguageProvider></ChakraProvider>, container));
beforeEach(() => {
  jest.clearAllMocks(); localStorage.setItem('user', JSON.stringify({ role: 'admin', _id: 'admin' }));
  getApi.mockImplementation(async path => ({ status: 200, data: path.includes('/definitions/') ? { moduleName: 'Documents', fields: [] }
    : path === 'api/document' ? folders : path.endsWith('/users') ? [{ _id: 'recipient', firstName: 'Recipient' }] : [] }));
  postApi.mockResolvedValue({ status: 200, data: {} });
  container = document.createElement('div'); document.body.appendChild(container);
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); });
const sendToRecipient = async () => {
  await act(async () => Simulate.change(shareModal().querySelector('select'), { target: { value: 'recipient' } }));
  await act(async () => Simulate.click(button('Send')));
  await act(async () => {
    Simulate.click(button('Close'));
    await new Promise(resolve => setTimeout(resolve, 300));
  });
};

test('standalone files and folder files send individually while whole-folder sending targets the folder', async () => {
  await render();
  await act(async () => Simulate.click(document.querySelector('button[aria-label="Send file to user"]')));
  await sendToRecipient();
  expect(postApi).toHaveBeenLastCalledWith('api/record-sharing', { module: 'Documents', recordId: 'root-file', recipientId: 'recipient' });
  await act(async () => Simulate.click(button('Parent')));
  await act(async () => Simulate.click(document.querySelector('button[aria-label="Send file to user"]')));
  await sendToRecipient();
  expect(postApi).toHaveBeenLastCalledWith('api/record-sharing', { module: 'Documents', recordId: 'folder-file', recipientId: 'recipient' });
  await act(async () => Simulate.click(button('Send folder to user')));
  expect(shareModal().textContent).toContain('This folder and its subfolders are shared, including files added later.');
  await sendToRecipient();
  expect(postApi).toHaveBeenLastCalledWith('api/record-sharing', { module: 'Documents', recordId: 'parent', recipientId: 'recipient' });
  expect(document.body.textContent).toContain('Sent to user: Recipient');
});

test('moving a standalone file offers owned destinations and submits the selected folder', async () => {
  await render();
  await act(async () => Simulate.click(document.querySelector('button[aria-label="Move file"]')));
  expect([...moveModal().querySelectorAll('option')].map(item => item.value)).toEqual(['', 'parent', 'child', 'sibling']);
  await act(async () => Simulate.change(moveModal().querySelector('select'), { target: { value: 'child' } }));
  await act(async () => Simulate.click(button('Move')));
  expect(postApi).toHaveBeenCalledWith('api/document/move/file/root-file', { folderId: 'child' });
  expect(toast.success).toHaveBeenCalledWith('File moved successfully');
});

test('folder moves exclude the folder and its descendants, retain failures for retry, and support top level', async () => {
  await render();
  await act(async () => Simulate.click(button('Parent')));
  await act(async () => Simulate.click(document.querySelector('button[aria-label="Move folder"]')));
  expect([...moveModal().querySelectorAll('option')].map(item => item.value)).toEqual(['', 'sibling']);
  postApi.mockResolvedValueOnce({ status: 409, data: { code: 'conflict' } });
  await act(async () => Simulate.click(button('Move')));
  expect(toast.success).not.toHaveBeenCalled();
  expect(moveModal()).not.toBeNull();
  await act(async () => Simulate.click(button('Move')));
  expect(postApi).toHaveBeenLastCalledWith('api/document/move/folder/parent', { folderId: null });
  expect(toast.success).toHaveBeenCalledWith('Folder moved successfully');
});

test('a user cannot send or move foreign files or folders', async () => {
  localStorage.setItem('user', JSON.stringify({ role: 'user', _id: 'recipient' }));
  await render();
  expect(document.querySelector('.crm-share-record-button')).toBeNull();
  expect(document.querySelector('button[aria-label="Move file"]')).toBeNull();
  expect(document.querySelector('button[aria-label="Move folder"]')).toBeNull();
});
