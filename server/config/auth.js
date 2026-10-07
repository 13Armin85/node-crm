const crypto = require('crypto');
const testing = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
const secret = process.env.JWT_SECRET || (testing ? crypto.randomBytes(32).toString('hex') : '');
if (!secret || Buffer.byteLength(secret, 'utf8') < 32 || ['secret_key', 'change-me', 'replace-with-a-strong-secret'].includes(secret)) {
  throw new Error('Configure JWT_SECRET with at least 32 random bytes');
}
module.exports = { jwtSecret: secret };
