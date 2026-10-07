import { sanitizeHtml, safeUrl, safeInternalPath } from './contentSecurity';

test('email content preserves text while removing scripts, handlers and hostile markup', () => {
  const dirty = '<p>Hello <b>team</b></p><img src=x onerror="alert(1)"><svg onload="alert(2)"></svg><a href="javascript:alert(3)">link</a><iframe srcdoc="<script>alert(4)</script>"></iframe><form action="https://evil.test"><input name="password"></form>';
  const element = document.createElement('div');
  element.innerHTML = sanitizeHtml(dirty);
  expect(element.querySelector('p').textContent).toBe('Hello team');
  expect(element.querySelector('b').textContent).toBe('team');
  expect(element.querySelector('script,svg,iframe,form,input,object,embed')).toBeNull();
  expect(element.querySelector('[onerror],[onload]')).toBeNull();
  expect(element.querySelector('a').getAttribute('href')).toBeNull();
});
test.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'java\nscript:alert(1)'])('unsafe external protocol is rejected: %s', value => {
  expect(safeUrl(value)).toBeUndefined();
});
test('external web links continue to work', () => {
  expect(safeUrl('https://example.test/profile')).toBe('https://example.test/profile');
});
test.each(['//evil.test', '/\\evil.test', '/%5cevil.test', '/%2f%2fevil.test', '/bad%0apath', 'javascript:alert(1)'])('internal routes cannot redirect away: %s', value => {
  expect(safeInternalPath(value)).toBe('/default');
});
test('valid routes retain IDs and query filters', () => {
  expect(safeInternalPath('/leadView/abc?tab=history')).toBe('/leadView/abc?tab=history');
});
