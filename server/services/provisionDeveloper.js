const bcrypt = require('bcrypt');
const User = require('../model/schema/user');

// Only called by server startup or the operator's CLI, never an HTTP endpoint.
async function provisionDeveloper(env = process.env) {
  const username = env.INITIAL_DEVELOPER_EMAIL?.trim().toLowerCase();
  const password = env.INITIAL_DEVELOPER_PASSWORD?.trim();
  if (!username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)
      || !password || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72 || password === 'replace-with-a-strong-password') {
    throw new Error('Set INITIAL_DEVELOPER_EMAIL and INITIAL_DEVELOPER_PASSWORD (at least 8 characters) before provisioning a developer.');
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  return User.findOneAndUpdate(
    { username },
    {
      $set: {
        role: 'developer', deleted: false, password: hashedPassword,
        firstName: env.INITIAL_DEVELOPER_FIRST_NAME || 'System',
        lastName: env.INITIAL_DEVELOPER_LAST_NAME || 'Developer',
      },
      $setOnInsert: { createdDate: new Date() },
      $inc: { authVersion: 1 },
    },
    { upsert: true, new: true, runValidators: true },
  );
}

module.exports = { provisionDeveloper };
