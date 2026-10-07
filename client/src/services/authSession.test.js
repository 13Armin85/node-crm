import { clearAuthSession, getAuthSession, saveAuthSession, scheduleSessionExpiry } from './authSession';
const user = { _id: 'ordinary-user', role: 'user' };
const token = (exp) => 'eyJhbGciOiJIUzI1NiJ9.' + btoa(JSON.stringify({ exp })) + '.test';
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { localStorage.clear(); sessionStorage.clear(); });

test('remembered sessions avoid timer overflow and expire after the full 30 days', () => {
  jest.useFakeTimers('modern');
  const callback = jest.fn();
  const cancel = scheduleSessionExpiry(token(Math.floor(Date.now() / 1000) + 30 * 86400), callback);
  jest.advanceTimersByTime(1);
  expect(callback).not.toHaveBeenCalled();
  jest.advanceTimersByTime(2147483647);
  expect(callback).not.toHaveBeenCalled();
  jest.advanceTimersByTime(30 * 86400 * 1000 - 2147483647);
  expect(callback).toHaveBeenCalledTimes(1);
  cancel();
  jest.useRealTimers();
});

test('remembered login survives a new browser session', () => {
  const jwt = token(Math.floor(Date.now() / 1000) + 30 * 86400);
  saveAuthSession({ token: jwt, user, remember: true });
  sessionStorage.clear();
  expect(getAuthSession()).toEqual({ token: jwt, user });
  expect(localStorage.getItem('token')).toBe(jwt);
});

test('session-only login replaces an old remembered token and ends with the browser session', () => {
  saveAuthSession({ token: token(Math.floor(Date.now() / 1000) + 30 * 86400), user, remember: true });
  const jwt = token(Math.floor(Date.now() / 1000) + 86400);
  saveAuthSession({ token: jwt, user, remember: false });
  expect(localStorage.getItem('token')).toBeNull();
  expect(sessionStorage.getItem('token')).toBe(jwt);
  expect(getAuthSession()).toEqual({ token: jwt, user });
  sessionStorage.clear();
  expect(getAuthSession()).toEqual({ token: null, user: null });
});

test('expired remembered login and explicit logout cannot restore a session', () => {
  saveAuthSession({ token: token(Math.floor(Date.now() / 1000) - 1), user });
  expect(getAuthSession()).toEqual({ token: null, user: null });
  clearAuthSession();
  expect(localStorage.getItem('user')).toBeNull();
  expect(localStorage.getItem('token')).toBeNull();
  expect(sessionStorage.getItem('token')).toBeNull();
});
