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

test('only persisted admin and developer roles may delegate through task and generic form APIs', async t => {
  const users = ['user', 'user', 'admin', 'developer'].map(role => ({
    _id: new mongoose.Types.ObjectId(), role, deleted: false,
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
  t.mock.method(Task, 'findOne', filter => {
    const task = records.get(String(filter._id));
    const allowed = !filter.$or || (task && filter.$or.some(clause =>
      clause.assignedToUser && !(clause.assignedToUser.$exists === false)
        ? String(task.assignedToUser) === String(clause.assignedToUser)
        : !task.assignedToUser && String(task.createBy) === String(clause.createBy)));
    return query(allowed ? task : null);
  });
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
    for (const role of ['user', 'admin', 'developer']) {
      const denied = await api('POST', prefix + '/add', { ...metadata, title: 'Forbidden', assignedToUser: String(recipient._id) }, ordinary, role);
      assert.equal(denied.status, 403, JSON.stringify(denied));
    }
    assert.equal(notifications.mock.callCount(), before);
    const created = await api('POST', prefix + '/add', { ...metadata, title: 'Own task', delegatedBy: String(admin._id) });
    assert.equal(created.status, 200, JSON.stringify(created));
    const task = unwrap(created.data);
    assert.equal(task.assignedToUser, String(ordinary._id));
    assert.equal(task.createBy, String(ordinary._id));
    assert.equal(task.delegatedBy, undefined);
    const blockedNotifications = notifications.mock.callCount();
    const blockedUpdates = update.mock.callCount();
    for (const assignedToUser of [String(recipient._id), null, '']) {
      const denied = await api('PUT', prefix + '/edit/' + task._id, { ...metadata, assignedToUser }, ordinary, 'developer');
      assert.equal(denied.status, 403, JSON.stringify(denied));
    }
    assert.equal(notifications.mock.callCount(), blockedNotifications);
    assert.equal(update.mock.callCount(), blockedUpdates);
    const edited = await api('PUT', prefix + '/edit/' + task._id, { ...metadata, description: 'Still editable', assignedToUser: String(ordinary._id) });
    assert.equal(edited.status, 200, JSON.stringify(edited));
    assert.equal(unwrap(edited.data).description, 'Still editable');
    const ownEdit = update.mock.calls[update.mock.callCount() - 1].arguments[1].$set;
    assert.equal(Object.hasOwn(ownEdit, 'assignedToUser'), false);
    assert.equal(Object.hasOwn(ownEdit, 'delegatedBy'), false);

    for (const actor of [admin, developer]) {
      const target = actor === admin ? recipient : ordinary;
      const other = actor === admin ? ordinary : recipient;
      const assigned = await api('PUT', prefix + '/edit/' + task._id, { ...metadata, assignedToUser: String(target._id), delegatedBy: String(ordinary._id) }, actor);
      assert.equal(assigned.status, 200, JSON.stringify(assigned));
      assert.equal(unwrap(assigned.data).assignedToUser, String(target._id));
      assert.equal(unwrap(assigned.data).delegatedBy, String(actor._id));
      const updatedByAssignee = await api('PUT', prefix + '/edit/' + task._id, { ...metadata, notes: 'Assignee update' }, target);
      assert.equal(updatedByAssignee.status, 200, JSON.stringify(updatedByAssignee));
      assert.equal(unwrap(updatedByAssignee.data).assignedToUser, String(target._id));
      assert.equal((await api('PUT', prefix + '/edit/' + task._id, { ...metadata, assignedToUser: String(other._id) }, target)).status, 403);
      const assignedAtCreate = await api('POST', prefix + '/add', { ...metadata, title: 'Admin assignment', assignedToUser: String(ordinary._id) }, actor);
      assert.equal(assignedAtCreate.status, 200, JSON.stringify(assignedAtCreate));
      assert.equal(unwrap(assignedAtCreate.data).delegatedBy, String(actor._id));
    }
    const legacy = new Task({ title: 'Legacy unassigned task', createBy: ordinary._id });
    records.set(String(legacy._id), legacy);
    const legacyEdit = await api('PUT', prefix + '/edit/' + legacy._id, { ...metadata, description: 'Legacy edit' });
    assert.equal(legacyEdit.status, 200, JSON.stringify(legacyEdit));
    assert.equal(unwrap(legacyEdit.data).assignedToUser, undefined);
  }
});
