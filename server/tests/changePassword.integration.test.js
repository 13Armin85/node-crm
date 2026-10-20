const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { jwtSecret } = require('../config/auth');

test('self-service password changes authenticate the owner and revoke previous sessions', { skip: process.env.PASSWORD_CHANGE_INTEGRATION !== '1', timeout: 90000 }, async t => {
  const dbName = 'crm_password_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  let server;
  t.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); assert.equal(mongoose.connection.name, dbName); assert(dbName.startsWith('crm_password_test_')); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const app = express(); app.use(express.json()); app.use('/api', require('../controllers/route')); app.use(require('../middelwares/securityHeaders').errorHandler);
  const User = require('../model/schema/user');
  const oldPassword = 'Old-password-123', newPassword = 'New-password-456', hash = await bcrypt.hash(oldPassword, 10);
  const create = (username, role = 'user') => User.create({ username: username + '@example.test', password: hash, role, firstName: username });
  const users = await Promise.all(['user', 'admin', 'developer'].map(role => create(role, role)));
  const token = user => jwt.sign({ userId: user._id, sv: Number(user.authVersion || 0) }, jwtSecret, { expiresIn: '5m' });
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const api = async (route, body, actor = users[0]) => { const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/user/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: typeof actor === 'string' ? actor : token(actor) } : {}) }, body: JSON.stringify(body) }); return { status: response.status, data: await response.json() }; };
  const payload = { currentPassword: oldPassword, newPassword, confirmPassword: newPassword };
  await t.test('requires an authenticated active account', async () => {
    assert.equal((await api('change-password', payload, null)).status, 401);
    const removed = await create('removed'); await User.updateOne({ _id: removed._id }, { $set: { deleted: true } });
    assert.equal((await api('change-password', payload, removed)).status, 401);
  });
  await t.test('invalid, missing, weak, oversized and mismatched passwords leave stored credentials unchanged', async () => {
    for (const [body, field, code] of [
      [{ ...payload, currentPassword: '' }, 'currentPassword', 'required'],
      [{ ...payload, newPassword: 'short', confirmPassword: 'short' }, 'newPassword', 'passwordTooShort'],
      [{ ...payload, newPassword: 'x'.repeat(73), confirmPassword: 'x'.repeat(73) }, 'newPassword', 'passwordTooLong'],
      [{ ...payload, newPassword: '\u0641'.repeat(37), confirmPassword: '\u0641'.repeat(37) }, 'newPassword', 'passwordTooLong'],
      [{ ...payload, confirmPassword: 'different' }, 'confirmPassword', 'passwordMismatch'],
      [{ ...payload, currentPassword: 'incorrect' }, 'currentPassword', 'incorrectPassword'],
      [{ ...payload, newPassword: oldPassword, confirmPassword: oldPassword }, 'newPassword', 'samePassword'],
    ]) { const result = await api('change-password', body); assert.equal(result.status, 400, JSON.stringify(result)); assert.equal(result.data.field, field); assert.equal(result.data.code, code); }
    const stored = await User.findById(users[0]._id).select('+password +authVersion'); assert.equal(stored.password, hash); assert.equal(stored.authVersion, 0);
  });
  await t.test('the request cannot select another account or change a role', async () => {
    for (const extra of [{ userId: String(users[1]._id) }, { _id: String(users[1]._id) }, { role: 'developer' }]) assert.equal((await api('change-password', { ...payload, ...extra }, users[2])).status, 400);
    assert.equal((await User.findById(users[1]._id).select('+password')).password, hash);
  });
  await t.test('every role can change only its own password and old tokens stop working', async () => {
    for (const actor of users) {
      const oldToken = token(actor), before = await User.findById(actor._id).select('+password +authVersion +moduleVisibility').lean();
      const changed = await api('change-password', payload, oldToken); assert.equal(changed.status, 200, JSON.stringify(changed));
      assert(!JSON.stringify(changed.data).includes(newPassword)); assert.equal(changed.data.password, undefined); assert.equal(changed.data.token, undefined);
      const stored = await User.findById(actor._id).select('+password +authVersion +moduleVisibility').lean();
      assert(await bcrypt.compare(newPassword, stored.password)); assert(!await bcrypt.compare(oldPassword, stored.password)); assert.equal(stored.authVersion, 1);
      for (const field of ['password', 'authVersion', 'updatedDate']) { delete before[field]; delete stored[field]; } assert.deepEqual(stored, before);
      assert.equal((await api('change-password', payload, oldToken)).status, 401);
      assert.equal((await api('login', { username: actor.username, password: oldPassword }, null)).status, 401);
      const login = await api('login', { username: actor.username, password: newPassword }, null); assert.equal(login.status, 200); assert.equal(jwt.verify(login.data.token, jwtSecret).sv, 1); assert.equal(login.data.user.password, undefined);
    }
  });
  await t.test('older accounts without authVersion can change passwords', async () => {
    const actor = await create('legacy'); await User.collection.updateOne({ _id: actor._id }, { $unset: { authVersion: '' } });
    assert.equal((await api('change-password', payload, actor)).status, 200);
    assert.equal((await User.findById(actor._id).select('+authVersion')).authVersion, 1);
  });
  await t.test('concurrent requests cannot overwrite one another using the same old password', async () => {
    const actor = await create('concurrent');
    const requests = ['Concurrent-new-one', 'Concurrent-new-two'].map(password => api('change-password', { ...payload, newPassword: password, confirmPassword: password }, actor));
    const results = await Promise.all(requests); assert.equal(results.filter(result => result.status === 200).length, 1); assert(results.every(result => [200, 401, 409].includes(result.status)));
    assert.equal((await User.findById(actor._id).select('+authVersion')).authVersion, 1);
  });
  await t.test('repeated incorrect current passwords are limited per account', async () => {
    const actor = await create('limited'); let result;
    for (let index = 0; index < 11; index++) result = await api('change-password', { ...payload, currentPassword: 'incorrect' }, actor);
    assert.equal(result.status, 429); assert.equal(result.data.code, 'rateLimited');
    const other = await create('unlimited'); assert.equal((await api('change-password', payload, other)).status, 200);
    assert.equal((await User.findById(actor._id).select('+password')).password, hash);
  });
});
