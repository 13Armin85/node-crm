const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
function assertSafeInput(value, depth = 0, budget = { remaining: 10000 }) {
  if (--budget.remaining < 0 || depth > 20) throw Object.assign(new Error('Invalid input'), { status: 400 });
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.split('.').some(part => forbidden.has(part))) throw Object.assign(new Error('Invalid input'), { status: 400 });
    assertSafeInput(value[key], depth + 1, budget);
  }
}
const requestSecurity = (req, res, next) => {
  try {
    assertSafeInput(req.query); assertSafeInput(req.body);
    // Credential fields must never become user-controlled database filters.
    if (Object.keys(req.query || {}).some(key => /(^|\.)(password|passwordHash|token|secret)$/i.test(key))) return res.status(400).json({ code: 'invalid' });
    next();
  } catch { res.status(400).json({ code: 'invalid' }); }
};
module.exports = { assertSafeInput, requestSecurity };
