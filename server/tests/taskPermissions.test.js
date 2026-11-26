const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../model/schema/user');
const Task = require('../model/schema/task');
const Notification = require('../model/schema/notification');
const CustomField = require('../model/schema/customField');
const FormDefinition = require('../model/schema/formDefinition');
const { jwtSecret } = require('../config/auth');

test('ordinary users manage only personal tasks for themselves across direct and generic APIs; administrative roles assign anyone', async t => {
  t.mock.method(require('../services/recordSharing'), 'loadShares', async () => []);
  const users = ['user', 'user', 'admin', 'developer'].map(role => ({
    _id: new mongoose.Types.ObjectId(), role, deleted: false, moduleVisibility: { Tasks: true },
  }));
  const [ordinary, recipient, admin, developer] = users;
  const module = { _id: new mongoose.Types.ObjectId(), moduleName: 'Tasks', fields: [] };
  const records = new Map();
  const query = value => ({
    select() { return this; }, sort() { return this; },
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  });
  t.mock.method(User, 'findOne', filter => query(users.find(user => String(user._id) === String(filter._id))));
  t.mock.method(User, 'find', () => query(users));
  t.mock.method(User, 'exists', async filter => users.some(user => String(user._id) === String(filter._id)));
  t.mock.method(CustomField, 'findById', () => query(module));
  t.mock.method(CustomField, 'findOne', () => query(module));
  t.mock.method(FormDefinition, 'findOne', () => query(null));
  const notifications = t.mock.method(Notification, 'create', async value => value);
  t.mock.method(require('../middelwares/mail'), 'sendEmail', async () => null);
  t.mock.method(Task, 'create', async values => {
    const task = new Task(values);
    await task.validate();
    records.set(String(task._id), task);
    return task;
  });
  const matches = (task, filter) => Object.entries(filter).every(([key, value]) => {
    if (key === '$and') return value.every(clause => matches(task, clause));
    if (key === '$or') return value.some(clause => matches(task, clause));
    if (value == null) return task[key] == null;
    if (typeof value === 'object' && '$exists' in value) return (task[key] != null) === value.$exists;
    if (typeof value === 'object' && '$in' in value) return value.$in.map(String).includes(String(task[key]));
    if (typeof value === 'object' && '$ne' in value) return String(task[key]) !== String(value.$ne);
    return String(task[key]) === String(value);
  });
  t.mock.method(Task, 'findOne', filter => query([...records.values()].find(task => matches(task, filter)) || null));
  t.mock.method(Task, 'aggregate', async pipeline => { const match = pipeline[0].$match; return [...records.values()].filter(task => !match._id || String(task._id) === String(match._id)); });
  const findMatching = filter => [...records.values()].filter(task => matches(task, filter));
  t.mock.method(Task, 'find', filter => query(findMatching(filter)));
  t.mock.method(Task, 'exists', async filter => findMatching(filter).length ? { _id: findMatching(filter)[0]._id } : null);
  t.mock.method(Task, 'countDocuments', async filter => findMatching(filter).length);
  t.mock.method(Task, 'updateMany', async (filter, values) => { const hits = findMatching(filter); hits.forEach(task => task.set(values.$set || values)); return { modifiedCount: hits.length }; });
  t.mock.method(Task.prototype, 'save', async function () { await this.validate(); return this; });
  const update = t.mock.method(Task, 'findByIdAndUpdate', async (id, values) => {
    const task = records.get(String(id));
    task.set(values.$set);
    await task.validate();
    return task;
  });
  const app = express();
  app.use(express.json());
  app.use('/task', require('../controllers/task/_routes'));
  app.use('/form', require('../controllers/form/_routes'));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const api = async (method, route, body, actor = ordinary, claimedRole = actor.role) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + route, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: jwt.sign({ userId: actor._id, role: claimedRole }, jwtSecret, { expiresIn: '5m' }) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  assert.equal((await api('GET', '/task/assignees')).status, 403);
  for (const actor of [admin, developer]) assert.equal((await api('GET', '/task/assignees', null, actor)).status, 200);


  for (const prefix of ['/task', '/form']) {
    const metadata = prefix === '/form' ? { moduleId: String(module._id) } : {};
    const unwrap = data => prefix === '/form' ? data.data : data;
    const before = notifications.mock.callCount();
    // Ordinary users cannot create tasks for other users, even with a forged role claim.
    for (const claimedRole of ['user', 'admin', 'developer']) {
      const denied = await api('POST', prefix + '/add', { ...metadata, title: 'Forbidden', assignedToUser: String(recipient._id) }, ordinary, claimedRole);
      assert.equal(denied.status, 403, JSON.stringify(denied));
    }
    assert.equal(notifications.mock.callCount(), before);
    // Ordinary users can create personal tasks for themselves and manage them.
    for (const body of [{ assignedToUser: String(ordinary._id) }, {}]) {
      const own = await api('POST', prefix + '/add', { ...metadata, title: 'Personal', ...body }, ordinary);
      assert.equal(own.status, 200, JSON.stringify(own));
      const ownTask = unwrap(own.data);
      assert.equal(ownTask.assignedToUser, String(ordinary._id));
      assert.equal(ownTask.createBy, String(ordinary._id));
      assert.equal((await api('PUT', prefix + '/edit/' + ownTask._id, { ...metadata, description: 'Own edit' })).status, 200);
      assert.equal((await api('PUT', prefix + '/edit/' + ownTask._id, { ...metadata, assignedToUser: String(recipient._id) })).status, 403);
      if (prefix === '/task') assert.equal((await api('PUT', '/task/changeStatus/' + ownTask._id, { status: 'completed' })).status, 200);
    }
    const created = await api('POST', prefix + '/add', { ...metadata, title: 'Admin assignment', assignedToUser: String(ordinary._id) }, admin);
    assert.equal(created.status, 200, JSON.stringify(created));
    const task = unwrap(created.data);
    assert.equal(task.assignedToUser, String(ordinary._id));
    assert.equal(task.createBy, String(admin._id));
    assert.equal(task.delegatedBy, String(admin._id));
    const detailPath = prefix + '/view/' + task._id + (prefix === '/form' ? '?moduleId=' + module._id : '');
    assert.equal((await api('GET', detailPath)).status, 200);
    const blockedNotifications = notifications.mock.callCount(), blockedUpdates = update.mock.callCount();
    // Tasks an administrator delegated stay read-only for the ordinary assignee (refused as 403 or hidden as 404).
    const refused = response => assert.ok([403, 404].includes(response.status), JSON.stringify(response));
    for (const claimedRole of ['user', 'admin', 'developer']) {
      refused(await api('PUT', prefix + '/edit/' + task._id, { ...metadata, description: 'Denied own edit' }, ordinary, claimedRole));
      refused(await api('DELETE', prefix + '/delete/' + task._id + (prefix === '/form' ? '?moduleId=' + module._id : ''), null, ordinary, claimedRole));
      const bulkBody = prefix === '/form' ? { ...metadata, ids: [task._id] } : [task._id];
      await api('POST', prefix + '/deleteMany', bulkBody, ordinary, claimedRole);
      assert.equal(records.get(String(task._id)).deleted, false);
      if (prefix === '/task') refused(await api('PUT', '/task/changeStatus/' + task._id, { status: 'completed' }, ordinary, claimedRole));
    }
    assert.equal(notifications.mock.callCount(), blockedNotifications);
    assert.equal(update.mock.callCount(), blockedUpdates);
    for (const actor of [admin, developer]) {
      const target = actor === admin ? recipient : ordinary;
      const assigned = await api('PUT', prefix + '/edit/' + task._id, { ...metadata, assignedToUser: String(target._id), notes: 'Admin edit' }, actor);
      assert.equal(assigned.status, 200, JSON.stringify(assigned));
      assert.equal(unwrap(assigned.data).assignedToUser, String(target._id));
      assert.equal(unwrap(assigned.data).delegatedBy, String(actor._id));
      refused(await api('PUT', prefix + '/edit/' + task._id, { ...metadata, notes: 'Denied assignee edit' }, target));
      const assignedAtCreate = await api('POST', prefix + '/add', { ...metadata, title: 'Admin assignment', assignedToUser: String(ordinary._id) }, actor);
      assert.equal(assignedAtCreate.status, 200, JSON.stringify(assignedAtCreate));
    }
    const legacy = new Task({ title: 'Legacy unassigned task', createBy: ordinary._id });
    records.set(String(legacy._id), legacy);
    refused(await api('PUT', prefix + '/edit/' + legacy._id, { ...metadata, description: 'Denied legacy edit' }));
    assert.equal((await api('GET', prefix + '/view/' + legacy._id + (prefix === '/form' ? '?moduleId=' + module._id : ''))).status, 200);
  }

});
