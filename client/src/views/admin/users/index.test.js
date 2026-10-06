import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import { getApi } from 'services/api';
import Users from './index';

jest.mock('services/api', () => ({ getApi: jest.fn(), deleteManyApi: jest.fn() }));
jest.mock('components/reactTable/checktable', () => function UserTable({ allData, isLoding }) {
  return <div data-testid="users" data-loading={isLoding}>{allData.map(user => <span key={user._id}>{user.username}</span>)}</div>;
});
jest.mock('components/commonDeleteModel', () => () => null);
jest.mock('./AddEditUser', () => () => null);
jest.mock('./components/userAdvanceSearch', () => () => null);

const records = [
  { _id: 'admin-id', username: 'admin@example.com', role: 'admin' },
  { _id: 'user-id', username: 'user@example.com', role: 'user' },
];
let container;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('user', JSON.stringify({ _id: 'developer-id', role: 'developer' }));
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  container.remove();
  localStorage.clear();
});

async function renderUsers() {
  // eslint-disable-next-line testing-library/no-unnecessary-act -- ReactDOM.render requires act; Testing Library is not used.
  await act(async () => {
    ReactDOM.render(<ChakraProvider><MemoryRouter><Users /></MemoryRouter></ChakraProvider>, container);
  });
}

test('developer sees both admin and ordinary user accounts returned by the API', async () => {
  getApi.mockResolvedValue({ status: 200, data: { user: records } });
  await renderUsers();
  expect(getApi).toHaveBeenCalledWith('api/user/');
  expect(container.textContent).toContain('admin@example.com');
  expect(container.textContent).toContain('user@example.com');
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test('a failed user request shows an error and retry recovers the list', async () => {
  getApi.mockResolvedValueOnce({ status: 403, data: { message: 'Access denied' } })
    .mockResolvedValueOnce({ status: 200, data: { user: records } });
  await renderUsers();
  const alert = container.querySelector('[role="alert"]');
  expect(alert.textContent).toContain('Access denied');
  expect(container.querySelector('[data-testid="users"]').getAttribute('data-loading')).toBe('false');
  await act(async () => Simulate.click(alert.querySelector('button')));
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).toContain('admin@example.com');
  expect(container.textContent).toContain('user@example.com');
});

test.each([
  ['unexpected HTML', () => Promise.resolve({ status: 200, data: '<html></html>' })],
  ['network failure', () => Promise.reject(new Error('Network Error'))],
])('%s is reported instead of silently showing an empty user list', async (_, request) => {
  getApi.mockImplementation(request);
  await renderUsers();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector('[data-testid="users"]').getAttribute('data-loading')).toBe('false');
});
