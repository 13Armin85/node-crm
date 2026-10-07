const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { can, scope } = require('../middelwares/permissions');
const { taskScope } = require('../services/taskAccess');
const User = require('../model/schema/user');
const Task = require('../model/schema/task');
const { Lead } = require('../model/schema/lead');
const actor = { _id: new mongoose.Types.ObjectId(), role: 'user' };

test('ordinary users can read every module while administrative mutations stay restricted', () => {
  for (const module of ['Users', 'Roles', 'Custom Fields', 'Active Deactive Module', 'Contacts', 'Properties', 'Tasks']) {
    assert.equal(can(actor, module, 'view'), true, module);
  }
  for (const module of ['Users', 'Roles', 'Custom Fields', 'Active Deactive Module']) {
    for (const action of ['create', 'update', 'delete']) assert.equal(can(actor, module, action), false, module + ':' + action);
  }
  assert.deepEqual(scope({ method: 'GET', actor }), {});
  assert.deepEqual(scope({ method: 'PUT', actor }), { createBy: actor._id });
  assert.deepEqual(scope({ method: 'GET', actor }, 'Tasks'), taskScope(actor));
});

test('dashboard analytics read own leads while task access remains assigned or legacy-owned', async t => {
  t.mock.method(User, 'findOne', async () => actor);
  const tasks = t.mock.method(Task, 'find', async query => {
    assert.deepEqual(query, taskScope(actor, { deleted: false }));
    return [];
  });
  const leads = t.mock.method(Lead, 'find', async query => {
    assert.deepEqual(query, { deleted: false, createBy: actor._id });
    return [{ title: 'Shared lead' }];
  });
  const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
  await require('../controllers/status/status').index({ user: { userId: actor._id }, query: {} }, res);
  assert.equal(res.data.data.leadData.length, 1);
  assert.equal(tasks.mock.callCount(), 1);
  assert.equal(leads.mock.callCount(), 1);
});
