/* eslint-disable testing-library/no-unnecessary-act -- These hook tests use ReactDOM directly. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { getApi, putApi } from 'services/api';
import { AUTH_CHANGED_EVENT } from 'services/authSession';
import { NOTIFICATIONS_CHANGED_EVENT } from 'services/notificationEvents';
import useNotifications from './useNotifications';

jest.mock('services/api', () => ({ getApi: jest.fn(), putApi: jest.fn() }));
let current, container;
const row = (suffix, extra = {}) => ({ _id: '64d33173fd7ff3fa0924a1' + suffix, readAt: null, createdAt: '2026-10-07T10:00:00.000Z', ...extra });
const result = (rows, unreadCount = rows.length, extra = {}) => ({ status: 200, data: { notifications: rows, unreadCount, hasMore: false, nextCursor: null, ...extra } });
function Harness() {
  current = useNotifications('user-id');
  return null;
}
async function render() {
  await act(async () => { ReactDOM.render(<Harness />, container); });
}
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'session-one');
  container = document.createElement('div');
  getApi.mockResolvedValue(result([]));
});
afterEach(() => {
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  localStorage.clear();
});

test('loads the unread count and immediately refreshes after a successful CRM action', async () => {
  getApi.mockResolvedValueOnce(result([row('01')], 1)).mockResolvedValue(result([row('02'), row('01')], 2));
  await render();
  expect(current.loading).toBe(false);
  expect(current.unreadCount).toBe(1);
  await act(async () => { window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT)); });
  expect(current.unreadCount).toBe(2);
  expect(current.notifications[0]._id).toBe(row('02')._id);
});

test('network errors show a recoverable error instead of an empty successful inbox', async () => {
  getApi.mockRejectedValueOnce(new Error('Network offline'));
  await render();
  expect(current.loading).toBe(false);
  expect(current.error).toBe('Failed to load notifications');
  getApi.mockResolvedValue(result([row('01')], 1));
  await act(async () => { await current.refresh(); });
  expect(current.error).toBe('');
  expect(current.notifications).toHaveLength(1);
});

test('older notifications are merged without duplicates and remain after a refresh', async () => {
  const newest = row('03'), older = row('02'), oldest = row('01');
  getApi.mockResolvedValueOnce(result([newest, older], 3, { hasMore: true, nextCursor: older._id }))
    .mockResolvedValueOnce(result([older, oldest], 3))
    .mockResolvedValue(result([newest, older], 3, { hasMore: true, nextCursor: older._id }));
  await render();
  expect(current.hasMore).toBe(true);
  await act(async () => { await current.loadMore(); });
  expect(getApi).toHaveBeenLastCalledWith('api/notification?before=' + older._id);
  expect(current.notifications.map(item => item._id)).toEqual([newest._id, older._id, oldest._id]);
  expect(current.hasMore).toBe(false);
  await act(async () => { await current.refresh(); });
  expect(current.notifications).toHaveLength(3);
  expect(current.hasMore).toBe(false);
});

test('a response from a signed-out session cannot restore the previous user inbox', async () => {
  let resolve;
  getApi.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await render();
  await act(async () => {
    localStorage.removeItem('token');
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
    resolve(result([row('01')], 1));
  });
  expect(current.notifications).toEqual([]);
  expect(current.unreadCount).toBe(0);
  expect(current.loading).toBe(false);
});

test('a poll started before marking a notification read cannot restore a stale count', async () => {
  const unread = row('01'), readAt = '2026-10-07T11:00:00.000Z';
  getApi.mockResolvedValueOnce(result([unread], 1));
  await render();
  let resolvePoll;
  getApi.mockImplementationOnce(() => new Promise(done => { resolvePoll = done; }))
    .mockResolvedValue(result([{ ...unread, readAt }], 0));
  let pendingPoll;
  await act(async () => { pendingPoll = current.refresh(); });
  putApi.mockResolvedValue({ status: 200, data: { ...unread, readAt } });
  await act(async () => { await current.markRead(unread); });
  await act(async () => { resolvePoll(result([unread], 1)); await pendingPoll; });
  expect(current.unreadCount).toBe(0);
  expect(current.notifications[0].readAt).toBe(readAt);
});

test('mark all read keeps notifications arriving after the server cutoff unread', async () => {
  const before = row('01'), after = row('02', { createdAt: '2026-10-07T12:00:01.000Z' });
  const readAt = '2026-10-07T12:00:00.000Z';
  getApi.mockResolvedValueOnce(result([after, before], 2))
    .mockResolvedValue(result([after, { ...before, readAt }], 1));
  putApi.mockResolvedValue({ status: 200, data: { readAt, unreadCount: 1, updatedCount: 1 } });
  await render();
  await act(async () => { await current.markAllRead(); });
  expect(current.unreadCount).toBe(1);
  expect(current.notifications.find(item => item._id === before._id).readAt).toBe(readAt);
  expect(current.notifications.find(item => item._id === after._id).readAt).toBeNull();
});

test('notification read failures keep the item unread', async () => {
  const unread = row('01');
  getApi.mockResolvedValue(result([unread], 1));
  putApi.mockResolvedValue({ status: 500 });
  await render();
  let success;
  await act(async () => { success = await current.markRead(unread); });
  expect(success).toBe(false);
  expect(current.unreadCount).toBe(1);
  expect(current.notifications[0].readAt).toBeNull();
});
