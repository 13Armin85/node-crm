/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercise note submission and author profile links. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider, translate } from 'i18n';
import { getApi, postApi } from 'services/api';
import NotesPanel from './NotesPanel';
jest.mock('services/api', () => ({ getApi: jest.fn(), postApi: jest.fn() }));
jest.mock('components/profile/ProfileAvatar', () => () => <span>Avatar</span>);
let container;
const actor = { _id: '64d33173fd7ff3fa0924a101', firstName: 'Actual', lastName: 'Author', role: 'user' };
const note = { _id: '64d33173fd7ff3fa0924a102', text: 'Original note\nComplete second line', createdAt: '2026-11-04T10:15:00Z', author: actor };
beforeEach(() => {
  jest.clearAllMocks(); localStorage.setItem('user', JSON.stringify(actor));
  Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => 'test-note-request' } });
  getApi.mockResolvedValue({ status: 200, data: { items: [note], before: null } });
  postApi.mockImplementation(async (url, body) => ({ status: 201, data: { ...note, _id: '64d33173fd7ff3fa0924a103', text: body.text } }));
  container = document.createElement('div'); document.body.appendChild(container);
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); });
const render = async language => {
  localStorage.setItem('crm-language', language);
  await act(async () => ReactDOM.render(<ChakraProvider><LanguageProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><NotesPanel moduleName="Contacts" recordId="record-1" /></MemoryRouter></LanguageProvider></ChakraProvider>, container));
};
test.each(['en', 'fa', 'tr'])('notes preserve author names, text and a link to the author profile in %s', async language => {
  await render(language);
  expect(container.textContent).toContain('Actual Author'); expect(container.textContent).toContain('Original note');
  expect(container.querySelector('time').dateTime).toBe(note.createdAt);
  expect(container.querySelector('.crm-note-meta a').getAttribute('href')).toBe('/profile/' + actor._id);
  expect(container.querySelector('textarea').placeholder).toBe(translate('notes.placeholder', language));
  expect(container.textContent).not.toContain(actor._id);
});
test('sending records only the note and a retry token, then renders the saved message without losing previous notes', async () => {
  await render('en');
  await act(async () => Simulate.change(container.querySelector('textarea'), { target: { value: '  A new note  ' } }));
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(postApi).toHaveBeenCalledWith('api/record-workspace/Contacts/record-1/notes', { text: 'A new note', clientId: 'test-note-request' });
  expect(container.querySelector('textarea').value).toBe(''); expect(container.querySelectorAll('.crm-note')).toHaveLength(2);
  expect(container.textContent).toContain('A new note'); expect(container.textContent).toContain('Original note');
});
test('failed sends retain the draft and retry token instead of losing the message', async () => {
  postApi.mockResolvedValueOnce({ status: 500, data: { code: 'serverError' } }); await render('en');
  await act(async () => Simulate.change(container.querySelector('textarea'), { target: { value: 'Keep this draft' } }));
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(container.querySelector('textarea').value).toBe('Keep this draft');
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(postApi.mock.calls[0][1].clientId).toBe(postApi.mock.calls[1][1].clientId);
});
