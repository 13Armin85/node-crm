const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../model/schema/user');
const Notification = require('../model/schema/notification');
const CustomField = require('../model/schema/customField');
const FormDefinition = require('../model/schema/formDefinition');
const { jwtSecret } = require('../config/auth');
const { can, scope } = require('../middelwares/permissions');
const { provisionDeveloper } = require('../services/provisionDeveloper');

test('developer inherits administrative permissions and exclusively registers users', () => {
  for (const title of ['Users', 'Properties', 'Custom Fields', 'Roles']) {
    assert.equal(can({ role: 'developer' }, title, 'view'), true);
  }
  assert.equal(can({ role: 'developer' }, 'Users', 'create'), true);
  assert.equal(can({ role: 'admin' }, 'Users', 'create'), false);
  assert.equal(can({ role: 'user' }, 'Users', 'create'), false);
  assert.deepEqual(scope({ actor: { _id: 'developer-id', role: 'developer' } }), {});
});

test('authenticated user routes enforce the developer hierarchy with database adapters mocked', async t => {
  t.mock.method(require('../services/recordSharing'), 'loadShares', async () => []);
  const developer = { _id: '64d33173fd7ff3fa0924a101', username: 'developer@example.com', role: 'developer', deleted: false };
  const admin = { _id: '64d33173fd7ff3fa0924a102', username: 'admin@example.com', role: 'admin', deleted: false };
  const user = { _id: '64d33173fd7ff3fa0924a103', username: 'user@example.com', role: 'user', deleted: false };
  t.mock.method(Notification, 'create', async value => value);
  const records = new Map([developer, admin, user].map(actor => [actor._id, { ...actor }]));
  const legacyAdmin = { _id: '64d33173fd7ff3fa0924a104', username: 'legacy-admin@example.com', role: 'admin' };
  const legacyUser = { _id: '64d33173fd7ff3fa0924a105', username: 'legacy-user@example.com', role: 'user' };
  const deletedUser = { _id: '64d33173fd7ff3fa0924a106', username: 'deleted@example.com', role: 'user', deleted: true };
  for (const record of [legacyAdmin, legacyUser, deletedUser]) records.set(record._id, record);
  const matches = (record, query) => Object.entries(query).every(([key, value]) => {
    if (value?.$in) return value.$in.map(String).includes(String(record[key]));
    if (value && Object.hasOwn(value, '$ne')) return record[key] !== value.$ne;
    return String(record[key]) === String(value);
  });
  const query = value => ({
    select: () => query(value), lean: () => Promise.resolve(value), exec: () => Promise.resolve(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  });
  t.mock.method(User, 'findOne', filter => query([...records.values()].find(record => matches(record, filter)) || null));
  t.mock.method(User, 'findById', id => query(records.get(String(id)) || null));
  t.mock.method(User, 'find', filter => query([...records.values()].filter(record => matches(record, filter))));
  const update = t.mock.method(User, 'updateOne', async (filter, values) => {
    const record = records.get(String(filter._id));
    for (const [key, value] of Object.entries(values.$set)) if (value !== undefined) record[key] = value;
    return { acknowledged: true, modifiedCount: 1 };
  });
  t.mock.method(User.prototype, 'save', async function () {
    records.set(String(this._id), this.toObject());
    return this;
  });
  const deleteOne = t.mock.method(User, 'deleteOne', async filter => ({ deletedCount: records.delete(String(filter._id)) ? 1 : 0 }));
  const deleteMany = t.mock.method(User, 'deleteMany', async filter => {
    let deletedCount = 0;
    for (const id of filter._id.$in) if (records.delete(String(id))) deletedCount++;
    return { deletedCount };
  });
  t.mock.method(CustomField, 'findOne', () => query(null));
  t.mock.method(FormDefinition, 'findOne', () => query(null));
  const sendEmail = t.mock.method(require('../middelwares/mail'), 'sendEmail', async () => null);
  const app = express();
  app.use(express.json());
  app.use('/api/user', require('../controllers/user/_routes'));
  app.use('/api/form', require('../controllers/form/_routes'));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const api = async (method, route, body, actor = developer) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${jwt.sign({ userId: actor._id, role: 'developer' }, jwtSecret, { expiresIn: '5m' })}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  const registration = { username: 'created@example.com', password: 'test-password-123', role: 'user', firstName: 'Created' };

  await t.test('developer and admin can list every active account including legacy admin and user records', async () => {
    const expectedIds = [developer, admin, user, legacyAdmin, legacyUser].map(record => record._id).sort();
    for (const actor of [developer, admin]) {
      const response = await api('GET', '/user/', null, actor);
      assert.equal(response.status, 200);
      assert.deepEqual(response.data.user.map(record => record._id).sort(), expectedIds);
    }
    const filtered = await api('GET', '/user/?role=admin');
    assert.deepEqual(filtered.data.user.map(record => record._id).sort(), [admin._id, legacyAdmin._id].sort());
    const includeDeleted = await api('GET', '/user/?deleted=true');
    assert.deepEqual(includeDeleted.data.user.map(record => record._id).sort(), expectedIds);
    assert.equal((await api('GET', '/user/', null, user)).status, 200);
    assert.equal((await api('GET', '/user/view/' + developer._id, null, user)).status, 200);
    assert.equal((await api('GET', '/user/', null, null)).status, 401);
  });

  await t.test('anonymous, users and admins cannot register any role even with a forged token role', async () => {
    assert.equal((await api('POST', '/user/register', registration, null)).status, 401);
    for (const actor of [admin, user]) for (const role of ['user', 'admin', 'developer']) {
      assert.equal((await api('POST', '/user/register', { ...registration, role }, actor)).status, 403);
    }
    assert.equal([...records.values()].some(record => record.username === registration.username), false);
  });
  await t.test('developer registers all roles and stores hashed passwords', async () => {
    const emailCallsBeforeRegistration = sendEmail.mock.callCount();
    for (const role of ['user', 'admin', 'developer']) {
      const username = `created-${role}@example.com`;
      assert.equal((await api('POST', '/user/register', { ...registration, username, role })).status, 200);
      const created = [...records.values()].find(record => record.username === username);
      assert.equal(created.role, role);
      assert.notEqual(created.password, registration.password);
      assert.equal(await bcrypt.compare(registration.password, created.password), true);
    }
    const registrationEmails = sendEmail.mock.calls.slice(emailCallsBeforeRegistration);
    assert.equal(registrationEmails.length, 3);
    assert.deepEqual(registrationEmails.map(call => call.arguments[0]), [
      'created-user@example.com',
      'created-admin@example.com',
      'created-developer@example.com',
    ]);
    assert.match(registrationEmails[0].arguments[1], /An account has been created for you/i);
    assert.match(registrationEmails[0].arguments[2], /An account has been created for you/i);
    const response = await api('GET', '/user/');
    assert.equal(response.status, 200);
    for (const role of ['user', 'admin', 'developer']) {
      assert(response.data.user.some(record => record.username === `created-${role}@example.com` && record.role === role));
    }
  });
  await t.test('admin cannot promote anyone to developer or modify a developer account', async () => {
    const writes = update.mock.callCount();
    for (const target of [admin, user, developer]) {
      assert.equal((await api('PUT', `/user/edit/${target._id}`, { role: 'developer' }, admin)).status, 403);
    }
    assert.equal((await api('PUT', `/user/edit/${developer._id}`, { firstName: 'Changed' }, admin)).status, 403);
    assert.equal((await api('PUT', `/user/edit/${developer._id}`, { role: 'user' }, admin)).status, 403);
    assert.equal(update.mock.callCount(), writes);
    assert.equal((await api('PUT', `/user/edit/${user._id}`, { firstName: 'Admin edited' }, admin)).status, 200);
  });
  await t.test('single and bulk deletion cannot remove developers through admin endpoints', async () => {
    assert.equal((await api('DELETE', `/user/delete/${developer._id}`, null, admin)).status, 403);
    assert.equal((await api('POST', '/user/deleteMany', [user._id, developer._id], admin)).status, 403);
    assert.equal(deleteOne.mock.callCount(), 0);
    assert.equal(deleteMany.mock.callCount(), 0);
    assert.equal(records.has(user._id), true);
    assert.equal(records.has(developer._id), true);
  });
  await t.test('developer can promote users; permission is read from the database on the next request', async () => {
    assert.equal((await api('PUT', `/user/edit/${user._id}`, { role: 'developer' })).status, 200);
    assert.equal((await api('POST', '/user/register', { ...registration, username: 'after-promotion@example.com' }, user)).status, 200);
    assert.equal((await api('PUT', `/user/edit/${user._id}`, { role: 'user' })).status, 200);
    assert.equal((await api('POST', '/user/register', { ...registration, username: 'after-demotion@example.com' }, user)).status, 403);
  });
  await t.test('developer self-demotion and self-deletion are rejected; own profile still edits', async () => {
    assert.equal((await api('PUT', `/user/edit/${developer._id}`, { role: 'admin' })).status, 400);
    assert.equal((await api('DELETE', `/user/delete/${developer._id}`)).status, 403);
    assert.equal((await api('POST', '/user/deleteMany', [developer._id])).status, 403);
    assert.equal((await api('PUT', `/user/edit/${developer._id}`, { role: 'developer', firstName: 'Programmer' })).status, 200);
    assert.equal((await api('PUT', `/user/edit/${user._id}`, { firstName: 'Own profile' }, user)).status, 200);
  });
  await t.test('generic forms cannot bypass account mutation safeguards for User or Users', async () => {
    for (const moduleName of ['User', 'Users']) {
      t.mock.method(CustomField, 'findById', () => query({ moduleName }));
      for (const actor of [admin, developer]) {
        assert.equal((await api('POST', '/form/add', { moduleId: user._id, role: 'developer' }, actor)).status, 403);
        assert.equal((await api('PUT', `/form/edit/${developer._id}`, { moduleId: user._id, role: 'user' }, actor)).status, 403);
        assert.equal((await api('POST', '/form/deleteMany', { moduleId: user._id, ids: [developer._id] }, actor)).status, 403);
      }
    }
  });
  await t.test('developer login returns the correct role without exposing the password', async () => {
    records.get(developer._id).password = await bcrypt.hash('developer-password', 10);
    // Login normally receives a Mongoose document with toObject().
    const originalFindOne = User.findOne;
    t.mock.method(User, 'findOne', filter => {
      if (filter.username) {
        const record = [...records.values()].find(item => matches(item, filter));
        return query(record ? new User(record) : null);
      }
      return originalFindOne(filter);
    });
    const response = await api('POST', '/user/login', { username: developer.username, password: 'developer-password' }, null);
    assert.equal(response.status, 200);
    assert.equal(response.data.user.role, 'developer');
    assert.equal(response.data.user.password, undefined);
    assert.equal(jwt.verify(response.data.token, jwtSecret).userId, developer._id);
  });
});

test('server-only developer provisioning validates credentials and explicitly promotes the configured account', async t => {
  const write = t.mock.method(User, 'findOneAndUpdate', async () => ({ role: 'developer' }));
  await assert.rejects(provisionDeveloper({}), /INITIAL_DEVELOPER/);
  await assert.rejects(provisionDeveloper({ INITIAL_DEVELOPER_EMAIL: 'invalid', INITIAL_DEVELOPER_PASSWORD: 'long-password' }), /INITIAL_DEVELOPER/);
  await assert.rejects(provisionDeveloper({ INITIAL_DEVELOPER_EMAIL: 'dev@example.com', INITIAL_DEVELOPER_PASSWORD: 'short' }), /INITIAL_DEVELOPER/);
  assert.equal(write.mock.callCount(), 0);
  await provisionDeveloper({ INITIAL_DEVELOPER_EMAIL: ' DEV@example.com ', INITIAL_DEVELOPER_PASSWORD: 'long-password' });
  const [filter, update, options] = write.mock.calls[0].arguments;
  assert.deepEqual(filter, { username: 'dev@example.com' });
  assert.equal(update.$set.role, 'developer');
  assert.equal(await bcrypt.compare('long-password', update.$set.password), true);
  assert.equal(options.runValidators, true);
});
