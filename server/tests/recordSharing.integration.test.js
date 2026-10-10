const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

test('individual grants expose only own and explicitly sent records across all nine modules', { skip: process.env.SHARING_INTEGRATION !== '1' }, async t => {
  const dbName = 'crm_sharing_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  mongoose.set('strictQuery', false);
  let server;
  const uploadRoot = path.resolve(__dirname, '../uploads/document');
  const files = [];
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const file of files) { assert(file.startsWith(uploadRoot + path.sep)); await fs.unlink(file).catch(() => {}); }
    assert.equal(mongoose.connection.name, dbName); assert(dbName.startsWith('crm_sharing_test_'));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  });
  t.mock.method(require('../middelwares/mail'), 'sendEmail', async () => null);
  const app = express(); app.use(express.json());
  const { securityHeaders, hideInternalErrors, errorHandler } = require('../middelwares/securityHeaders');
  app.use(securityHeaders, hideInternalErrors); app.use('/api', require('../controllers/route')); app.use(errorHandler);
  const User = require('../model/schema/user');
  const Share = require('../model/schema/recordShare');
  const Notification = require('../model/schema/notification');
  const CustomField = require('../model/schema/customField');
  await Share.init();
  const makeUser = (name, role = 'user') => User.create({ username: name + '@example.test', password: 'unused-test-only', firstName: name, role });
  const admin = await makeUser('admin', 'admin'), user = await makeUser('recipient'), other = await makeUser('other'), empty = await makeUser('empty'), developer = await makeUser('developer', 'developer');
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const api = async (method, route, body, actor = user, headers = {}) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api' + route, {
      method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: jwt.sign({ userId: actor._id }, jwtSecret, { expiresIn: '5m' }) } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data };
  };
  const sharing = require('../services/recordSharing'), visibility = require('../services/moduleVisibility');
  const routes = { Contacts: '/contact', Leads: '/lead', Opportunities: '/opportunity', Invoices: '/invoices', Meetings: '/meeting', Calls: '/phoneCall', Emails: '/email', 'Partner Customers': '/estate/Partner%20Customers' };
  const insert = async (Model, owner, title, extra = {}) => {
    const record = { _id: new mongoose.Types.ObjectId(), createBy: owner._id, deleted: false, title, firstName: title, lastName: 'Test', leadName: title, opportunityName: title, fullName: title, customerType: 'INDIVIDUAL', subject: title, agenda: title, ...extra };
    await Model.collection.insertOne(record); return record;
  };
  const rows = result => Array.isArray(result.data) ? result.data : result.data.items;
  const ids = values => values.map(row => String(row._id)).sort();
  const send = (module, recordId, actor = admin, recipient = user) => api('POST', '/record-sharing', { module, recordId: String(recordId), recipientId: String(recipient._id) }, actor);
  const detailPath = (module, id) => routes[module] + (module === 'Partner Customers' ? '/' : '/view/') + id;
  const fixtures = {};
  for (const [module] of Object.entries(routes)) {
    const Model = sharing.modelFor(module);
    fixtures[module] = { own: await insert(Model, user, 'Own ' + module), sent: await insert(Model, admin, 'Sent ' + module), foreign: await insert(Model, other, 'Foreign ' + module) };
  }
  const ownTask = await insert(sharing.modelFor('Tasks'), admin, 'Assigned own task', { assignedToUser: user._id, status: 'todo' });
  const foreignTask = await insert(sharing.modelFor('Tasks'), user, 'Assigned other task', { assignedToUser: other._id, status: 'todo' });
  const legacyTask = await insert(sharing.modelFor('Tasks'), user, 'Legacy own task', { status: 'todo' });
  await t.test('defaults are hidden; empty users have no module exceptions and own records remain visible', async () => {
    const me = await api('GET', '/visibility/me');
    for (const module of visibility.defaultHidden) assert.equal(me.data.visibility[module], false, module);
    assert.deepEqual(me.data.accessibleModules.sort(), [...Object.keys(routes), 'Tasks'].sort());
    assert.deepEqual((await api('GET', '/visibility/me', null, empty)).data.accessibleModules, []);
    assert.deepEqual(ids((await api('GET', '/task')).data), ids([ownTask, legacyTask]));
    assert.equal((await api('GET', '/task/view/' + foreignTask._id)).status, 404);
    assert.equal((await api('GET', '/reporting')).status, 200);
    assert.deepEqual(ids((await api('GET', '/reporting')).data), [String(user._id)]);
    const adminSettings = await api('GET', '/visibility', null, admin);
    for (const ordinary of adminSettings.data.users) for (const module of visibility.defaultHidden) assert.equal(ordinary.moduleVisibility[module], false);
    for (const [module, route] of Object.entries(routes)) {
      const result = await api('GET', route); assert.equal(result.status, 200, route + JSON.stringify(result));
      assert.deepEqual(ids(rows(result)), ids([fixtures[module].own]), module);
      assert.equal((await api('GET', detailPath(module, fixtures[module].sent._id))).status, 404, module);
    }
  });
  await t.test('only administrators send; lists and details include own plus sent items and never neighbors', async () => {
    assert.equal((await api('GET', '/record-sharing/users')).status, 403);
    const directory = await api('GET', '/record-sharing/users', null, admin);
    assert.equal(directory.status, 200); assert.equal(directory.data.length, 3); assert(!JSON.stringify(directory.data).includes('password'));
    for (const [module, route] of Object.entries(routes)) {
      const { own, sent, foreign } = fixtures[module];
      assert.equal((await send(module, sent._id, user)).status, 403);
      assert.equal((await send(module, sent._id)).status, 201, module);
      assert.equal((await send(module, sent._id)).data.created, false);
      assert.equal(await Share.countDocuments({ module, recipient: user._id }), 1);
      const listed = await api('GET', route); assert.equal(listed.status, 200, module);
      assert.deepEqual(ids(rows(listed)), ids([own, sent]), module);
      assert.equal(rows(listed).find(row => row._id === String(sent._id))._receivedFromAdmin, true, module);
      assert.equal(rows(listed).find(row => row._id === String(own._id))._receivedFromAdmin, false, module);
      assert.equal((await api('GET', detailPath(module, sent._id))).status, 200, module);
      assert.equal((await api('GET', detailPath(module, foreign._id))).status, 404, module);
      assert(!ids(rows(await api('GET', route, null, other))).includes(String(sent._id)), module);
      assert.equal((await api('GET', route + (module === 'Partner Customers' ? '?q=Foreign' : '?_id=' + foreign._id))).status, 200);
      assert.deepEqual(rows(await api('GET', route + (module === 'Partner Customers' ? '?q=Foreign' : '?_id=' + foreign._id))), [], module);
      if (['Contacts', 'Leads', 'Opportunities', 'Invoices'].includes(module)) {
        assert.equal((await api('PUT', route + '/edit/' + sent._id, { title: 'Denied' })).status, 404, module);
        assert.equal((await api('DELETE', route + '/delete/' + sent._id)).status, 404, module);
      }
    }
    assert.equal(await Notification.countDocuments({ recipient: user._id, type: 'record_shared' }), 8);
    const metadata = await CustomField.create({ moduleName: 'Leads', fields: [] });
    const generic = await api('GET', '/form?moduleId=' + metadata._id);
    assert.deepEqual(ids(generic.data.data), ids([fixtures.Leads.own, fixtures.Leads.sent]));
    assert.equal((await api('GET', '/form/view/' + fixtures.Leads.foreign._id + '?moduleId=' + metadata._id)).status, 404);
    const internal = await CustomField.create({ moduleName: 'RecordShare', fields: [] });
    assert.equal((await api('GET', '/form?moduleId=' + internal._id, null, admin)).status, 404);
    assert.equal((await api('POST', '/custom-field/add-module', { moduleName: 'RecordShares' }, admin)).status, 400);
  });
  const Document = sharing.modelFor('Documents');
  const makeFile = async name => {
    const filename = 'sharing-test-' + crypto.randomUUID() + '.txt', filenamePath = path.join(uploadRoot, filename);
    await fs.mkdir(uploadRoot, { recursive: true }); await fs.writeFile(filenamePath, name); files.push(filenamePath);
    return { _id: new mongoose.Types.ObjectId(), fileName: name + '.txt', path: filenamePath, img: '/api/document/images/' + filename, deleted: false, linkContact: fixtures.Contacts.sent._id, linkLead: fixtures.Leads.sent._id };
  };
  const sentFile = await makeFile('Shared file'), neighbor = await makeFile('Private neighbor'), ownFile = await makeFile('Own file');
  const folder = await Document.create({ folderName: 'Foreign folder', createBy: admin._id, parentFolder: new mongoose.Types.ObjectId(), file: [sentFile, neighbor] });
  await Document.create({ folderName: 'Own folder', createBy: user._id, file: [ownFile] });
  await t.test('sending a document grants exactly one file including downloads, previews and related histories', async () => {
    assert.equal((await send('Documents', sentFile._id)).status, 201);
    assert.equal((await api('GET', '/document/download/' + sentFile._id)).status, 200);
    assert.equal((await api('GET', '/document/images/' + path.basename(sentFile.img))).status, 200);
    assert.equal((await api('GET', '/document/download/' + neighbor._id)).status, 404);
    assert.equal((await api('GET', '/document/images/' + path.basename(neighbor.img))).status, 404);
    assert.equal((await api('GET', '/document/download/' + ownFile._id)).status, 200);
    assert.equal((await api('GET', '/document/download/' + sentFile._id, null, other)).status, 404);
    const listed = (await api('GET', '/document')).data;
    const sharedFolder = listed.find(row => row._id === String(folder._id));
    assert.deepEqual(ids(sharedFolder.file), ids([sentFile])); assert.deepEqual(ids(sharedFolder.files), ids([sentFile]));
    assert.equal(sharedFolder.files[0]._receivedFromAdmin, true); assert.equal(sharedFolder.parentFolder, null);
    assert(!JSON.stringify(listed).includes(uploadRoot));
    for (const [module, item] of [['Contacts', fixtures.Contacts.sent], ['Leads', fixtures.Leads.sent]]) {
      const related = (await api('GET', detailPath(module, item._id))).data.Document.flatMap(row => row.files);
      assert.deepEqual(ids(related), ids([sentFile, ownFile]), module);
      assert(!ids(related).includes(String(neighbor._id)));
      assert(!JSON.stringify(related).includes(uploadRoot));
    }
  });
  await t.test('notification counts and read operations follow individual visibility and recipient isolation', async () => {
    const invisible = await Notification.create({ recipient: user._id, module: 'Leads', entityId: fixtures.Leads.foreign._id, type: 'record_created', message: 'Private' });
    await Notification.create({ recipient: other._id, module: 'Leads', entityId: fixtures.Leads.sent._id, type: 'record_shared', message: 'Other inbox' });
    const inbox = (await api('GET', '/notification')).data;
    assert.equal(inbox.unreadCount, 9); assert.equal(inbox.notifications.length, 9);
    assert(inbox.notifications.every(row => row.type === 'record_shared'));
    assert.equal((await api('PUT', '/notification/' + invisible._id + '/read')).status, 404);
    const item = inbox.notifications[0];
    assert.equal((await api('PUT', '/notification/' + item._id + '/read', null, other)).status, 404);
    assert.equal((await api('PUT', '/notification/' + item._id + '/read')).status, 200);
    assert.equal((await api('GET', '/notification')).data.unreadCount, 8);
    const all = await api('PUT', '/notification/read-all'); assert.equal(all.status, 200, JSON.stringify(all));
    assert.equal(all.data.unreadCount, 0);
    assert.equal((await Notification.findById(invisible._id)).readAt, null);
  });
  await t.test('input validation, explicit full visibility, revocation and user self-edits cannot widen grants', async () => {
    assert.equal((await send('Users', fixtures.Leads.sent._id)).status, 400);
    assert.equal((await send('Leads', 'invalid')).status, 400);
    assert.equal((await send('Leads', fixtures.Leads.sent._id, admin, admin)).status, 404);
    const removed = await insert(sharing.modelFor('Leads'), admin, 'Deleted', { deleted: true });
    assert.equal((await send('Leads', removed._id)).status, 404);
    assert.equal((await api('PUT', '/visibility/' + user._id, { visibility: { Leads: true } })).status, 403);
    assert.equal((await api('PUT', '/visibility/' + user._id, { visibility: { Leads: true } }, developer)).status, 200);
    assert.deepEqual(ids((await api('GET', '/lead')).data), ids(Object.values(fixtures.Leads)));
    assert.equal((await api('PUT', '/visibility/' + user._id, { visibility: { Leads: false } }, admin)).status, 200);
    await api('PUT', '/user/edit/' + user._id, { moduleVisibility: { Leads: true } });
    assert.equal((await api('GET', '/visibility/me')).data.visibility.Leads, false);
    const endpoint = '/record-sharing/Leads/' + fixtures.Leads.sent._id + '/' + user._id;
    assert.equal((await api('DELETE', endpoint)).status, 403);
    assert.equal((await api('DELETE', endpoint, null, admin)).status, 200);
    assert.deepEqual(ids((await api('GET', '/lead')).data), ids([fixtures.Leads.own]));
    assert.equal((await api('GET', detailPath('Leads', fixtures.Leads.sent._id))).status, 404);
    assert((await api('GET', '/notification')).data.notifications.every(item => item.entityId !== String(fixtures.Leads.sent._id)));
    assert.equal((await send('Leads', fixtures.Leads.sent._id, admin, empty)).status, 201);
    assert((await api('GET', '/visibility/me', null, empty)).data.accessibleModules.includes('Leads'));
    await api('DELETE', '/record-sharing/Leads/' + fixtures.Leads.sent._id + '/' + empty._id, null, admin);
    assert(!(await api('GET', '/visibility/me', null, empty)).data.accessibleModules.includes('Leads'));
    assert.equal((await api('GET', '/lead', null, user, { 'X-CRM-Data-User': String(admin._id) })).status, 403);
    assert.equal((await send('Documents', sentFile._id, admin, empty)).status, 201);
    await Document.updateOne({ _id: folder._id }, { $set: { 'file.0.deleted': true } });
    assert.equal((await api('GET', '/document/download/' + sentFile._id, null, empty)).status, 404);
    assert(!(await api('GET', '/visibility/me', null, empty)).data.accessibleModules.includes('Documents'));
    assert.deepEqual((await api('GET', '/document', null, empty)).data, []);
  });
  await t.test('disabled general visibility preserves new data entry and ownership across every business page', async () => {
    const actor = empty;
    for (const name of visibility.defaultHidden) assert.equal((await api('GET', '/visibility/me', null, actor)).data.visibility[name], false, name);
    const payloads = {
      Contacts: { firstName: 'New own contact', lastName: 'Test' },
      Leads: { leadName: 'New own lead' },
      Opportunities: { opportunityName: 'New own opportunity' },
      Invoices: { title: 'New own invoice' },
      Meetings: { agenda: 'New own meeting', dateTime: '2026-10-12T12:00:00Z' },
      Calls: { recipient: '12345', callNotes: 'New own call', callDuration: '1' },
      Emails: { recipient: 'test@example.test', subject: 'New own email', message: 'Test' },
      'Partner Customers': { customerType: 'INDIVIDUAL', fullName: 'New own partner', status: 'ACTIVE' },
    };
    for (const [module, route] of Object.entries(routes)) {
      assert.deepEqual(rows(await api('GET', route, null, actor)), [], module + ' empty page accessible');
      const created = await api('POST', route + (module === 'Partner Customers' ? '' : '/add'), { ...payloads[module], createBy: String(admin._id), sender: String(admin._id) }, actor);
      assert([200, 201].includes(created.status), module + ' creation: ' + JSON.stringify(created));
      const item = created.data.result || created.data;
      assert.equal(String(item.createBy), String(actor._id), module + ' actor owns new record');
      assert.deepEqual(ids(rows(await api('GET', route, null, actor))), [String(item._id)], module + ' new record readable');
      assert.equal((await api('GET', detailPath(module, item._id), null, actor)).status, 200, module);
      if (['Contacts', 'Leads', 'Opportunities', 'Invoices'].includes(module)) {
        const updated = await api('PUT', route + '/edit/' + item._id, { ...payloads[module] }, actor);
        assert.equal(updated.status, 200, module + ' own update: ' + JSON.stringify(updated));
        assert.equal((await api('DELETE', route + '/delete/' + fixtures[module].sent._id, null, actor)).status, 404, module + ' foreign mutation denied');
      }
    }
    assert.equal((await api('POST', '/task/add', { title: 'Denied new own task' }, actor)).status, 403);
    const task = await api('POST', '/task/add', { title: 'Admin-assigned task', assignedToUser: String(actor._id) }, admin);
    assert.equal(task.status, 200, JSON.stringify(task));
    const newTask = task.data.result || task.data;
    assert.equal(String(newTask.assignedToUser), String(actor._id));
    assert.equal((await api('GET', '/task/view/' + newTask._id, null, actor)).status, 200);
    assert.equal((await api('PUT', '/task/changeStatus/' + newTask._id, { status: 'completed' }, actor)).status, 403);
    assert.equal((await api('DELETE', '/task/delete/' + newTask._id, null, actor)).status, 403);
    assert.equal((await api('PUT', '/task/edit/' + newTask._id, { title: 'Denied own edit' }, actor)).status, 403);
    assert.equal((await api('PUT', '/task/edit/' + foreignTask._id, { title: 'Denied edit' }, actor)).status, 403);
    const newFolder = await api('POST', '/document/folder', { folderName: 'New own folder' }, actor);
    assert.equal(newFolder.status, 201, JSON.stringify(newFolder));
    assert.equal(newFolder.data.createBy, String(actor._id));
    assert((await api('GET', '/document', null, actor)).data.some(row => row._id === newFolder.data._id));
    const formData = new FormData();
    formData.append('folderId', newFolder.data._id);
    formData.append('files', new Blob(['Own test document'], { type: 'text/plain' }), 'own-data-entry.txt');
    const uploadResponse = await fetch('http://127.0.0.1:' + server.address().port + '/api/document/add', {
      method: 'POST', headers: { Authorization: jwt.sign({ userId: actor._id }, jwtSecret, { expiresIn: '5m' }) }, body: formData,
    });
    const uploaded = await uploadResponse.json();
    const storedUpload = uploaded.folder?._id && await Document.findById(uploaded.folder._id).lean();
    if (storedUpload?.file) for (const item of storedUpload.file) files.push(item.path);
    assert.equal(uploadResponse.status, 200, JSON.stringify(uploaded));
    const uploadedFile = uploaded.folder.file[0];
    assert.equal((await api('GET', '/document/download/' + uploadedFile._id, null, actor)).status, 200);
    assert.equal((await api('GET', '/document/download/' + uploadedFile._id, null, other)).status, 404);

    const formModule = await CustomField.findOne({ moduleName: 'Leads' });
    const generic = await api('POST', '/form/add', { moduleId: String(formModule._id), leadName: 'New own generic lead', leadEmail: 'new@example.test' }, actor);
    assert.equal(generic.status, 200, 'generic creation: ' + JSON.stringify(generic));
    assert.equal((await api('GET', '/reporting', null, actor)).status, 200);
    assert.deepEqual(ids((await api('GET', '/reporting', null, actor)).data), [String(actor._id)]);
    assert.equal((await api('POST', '/user/register', { username: 'denied@example.test', password: 'Test123!' }, actor)).status, 403);
  });

});
