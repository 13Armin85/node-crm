import axios from 'axios';
import { getApi } from './api';
import { getAuthSession, saveAuthSession } from './authSession';
jest.mock('axios', () => ({ get: jest.fn() }));
const user = { _id: '000000000000000000000001', role: 'admin' };
const token = suffix => btoa('{}') + '.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.' + suffix;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks(); });
afterEach(() => { localStorage.clear(); sessionStorage.clear(); });

test('a rejected remembered session returns to sign-in', async () => {
  saveAuthSession({ user, token: token('old'), remember: true });
  axios.get.mockImplementation(async (url, config) => ({ status: 401, data: { code: 'unauthorized' }, config }));
  await getApi('api/images/');
  expect(getAuthSession()).toEqual({ user: null, token: null });
});

test('a late 401 from the previous session cannot sign out a new login', async () => {
  saveAuthSession({ user, token: token('old'), remember: true });
  const next = token('new');
  axios.get.mockImplementation(async (url, config) => {
    saveAuthSession({ user, token: next, remember: true });
    return { status: 401, data: { code: 'unauthorized' }, config };
  });
  await getApi('api/images/');
  expect(getAuthSession()).toEqual({ user, token: next });
});

test('a denied action does not discard a valid session', async () => {
  const current = token('valid');
  saveAuthSession({ user, token: current, remember: true });
  axios.get.mockImplementation(async (url, config) => ({ status: 403, data: { code: 'forbidden' }, config }));
  await getApi('api/images/');
  expect(getAuthSession()).toEqual({ user, token: current });
});
