const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { jwtSecret } = require('../config/auth');

test('security boundaries withstand unauthorized records, injection, uploads and login abuse', { skip: process.env.SECURITY_INTEGRATION !== '1' }, async t => {
  const dbName = 'crm_security_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  let server;
  const ownedFiles = new Set();
  const uploadRoot = path.resolve(__dirname, '../uploads/document');
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    const Document = require('../model/schema/document');
    for (const folder of await Document.find().lean()) for (const file of folder.file || []) {
      if (require('../services/secureFiles').withinRoot(uploadRoot, file.path)) ownedFiles.add(file.path);
    }
    for (const file of ownedFiles) await fs.unlink(file).catch(() => {});
    assert.equal(mongoose.connection.name, dbName);
    assert(dbName.startsWith('crm_security_test_'));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  t.mock.method(require('../middelwares/mail'), 'sendEmail', async () => null);
  const { app } = require('../index');
  const User = require('../model/schema/user');
  const password = await bcrypt.hash('test-password-123', 10);
  const admin = await User.create({ username: 'admin@example.test', password, role: 'admin' });
  const first = await User.create({ username: 'first@example.test', password, role: 'user' });
  const second = await User.create({ username: 'second@example.test', password, role: 'user' });
  const removed = await User.create({ username: 'removed@example.test', password, role: 'user', deleted: true });
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const token = actor => jwt.sign({ userId: actor._id, sv: actor.authVersion || 0 }, jwtSecret, { expiresIn: '5m' });
  const api = async (method, route, body, actor = first, extra = {}) => {
    const multipart = body instanceof FormData;
    const response = await fetch(base + route, {
      method, headers: { ...(multipart ? {} : { 'Content-Type': 'application/json' }), ...(actor ? { Authorization: typeof actor === 'string' ? actor : token(actor) } : {}), ...extra },
      ...(body !== undefined && body !== null ? { body: multipart ? body : JSON.stringify(body) } : {}),
    });
    const raw = await response.text();
    let data; try { data = JSON.parse(raw); } catch { data = raw; }
    return { status: response.status, headers: response.headers, data };
  };
  await t.test('authentication verifies algorithm, active account and session version', async () => {
    for (const actor of [null, 'garbage', token(removed), jwt.sign({ userId: new mongoose.Types.ObjectId() }, jwtSecret, { expiresIn: '5m' }), jwt.sign({ userId: first._id }, jwtSecret), jwt.sign({ userId: first._id }, jwtSecret, { algorithm: 'HS384', expiresIn: '5m' }), jwt.sign({ userId: first._id }, jwtSecret, { expiresIn: -1 })]) {
      assert.equal((await api('GET', '/notification', null, actor)).status, 401);
    }
    const oldToken = token(second);
    await User.updateOne({ _id: second._id }, { $inc: { authVersion: 1 } });
    assert.equal((await api('GET', '/notification', null, oldToken)).status, 401);
    const refreshed = await User.findById(second._id).select('+authVersion');
    second.authVersion = refreshed.authVersion;
    const valid = await api('GET', '/notification');
    assert.equal(valid.status, 200);
    assert.equal(valid.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(valid.headers.get('x-powered-by'), null);
    assert.match(valid.headers.get('content-security-policy'), /default-src 'none'/);
    const users = await api('GET', '/user');
    assert.equal(users.status, 200);
    assert(!JSON.stringify(users.data).includes(password));
    assert(!JSON.stringify(users.data).includes('authVersion'));
    const options = await api('GET', '/user/options');
    assert.equal(options.status, 200);
    assert(Array.isArray(options.data));
    assert(options.data.some(actor => actor._id === String(first._id)));
    assert(!options.data.some(actor => actor._id === String(removed._id)));
    for (const actor of options.data) assert(Object.keys(actor).every(key => ['_id', 'firstName', 'lastName', 'username', 'role'].includes(key)));
    assert.equal((await api('GET', '/user/options', null, null)).status, 401);
    assert.equal((await api('GET', '/task/assignees')).status, 403);
  });
  await t.test('Mongo operators and prototype paths never reach controllers', async () => {
    for (const route of ['/bank-details?createBy[$ne]=null', '/user?password[$regex]=test', '/user?password=test']) assert.equal((await api('GET', route)).status, 400, route);
    for (const body of [{ $set: { role: 'admin' } }, JSON.parse('{"__proto__":{"admin":true}}'), { customFields: { 'constructor.prototype.admin': true } }]) assert.equal((await api('PUT', '/user/edit/' + first._id, body)).status, 400);
    assert.equal((await api('PUT', '/user/edit/' + first._id, { role: 'admin' })).status, 403);
    assert.equal((await User.findById(first._id)).role, 'user');
  });
  await t.test('invalid legacy list filters produce safe errors and leave the server running', async () => {
    for (const route of ['/contact?_id=invalid', '/lead?_id=invalid', '/opportunityproject?_id=invalid']) {
      const response = await api('GET', route);
      assert.equal(response.status, 400, route);
      assert.equal(response.data.code, 'invalid');
      assert(!JSON.stringify(response.data).includes('CastError'));
    }
    assert.equal((await api('GET', '/notification')).status, 200);
  });
  await t.test('legacy records enforce ownership without relying on form definitions', async () => {
    const models = [
      ['bank-details', require('../model/schema/bankDetails'), { accountName: 'Protected account' }, { accountName: 'stolen' }],
      ['opportunityproject', require('../model/schema/opportunityproject'), { name: 'Protected project', requirement: 'Private' }, { name: 'stolen' }],
    ];
    for (const [route, Model, fields, edits] of models) {
      const foreign = await Model.create({ ...fields, createBy: second._id });
      assert.equal((await api('GET', '/' + route + '/view/' + foreign._id)).status, 404);
      assert.equal((await api('PUT', '/' + route + '/edit/' + foreign._id, edits)).status, 404);
      assert.equal((await api('DELETE', '/' + route + '/delete/' + foreign._id)).status, 404);
      assert([200, 404].includes((await api('POST', '/' + route + '/deleteMany', [String(foreign._id)])).status));
      const unchanged = await Model.findById(foreign._id);
      assert.equal(unchanged.deleted, false);
      for (const key of Object.keys(edits)) assert.equal(unchanged[key], fields[key]);
      assert.equal((await api('GET', '/' + route + '/view/' + foreign._id, null, admin)).status, 200);
      const own = await api('POST', '/' + route + '/add', { ...fields, createBy: String(second._id) });
      assert.equal(own.status, 200, JSON.stringify(own.data));
      assert.equal(String((await Model.findById(own.data._id)).createBy), String(first._id));
      assert.equal((await api('PUT', '/' + route + '/edit/' + own.data._id, edits)).status, 200);
    }
  });
  await t.test('configuration writes require an administrator and internal modules stay protected', async () => {
    for (const route of ['/custom-field/add-module', '/validation/add', '/images/change-authImg', '/modules/add']) assert.equal((await api('POST', route, {})).status, 403, route);
    assert.equal((await api('POST', '/custom-field/add-module', { moduleName: 'User' }, admin)).status, 400);
    assert.equal((await api('POST', '/custom-field/add-module', { moduleName: '(a+)+$' }, admin)).status, 400);
    const multipart = new FormData(); multipart.set('moduleName', 'User');
    assert.equal((await api('POST', '/custom-field/add-module', multipart, admin)).status, 400);
    const CustomField = require('../model/schema/customField');
    const metadata = await CustomField.create({ moduleName: 'Notification', fields: [] });
    assert.equal((await api('GET', '/form?moduleId=' + metadata._id, null, admin)).status, 404);
    assert.equal((await api('PUT', '/custom-field/change-module-name/' + metadata._id, { moduleName: 'User' }, admin)).status, 400);
    assert.equal((await api('PUT', '/custom-field/change-module-name/' + metadata._id, { moduleName: 'RenamedInternal' }, admin)).status, 400);
    assert.equal((await api('PUT', '/custom-field/change-fields/' + metadata._id, [{ name: 'password', type: 'text' }], admin)).status, 400);
    assert.equal((await api('PUT', '/custom-field/change-single-field/' + metadata._id, { moduleId: String(metadata._id), updatedField: { name: 'authVersion' } }, admin)).status, 400);
  });
  await t.test('custom modules retain ownership on list, view, edit and bulk deletion', async () => {
    const CustomField = require('../model/schema/customField');
    const module = await CustomField.create({ moduleName: 'SecurityCustom', fields: [{ name: 'title', type: 'text', backendType: 'String' }] });
    const Model = require('../controllers/form/form').getModel(module);
    const foreign = await Model.create({ title: 'Foreign custom record', createBy: second._id });
    const own = await api('POST', '/form/add', { moduleId: String(module._id), title: 'Own custom record', createBy: String(second._id) });
    assert.equal(own.status, 200, JSON.stringify(own.data));
    assert.equal(own.data.data.createBy, String(first._id));
    const list = await api('GET', '/form?moduleId=' + module._id);
    assert.equal(list.status, 200); assert.deepEqual(list.data.data.map(record => record._id), [own.data.data._id]);
    assert.equal((await api('GET', '/form/view/' + foreign._id + '?moduleId=' + module._id)).status, 404);
    assert.equal((await api('PUT', '/form/edit/' + foreign._id, { moduleId: String(module._id), title: 'stolen' })).status, 404);
    assert.equal((await api('POST', '/form/deleteMany', { moduleId: String(module._id), ids: [String(foreign._id)] })).status, 403);
    assert.equal((await Model.findById(foreign._id)).deleted, false);
    assert.equal((await api('GET', '/form/view/' + foreign._id + '?moduleId=' + module._id, null, admin)).status, 200);
  });
  await t.test('documents reject foreign folders, unsafe paths and active content', async () => {
    const Document = require('../model/schema/document');
    const foreign = await Document.create({ folderName: 'Private', createBy: second._id });
    assert.equal((await api('POST', '/document/folder', { folderName: 'Child', parentFolder: String(foreign._id) })).status, 404);
    const form = (name, type, contents) => { const body = new FormData(); body.set('files', new Blob([contents], { type }), name); return body; };
    assert.equal((await api('POST', '/document/add', form('evil.html', 'text/html', '<script>alert(1)</script>'))).status, 400);
    assert.equal((await api('POST', '/document/add', form('fake.png', 'image/png', '<script>alert(1)</script>'))).status, 400);
    const upload = await api('POST', '/document/add', form('safe.txt', 'text/plain', 'Test-only text'));
    assert.equal(upload.status, 200, JSON.stringify(upload.data));
    const file = upload.data.folder.file[0];
    assert.equal(file.path, undefined);
    assert.equal((await api('GET', '/document/download/' + file._id)).status, 200);
    assert.equal((await api('GET', '/document/download/' + file._id, null, second)).status, 404);
    const listed = await api('GET', '/document');
    assert(!JSON.stringify(listed.data).includes(uploadRoot));
    const unsafe = await Document.create({ folderName: 'Path fixture', createBy: first._id, file: [{ fileName: '.env', path: path.resolve(__dirname, '../.env') }] });
    assert.equal((await api('GET', '/document/download/' + unsafe.file[0]._id)).status, 404);
    await fs.mkdir(uploadRoot, { recursive: true });
    const legacyName = 'security-test-' + crypto.randomUUID() + '.html';
    const legacyPath = path.join(uploadRoot, legacyName); ownedFiles.add(legacyPath);
    await fs.writeFile(legacyPath, '<script>alert(1)</script>');
    await Document.create({ folderName: 'Legacy fixture', createBy: first._id, file: [{ fileName: legacyName, path: legacyPath, img: '/api/document/images/' + legacyName }] });
    const preview = await api('GET', '/document/images/' + legacyName);
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get('content-type'), /application\/octet-stream/);
    assert.match(preview.headers.get('content-disposition'), /attachment/);
    assert.match(preview.headers.get('content-security-policy'), /sandbox/);
    assert.equal((await api('GET', '/images/authImg/config.json', null, null)).status, 404);
  });
  await t.test('login hides account existence and throttles repeated failures', async () => {
    const wrong = await api('POST', '/user/login', { username: first.username, password: 'incorrect' }, null);
    const missing = await api('POST', '/user/login', { username: 'missing@example.test', password: 'incorrect' }, null);
    assert.equal(wrong.status, missing.status); assert.deepEqual(wrong.data, missing.data);
    assert.equal(wrong.data.code, 'invalidCredentials');
    let response;
    for (let index = 0; index < 21; index++) response = await api('POST', '/user/login', { username: 'missing@example.test', password: 'incorrect' }, null, { 'X-Forwarded-For': '192.0.2.18' });
    assert.equal(response.status, 429);
    assert.equal(response.data.code, 'rateLimited');
    const sharedIp = { 'X-Forwarded-For': '192.0.2.18' };
    // Another account on the same office network can still sign in.
    for (let index = 0; index < 22; index++) {
      const valid = await api('POST', '/user/login', { username: first.username, password: 'test-password-123' }, null, sharedIp);
      assert.equal(valid.status, 200);
      assert.equal(valid.data.user.role, 'user');
    }
    // Whitespace and letter case cannot bypass the blocked account's quota.
    const normalized = await api('POST', '/user/login', { username: ' MISSING@EXAMPLE.TEST ', password: 'incorrect' }, null, sharedIp);
    assert.equal(normalized.status, 429);
    const anotherIp = await api('POST', '/user/login', { username: 'missing@example.test', password: 'incorrect' }, null, { 'X-Forwarded-For': '192.0.2.19' });
    assert.equal(anotherIp.status, 401);
  });
});
