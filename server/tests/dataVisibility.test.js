const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { can, scope } = require('../middelwares/permissions');
const { taskScope } = require('../services/taskAccess');
const User = require('../model/schema/user');
const Task = require('../model/schema/task');
const { Lead } = require('../model/schema/lead');
const actor = { _id: new mongoose.Types.ObjectId(), role: 'user', moduleVisibility: { Contacts: true, Tasks: true, Leads: true } };

test('ordinary users can read every module while administrative mutations stay restricted', () => {
  for (const module of ['Users', 'Roles', 'Custom Fields', 'Active Deactive Module', 'Contacts', 'Properties', 'Tasks']) {
    assert.equal(can(actor, module, 'view'), true, module);
  }
  for (const module of ['Users', 'Roles', 'Custom Fields', 'Active Deactive Module', 'Tasks', 'Task', 'Completed Tasks']) {
    for (const action of ['create', 'update', 'delete']) assert.equal(can(actor, module, action), false, module + ':' + action);
  }
  assert.deepEqual(scope({ method: 'GET', actor }), {});
  assert.deepEqual(scope({ method: 'PUT', actor }), { createBy: actor._id });
  assert.deepEqual(scope({ method: 'GET', actor }, 'Tasks'), {});
});

test('dashboard analytics read all permitted leads and tasks', async t => {
  t.mock.method(User, 'findOne', async () => actor);
  const tasks = t.mock.method(Task, 'find', async query => {
    assert.deepEqual(query, { deleted: false });
    return [];
  });
  const leads = t.mock.method(Lead, 'find', async query => {
    assert.deepEqual(query, { deleted: false });
    return [{ title: 'Shared lead' }];
  });
  const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
  await require('../controllers/status/status').index({ user: { userId: actor._id }, query: {} }, res);
  assert.equal(res.data.data.leadData.length, 1);
  assert.equal(tasks.mock.callCount(), 1);
  assert.equal(leads.mock.callCount(), 1);
});

test('visibility restricts data scopes while preserving page and ownership-based mutation access', () => {
  const hidden = { ...actor, moduleVisibility: { Opportunities: false, Tasks: false } };
  assert.equal(can(hidden, 'Opportunities', 'view'), true);
  assert.equal(can(hidden, 'Opportunities', 'update'), true);
  assert.deepEqual(scope({ method: 'GET', actor: hidden }, 'Tasks'), taskScope(hidden));
  assert.deepEqual(scope({ method: 'PUT', actor }, 'Tasks'), taskScope(actor));
  for (const role of ['admin', 'developer']) {
    assert.equal(can({ ...hidden, role }, 'Opportunities', 'view'), true);
  }
});

test('ordinary module defaults are closed while own and sent records remain readable', () => {
  const visibility = require('../services/moduleVisibility');
  const user = { _id: new mongoose.Types.ObjectId(), role: 'user' };
  assert.equal(visibility.defaultHidden.size, 11);
  for (const name of visibility.defaultHidden) assert.equal(visibility.canView(user, name), false, name);
  for (const name of require('../services/recordSharing').limitedModules) assert.equal(visibility.canRead(user, name), true, name);
  assert.equal(visibility.canRead(user, 'Reporting and Analytics'), true);
  const recordId = new mongoose.Types.ObjectId();
  assert.deepEqual(scope({ method: 'GET', actor: user, recordShares: [{ module: 'Leads', recordId }] }, 'Leads'), { $or: [{ createBy: user._id }, { _id: { $in: [recordId] } }] });
  assert.equal(visibility.canView({ ...user, moduleVisibility: { Leads: true } }, 'Leads'), true);
});
