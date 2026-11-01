/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import ConvertedLeadDetails from './ConvertedLeadDetails';
import RecordValue from './RecordValue';
import { getApi } from 'services/api';
jest.mock('services/api', () => ({ getApi: jest.fn() }));
const userId = '6ad5cede20944f7bf63f495d', opportunityId = '6ae1b409f48a9ea51d6dc631';
let container;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container);
  getApi.mockImplementation(async url => ({ status: 200, data: [{ value: url.includes('Users') ? userId : opportunityId,
    label: url.includes('Users') ? 'Assigned Agent' : 'Garden Villa Sale' }] }));
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); jest.clearAllMocks(); });

test('converted lead details resolve user and opportunity IDs while preserving original values and translated labels', async () => {
  await act(async () => ReactDOM.render(<ConvertedLeadDetails records={[{ leadId: 'source', fields: [
    { name: 'assignUser', label: { en: 'Responsible user', fa: 'کاربر مسئول' }, relation: 'Users' },
  ], values: { assignUser: userId, assignedBy: userId, relatedOpportunities: [opportunityId], leadNotes: 'Original notes',
    customFields: { budget: 0, active: false, preferences: ['Garden', 'Pool'] } } }]} />, container));
  expect(container.textContent).toContain('Responsible user');
  expect(container.textContent).toContain('Assigned Agent');
  expect(container.textContent).toContain('Garden Villa Sale');
  expect(container.textContent).toContain('Original notes');
  expect(container.textContent).toContain('0'); expect(container.textContent).toContain('false');
  expect(container.textContent).toContain('Garden, Pool');
  expect(container.textContent).not.toContain(userId); expect(container.textContent).not.toContain(opportunityId);
});

test('populated opportunities display their names, and unavailable relations never expose IDs', async () => {
  getApi.mockResolvedValue({ status: 200, data: [] });
  await act(async () => ReactDOM.render(<><RecordValue value={{ _id: opportunityId, opportunityName: 'Named opportunity' }} />
    <RecordValue name="assignUser" value={userId} /></>, container));
  expect(container.textContent).toContain('Named opportunity');
  expect(container.textContent).toContain('Record unavailable');
  expect(container.textContent).not.toContain(userId); expect(container.textContent).not.toContain(opportunityId);
});
