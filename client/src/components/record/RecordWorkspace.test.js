/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Verify workspace loading and archived source navigation. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import RecordWorkspace from './RecordWorkspace';
import { getApi } from 'services/api';

jest.mock('services/api', () => ({ getApi: jest.fn() }));
jest.mock('./NotesPanel', () => ({ readOnly }) => <div>{readOnly ? 'Notes history' : 'Notes editor'}</div>);
jest.mock('./ContactToOpportunityButton', () => () => null);
jest.mock('./RelatedRecordPanels', () => () => null);
jest.mock('./OpportunityActivities', () => () => null);
jest.mock('./RecordFields', () => ({ record }) => <div data-source-record>{record.leadName}</div>);

let container;
const id = '6ae1b409f48a9ea51d6dc631';
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); jest.clearAllMocks(); });
const render = () => act(async () => ReactDOM.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
  <RecordWorkspace moduleName="Leads" recordId={id}><div>Active lead actions</div></RecordWorkspace>
</MemoryRouter>, container));

test('converted lead links wait for access and show source details without mounting active lead actions or note editors', async () => {
  let resolve;
  getApi.mockImplementation(() => new Promise(done => { resolve = done; }));
  await render();
  expect(container.textContent).not.toContain('Active lead actions');
  expect(container.textContent).not.toContain('Notes editor');
  await act(async () => resolve({ status: 200, data: { archived: true, editable: false,
    record: { _id: id, leadName: 'Original lead' }, definition: { fields: [] } } }));
  expect(container.querySelector('[data-source-record]').textContent).toBe('Original lead');
  expect(container.textContent).toContain('Notes history');
  expect(container.textContent).not.toContain('Active lead actions');
  expect(container.textContent).not.toContain('Notes editor');
  expect(container.querySelector('button')).toBeNull();
});

test('active leads retain their normal view and notes, and unavailable sources do not mount editable content', async () => {
  getApi.mockResolvedValue({ status: 200, data: { archived: false, editable: false,
    record: { _id: id, leadName: 'Active lead' } } });
  await render();
  expect(container.textContent).toContain('Active lead actions');
  expect(container.textContent).toContain('Notes editor');
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  getApi.mockResolvedValue({ status: 404, data: { code: 'notFound' } });
  await render();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.textContent).not.toContain('Active lead actions');
  expect(container.textContent).not.toContain('Notes editor');
});
