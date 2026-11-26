import axios from 'axios';
import { getApi, putApi } from './api';
import { saveAuthSession } from './authSession';
import { setDataUser } from './adminDataScope';

jest.mock('axios', () => ({ get: jest.fn(), put: jest.fn() }));
const user = { _id: '000000000000000000000001', role: 'admin' };
const login = suffix => saveAuthSession({ user, remember: true, token: btoa('{}') + '.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.' + suffix });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks(); login('one'); });
afterEach(() => { localStorage.clear(); sessionStorage.clear(); });
const deferredGet = () => {
  const pending = [];
  axios.get.mockImplementation((url, config) => new Promise(resolve => pending.push(data => resolve({ status: 200, data, config }))));
  return pending;
};

test('simultaneous reads share a request but consumers get independent records; later reads fetch afresh', async () => {
  const pending = deferredGet();
  const first = getApi('api/task'), second = getApi('api/task');
  expect(axios.get).toHaveBeenCalledTimes(1);
  pending[0]([{ _id: 'task', details: { title: 'Original' } }]);
  const [a, b] = await Promise.all([first, second]);
  a.data[0].details.title = 'Changed';
  expect(b.data[0].details.title).toBe('Original');
  const third = getApi('api/task');
  expect(axios.get).toHaveBeenCalledTimes(2);
  pending[1]([]); await third;
});

test('a new login, a different person filter and successful mutations never join an earlier read', async () => {
  const pending = deferredGet();
  const first = getApi('api/opportunity');
  login('two');
  const second = getApi('api/opportunity');
  setDataUser('000000000000000000000002');
  const third = getApi('api/opportunity');
  axios.put.mockImplementation(async (url, data, config) => ({ status: 200, data: {}, config: { ...config, method: 'put', url } }));
  await putApi('api/opportunity/edit/task', {});
  const fourth = getApi('api/opportunity');
  expect(axios.get).toHaveBeenCalledTimes(4);
  pending.forEach(resolve => resolve([]));
  await Promise.all([first, second, third, fourth]);
});

test('failed reads are removed immediately, allowing the next attempt to succeed', async () => {
  axios.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ status: 200, data: [] });
  expect(await getApi('api/task')).toBeInstanceOf(Error);
  expect((await getApi('api/task')).status).toBe(200);
  expect(axios.get).toHaveBeenCalledTimes(2);
});
