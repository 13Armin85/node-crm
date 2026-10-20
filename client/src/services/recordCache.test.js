import { clearRecordCache, RECORD_CACHE_KEYS } from './recordCache';

afterEach(() => localStorage.clear());

test('drops legacy server caches without discarding the login, preferences or drafts', () => {
  for (const key of RECORD_CACHE_KEYS) localStorage.setItem(key, '{"broken":true}');
  const keep = { user: '{"role":"admin"}', token: 'remembered-token', 'crm-language': 'fa', 'chakra-ui-color-mode': 'dark', 'draft:property': '{"title":"Unsaved"}' };
  for (const [key, value] of Object.entries(keep)) localStorage.setItem(key, value);
  clearRecordCache();
  for (const key of RECORD_CACHE_KEYS) expect(localStorage.getItem(key)).toBeNull();
  for (const [key, value] of Object.entries(keep)) expect(localStorage.getItem(key)).toBe(value);
});
