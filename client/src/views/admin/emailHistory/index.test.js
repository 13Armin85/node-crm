/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercise history actions and deletion confirmation. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from 'i18n';
import { deleteManyApi } from 'services/api';
import { HasAccess } from '../../../redux/accessUtils';
import { toast } from 'react-toastify';
import Index from './index';
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch }));
jest.mock('services/api', () => ({ deleteManyApi: jest.fn() }));
jest.mock('../../../redux/accessUtils', () => ({ HasAccess: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('./add', () => () => null);
jest.mock('./components/EmailAdvanceSearch', () => () => null);
jest.mock('../../../components/reactTable/checktable', () => props => <div>
  {props.tableData.map(record => <div key={record._id} data-record={record._id}>
    <input type="checkbox" aria-label={'Select ' + record._id} checked={props.selectedValues.includes(record._id)}
      onChange={event => props.setSelectedValues(event.target.checked ? [...props.selectedValues, record._id] : props.selectedValues.filter(id => id !== record._id))} />
    {record.subject}
    {props.columnData.find(column => column.accessor === 'action')?.cell({ row: { original: record, values: record } })}
  </div>)}
  {props.access?.delete && !props.deleteMany && <button id="delete-selected" onClick={() => props.setDelete(true)}>Delete selected</button>}
</div>);
let container, rows;
const firstId = '64d33173fd7ff3fa0924a111', secondId = '64d33173fd7ff3fa0924a112';
const click = async node => act(async () => Simulate.click(node));
const render = () => act(async () => ReactDOM.render(<ChakraProvider><LanguageProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Index /></MemoryRouter></LanguageProvider></ChakraProvider>, container));
const confirm = () => document.querySelector('.chakra-modal__footer button');
async function openRowDelete() {
  await click(container.querySelector('button[aria-label="Actions"]'));
  await click([...document.querySelectorAll('[role="menuitem"]')].find(node => node.textContent.trim() === 'Delete'));
}
beforeEach(() => {
  jest.clearAllMocks(); localStorage.setItem('crm-language', 'en');
  localStorage.setItem('user', JSON.stringify({ _id: 'admin', role: 'admin' }));
  container = document.createElement('div'); document.body.appendChild(container);
  rows = [{ _id: firstId, subject: 'First email' }, { _id: secondId, subject: 'Second email' }];
  HasAccess.mockReturnValue([{ view: true, delete: true }, {}, {}]);
  mockDispatch.mockImplementation(async () => ({ payload: { status: 200, data: rows } }));
  deleteManyApi.mockImplementation(async (_, ids) => { rows = rows.filter(row => !ids.includes(row._id)); return { status: 200 }; });
});
afterEach(() => { act(() => ReactDOM.unmountComponentAtNode(container)); container.remove(); localStorage.clear(); });

test('row deletion waits for confirmation, then deletes that email and refreshes history', async () => {
  await render(); await openRowDelete();
  expect(deleteManyApi).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('Delete selected emails from history?');
  await click(confirm());
  expect(deleteManyApi).toHaveBeenCalledWith('api/email/deleteMany', [firstId]);
  expect(container.textContent).not.toContain('First email');
  expect(container.textContent).toContain('Second email');
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

test('cancelling deletion retains the email without an API mutation', async () => {
  await render(); await openRowDelete();
  await click(document.querySelectorAll('.chakra-modal__footer button')[1]);
  expect(deleteManyApi).not.toHaveBeenCalled();
  expect(container.textContent).toContain('First email');
});

test('bulk deletion submits the selected email IDs', async () => {
  await render();
  for (const id of [firstId, secondId]) {
    await act(async () => Simulate.change(container.querySelector('input[aria-label="Select ' + id + '"]'), { target: { checked: true } }));
  }
  await click(container.querySelector('#delete-selected')); await click(confirm());
  expect(deleteManyApi).toHaveBeenCalledWith('api/email/deleteMany', [firstId, secondId]);
  expect(container.querySelectorAll('[data-record]')).toHaveLength(0);
});

test('failed deletion preserves the selection and dialog and allows retry', async () => {
  deleteManyApi.mockResolvedValueOnce({ status: 500 });
  await render(); await openRowDelete(); await click(confirm());
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(container.textContent).toContain('First email'); expect(toast.error).toHaveBeenCalled();
  await click(confirm());
  expect(deleteManyApi).toHaveBeenLastCalledWith('api/email/deleteMany', [firstId]);
  expect(container.textContent).not.toContain('First email');
});

test('users without delete permission have no deletion actions', async () => {
  HasAccess.mockReturnValue([{ view: true, delete: false }, {}, {}]);
  await render(); await click(container.querySelector('button[aria-label="Actions"]'));
  expect([...document.querySelectorAll('[role="menuitem"]')].some(node => node.textContent.trim() === 'Delete')).toBe(false);
  expect(container.querySelector('#delete-selected')).toBeNull();
});
