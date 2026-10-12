const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

test('documents support individual sending, whole folder sending, and moving with access preserved', { skip: process.env.DOCUMENTS_INTEGRATION !== '1' }, async t => {
  const dbName = 'crm_document_actions_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  mongoose.set('strictQuery', false);
  let server;
  const uploadRoot = path.resolve(__dirname, '../uploads/document'), paths = [];
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const filePath of paths) { assert(filePath.startsWith(uploadRoot + path.sep)); await fs.unlink(filePath).catch(() => {}); }
    assert.equal(mongoose.connection.name, dbName);
    assert(dbName.startsWith('crm_document_actions_test_'));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  });
  const app = express(); app.use(express.json());
  const { securityHeaders, hideInternalErrors, errorHandler } = require('../middelwares/securityHeaders');
  app.use(securityHeaders, hideInternalErrors); app.use('/api', require('../controllers/route')); app.use(errorHandler);
  const User = require('../model/schema/user'), Document = require('../model/schema/document');
  const Share = require('../model/schema/recordShare'), Notification = require('../model/schema/notification');
  await Share.init();
  const makeUser = (name, role = 'user') => User.create({ username: name + '@example.test', password: 'unused-test-only', firstName: name, role });
  const admin = await makeUser('admin', 'admin'), user = await makeUser('recipient'), other = await makeUser('other');
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const api = async (method, route, body, actor = admin) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api' + route, {
      method, headers: { 'Content-Type': 'application/json', Authorization: jwt.sign({ userId: actor._id }, jwtSecret, { expiresIn: '5m' }) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data };
  };
  const makeFile = async name => {
    const filename = 'document-actions-test-' + crypto.randomUUID() + '.txt', filePath = path.join(uploadRoot, filename);
    await fs.mkdir(uploadRoot, { recursive: true }); await fs.writeFile(filePath, name); paths.push(filePath);
    return { _id: new mongoose.Types.ObjectId(), fileName: name + '.txt', path: filePath, img: '/api/document/images/' + filename, mimeType: 'text/plain', deleted: false, customFields: { reference: name } };
  };
  const rootFile = await makeFile('Root'), rootNeighbor = await makeFile('Root neighbor');
  const first = await makeFile('First'), second = await makeFile('Second'), nested = await makeFile('Nested');
  const privateFile = await makeFile('Private'), ownFile = await makeFile('Own');
  const root = await Document.create({ folderName: '__ROOT__', isRoot: true, createBy: admin._id, file: [rootFile, rootNeighbor] });
  const folder = await Document.create({ folderName: 'Folder', createBy: admin._id, file: [first, second] });
  const child = await Document.create({ folderName: 'Child', parentFolder: folder._id, createBy: admin._id, file: [nested] });
  const sibling = await Document.create({ folderName: 'Sibling', createBy: admin._id, file: [privateFile] });
  const own = await Document.create({ folderName: 'Own', createBy: user._id, file: [ownFile] });
  const send = (id, actor = admin) => api('POST', '/record-sharing', { module: 'Documents', recordId: String(id), recipientId: String(user._id) }, actor);
  const revoke = id => api('DELETE', '/record-sharing/Documents/' + id + '/' + user._id);
  const listing = async () => (await api('GET', '/document', null, user)).data;
  const ids = rows => rows.map(row => String(row._id)).sort();
  const visibleIds = async () => ids((await listing()).flatMap(row => row.files));
  const moveFile = (id, destination, actor = admin) => api('POST', '/document/move/file/' + id, { folderId: destination == null ? null : String(destination) }, actor);
  const moveFolder = (id, destination, actor = admin) => api('POST', '/document/move/folder/' + id, { folderId: destination == null ? null : String(destination) }, actor);

  await t.test('standalone files and files inside folders are sent independently', async () => {
    assert.equal((await send(rootFile._id)).status, 201);
    assert.equal((await send(first._id)).status, 201);
    assert.deepEqual(await visibleIds(), ids([rootFile, first, ownFile]));
    assert.equal((await api('GET', '/document/download/' + rootFile._id, null, user)).data, 'Root');
    assert.equal((await api('GET', '/document/download/' + second._id, null, user)).status, 404);
    assert.equal((await send(folder._id, user)).status, 403);
    assert.equal((await send(root._id)).status, 404);
    const recipients = await api('GET', '/record-sharing/Documents/' + first._id);
    assert.equal(recipients.data[0].user.firstName, 'recipient');
  });

  await t.test('sending a whole folder grants its tree, empty folders, and subsequent files without exposing neighboring folders', async () => {
    assert.equal((await send(folder._id)).status, 201);
    assert.equal((await send(folder._id)).status, 200);
    assert.equal(await Share.countDocuments({ recordId: folder._id, recipient: user._id }), 1);
    assert.deepEqual(await visibleIds(), ids([rootFile, first, second, nested, ownFile]));
    assert.equal((await api('GET', '/document/download/' + nested._id, null, user)).data, 'Nested');
    assert.equal((await api('GET', '/document/images/' + path.basename(nested.img), null, user)).status, 200);
    assert.equal((await api('GET', '/document/download/' + privateFile._id, null, user)).status, 404);
    assert.equal((await api('GET', '/document/download/' + nested._id, null, other)).status, 404);
    const empty = await Document.create({ folderName: 'Empty', parentFolder: child._id, createBy: admin._id, file: [] });
    const later = await makeFile('Later');
    await Document.updateOne({ _id: child._id }, { $push: { file: later } });
    const rows = await listing();
    assert(rows.some(row => row._id === String(empty._id)));
    assert.equal(rows.find(row => row._id === String(child._id)).parentFolder, String(folder._id));
    assert(rows.find(row => row._id === String(child._id)).files.every(file => file._receivedFromAdmin));
    assert.equal((await api('GET', '/document/download/' + later._id, null, user)).status, 200);
    assert(!JSON.stringify(rows).includes(uploadRoot));
    const notice = await Notification.findOne({ type: 'record_shared', recipient: user._id, entityId: folder._id });
    assert.equal(notice.link, '/documents?folder=' + folder._id);
    assert.equal((await api('GET', '/record-sharing/Documents/' + folder._id)).data[0].user.firstName, 'recipient');
    await Document.updateOne({ _id: child._id }, { $pull: { file: { _id: later._id } } });
  });

  await t.test('legacy folders without a root marker support inherited sharing', async () => {
    const legacy = await Document.create({ folderName: 'Legacy', createBy: admin._id, file: [] });
    await Document.collection.updateOne({ _id: legacy._id }, { $unset: { isRoot: '' } });
    const legacyFile = await makeFile('Legacy nested');
    await Document.create({ folderName: 'Legacy child', parentFolder: legacy._id, createBy: admin._id, file: [legacyFile] });
    assert.equal((await send(legacy._id)).status, 201);
    assert.equal((await api('GET', '/document/download/' + legacyFile._id, null, user)).status, 200);
    assert.equal((await revoke(legacy._id)).status, 200);
    assert.equal((await api('GET', '/document/download/' + legacyFile._id, null, user)).status, 404);
  });

  await t.test('revoking a folder preserves independently sent files', async () => {
    assert.equal((await send(nested._id)).status, 201);
    assert.equal((await revoke(folder._id)).status, 200);
    assert.deepEqual(await visibleIds(), ids([rootFile, first, nested, ownFile]));
    assert.equal((await api('GET', '/document/download/' + second._id, null, user)).status, 404);
    assert.equal((await revoke(nested._id)).status, 200);
    assert.equal((await send(folder._id)).status, 201);
  });

  await t.test('moving between folders and no-folder storage preserves IDs, metadata, bytes and direct grants', async () => {
    assert.equal((await moveFile(rootFile._id, folder._id)).status, 200);
    assert(!(await Document.findById(root._id)).file.id(rootFile._id));
    assert((await Document.findById(folder._id)).file.id(rootFile._id));
    assert.equal((await moveFile(first._id, null)).status, 200);
    const persisted = (await Document.findById(root._id)).file.id(first._id);
    assert.equal(persisted.customFields.reference, 'First'); assert.equal(persisted.path, first.path);
    assert.equal((await api('GET', '/document/download/' + first._id, null, user)).data, 'First');
    assert.equal((await moveFile(second._id, sibling._id)).status, 200);
    assert.equal((await api('GET', '/document/download/' + second._id, null, user)).status, 404);
    assert.equal((await api('GET', '/document/download/' + second._id)).data, 'Second');
    assert.equal((await moveFile(second._id, sibling._id)).data.moved, false);
    assert.equal((await moveFile(rootFile._id, own._id)).status, 404);
    assert.equal((await moveFile(rootFile._id, sibling._id, user)).status, 404);
    assert.equal((await moveFile(ownFile._id, null, user)).status, 200);
    assert.equal((await api('GET', '/document/download/' + ownFile._id, null, user)).data, 'Own');
    assert.equal((await moveFile(rootFile._id, 'invalid')).status, 400);
    assert.equal((await moveFile(new mongoose.Types.ObjectId(), null)).status, 404);
  });

  await t.test('an unsuccessful source removal rolls back the destination copy', async () => {
    const update = Document.collection.updateOne;
    const mock = t.mock.method(Document.collection, 'updateOne', async function(filter, ...args) {
      if (String(filter._id) === String(sibling._id) && filter.file?.fileName === second.fileName) return { modifiedCount: 0 };
      return update.call(this, filter, ...args);
    });
    try { assert.equal((await moveFile(second._id, folder._id)).status, 409); } finally { mock.mock.restore(); }
    assert((await Document.findById(sibling._id)).file.id(second._id));
    assert(!(await Document.findById(folder._id)).file.id(second._id));
  });

  await t.test('whole-folder moves preserve their contents and reject self/descendant cycles and foreign ownership', async () => {
    assert.equal((await moveFolder(folder._id, folder._id)).status, 400);
    const cycle = await moveFolder(folder._id, child._id);
    assert.equal(cycle.status, 400); assert.equal(cycle.data.code, 'documentFolderCycle');
    assert.equal((await moveFolder(folder._id, sibling._id, user)).status, 404);
    assert.equal((await moveFolder(folder._id, own._id)).status, 404);
    assert.equal((await moveFolder(root._id, sibling._id)).status, 404);
    assert.equal((await moveFolder(child._id, sibling._id)).status, 200);
    assert.equal(String((await Document.findById(child._id)).parentFolder), String(sibling._id));
    assert.equal((await api('GET', '/document/download/' + nested._id, null, user)).status, 404);
    assert.equal((await moveFolder(child._id, null)).status, 200);
    assert.equal((await Document.findById(child._id)).parentFolder, null);
    assert((await Document.findById(child._id)).file.id(nested._id));
    assert.equal((await moveFolder(own._id, null, user)).status, 200);
  });
});
