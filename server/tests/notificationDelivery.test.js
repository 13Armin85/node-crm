const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Notification = require('../model/schema/notification');
const Task = require('../model/schema/task');
const User = require('../model/schema/user');
const Lead = require('../model/schema/lead').Lead;
const { notifyRecordActivity } = require('../services/notifications');
const activity = require('../middelwares/activityNotifications');
const taskController = require('../controllers/task/task');
const controller = require('../controllers/notification/notification');
const id = () => new mongoose.Types.ObjectId();
const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; },
  send(value) { this.body = value; return this; },
});
const query = value => ({ select() { return this; }, lean: async () => value });

test('record assignment targets the actual assignee and deduplicates the creator and actor', async t => {
  const actorId = id(), assigneeId = id(), previousId = id();
  const previous = { _id: id(), title: 'Buyer follow-up', createBy: actorId, assignUser: previousId };
  const record = { ...previous, assignUser: assigneeId };
  const create = t.mock.method(Notification, 'create', async value => value);
  await notifyRecordActivity({ module: 'Leads', record, previous, actorId });
  const rows = create.mock.calls.map(call => call.arguments[0]);
  assert.equal(rows.length, 3);
  assert.equal(rows.find(row => String(row.recipient) === String(assigneeId)).type, 'record_assigned');
  assert.equal(rows.find(row => String(row.recipient) === String(previousId)).link, '/lead');
  assert.equal(rows.find(row => String(row.recipient) === String(actorId)).link, '/leadView/' + record._id);
});

test('property sale status changes notify the record owner and actor', async t => {
  const actorId = id(), ownerId = id();
  const previous = { _id: id(), title: 'Apartment', createBy: ownerId, sale: { status: 'AVAILABLE' } };
  const create = t.mock.method(Notification, 'create', async value => value);
  await notifyRecordActivity({ module: 'Properties', record: { ...previous, sale: { status: 'SOLD' } }, previous, actorId });
  assert.equal(create.mock.callCount(), 2);
  assert(create.mock.calls.every(call => call.arguments[0].type === 'property_sold'));
});

test('a notification delivery failure does not report a saved task update as failed', async t => {
  const actorId = id(), assigneeId = id();
  const task = { _id: id(), title: 'Contract', assignedToUser: assigneeId, createBy: actorId, status: 'todo', async save() {} };
  t.mock.method(User, 'findOne', async () => ({ _id: actorId, role: 'admin' }));
  t.mock.method(Task, 'findOne', async () => task);
  t.mock.method(Notification, 'create', async () => { throw new Error('Notification storage unavailable'); });
  t.mock.method(console, 'error', () => {});
  const res = response();
  await taskController.changeStatus({ user: { userId: actorId }, params: { id: String(task._id) }, body: { status: 'completed' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'completed');
});

test('task detail changes notify the other participant and use the task detail link', async t => {
  const creatorId = id(), assigneeId = id(), taskId = id();
  const previous = { _id: taskId, title: 'Contract', description: 'Draft', assignedToUser: assigneeId, createBy: creatorId, status: 'todo' };
  t.mock.method(User, 'findOne', async () => ({ _id: assigneeId, role: 'user' }));
  t.mock.method(Task, 'findOne', async () => previous);
  t.mock.method(Task, 'findByIdAndUpdate', async () => ({ ...previous, description: 'Ready for review' }));
  const create = t.mock.method(Notification, 'create', async value => value);
  const res = response();
  await taskController.edit({ user: { userId: assigneeId }, params: { id: String(taskId) }, body: { description: 'Ready for review' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(create.mock.callCount(), 1);
  assert.equal(String(create.mock.calls[0].arguments[0].recipient), String(creatorId));
  assert.equal(create.mock.calls[0].arguments[0].type, 'task_updated');
  assert.equal(create.mock.calls[0].arguments[0].link, '/view/' + taskId);
});

test('unchanged task status does not create duplicate notifications', async t => {
  const actorId = id(), task = { _id: id(), status: 'completed', createBy: actorId, assignedToUser: id(), async save() {} };
  t.mock.method(User, 'findOne', async () => ({ _id: actorId, role: 'admin' }));
  t.mock.method(Task, 'findOne', async () => task);
  const create = t.mock.method(Notification, 'create', async value => value);
  await taskController.changeStatus({ user: { userId: actorId }, params: { id: String(task._id) }, body: { status: 'completed' } }, response());
  assert.equal(create.mock.callCount(), 0);
});

test('deleted tasks notify the assignee and link to the task list', async t => {
  const actorId = id(), assigneeId = id();
  const task = { _id: id(), title: 'Contract', createBy: actorId, assignedToUser: assigneeId, async save() {} };
  t.mock.method(User, 'findOne', async () => ({ _id: actorId, role: 'admin' }));
  t.mock.method(Task, 'findOne', async () => task);
  const create = t.mock.method(Notification, 'create', async value => value);
  const res = response();
  await taskController.deleteData({ user: { userId: actorId }, params: { id: String(task._id) } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(create.mock.calls[0].arguments[0].type, 'task_deleted');
  assert.equal(create.mock.calls[0].arguments[0].link, '/task');
});

test('notifications paginate without losing the user scope or accepting invalid cursors', async t => {
  const userId = id(), cursor = id();
  const rows = [{ _id: id() }, { _id: id() }, { _id: id() }];
  const find = t.mock.method(Notification, 'find', filter => {
    assert.equal(filter.recipient, userId);
    assert.equal(String(filter._id.$lt), String(cursor));
    return { populate() { return this; }, sort() { return this; }, limit(value) { assert.equal(value, 3); return this; }, lean: async () => rows };
  });
  t.mock.method(Notification, 'countDocuments', async () => 15);
  const res = response();
  await controller.index({ user: { userId }, query: { before: String(cursor), limit: '2' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.hasMore, true);
  assert.equal(res.body.nextCursor, String(rows[1]._id));
  assert.equal(res.body.notifications.length, 2);
  const invalid = response();
  await controller.index({ user: { userId }, query: { before: 'invalid' } }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal(find.mock.callCount(), 1);
});

test('mark all read only updates the current user and leaves later arrivals unread', async t => {
  const userId = id();
  const update = t.mock.method(Notification, 'updateMany', async (filter, values) => {
    assert.equal(filter.recipient, userId);
    assert.equal(filter.readAt, null);
    assert.equal(filter.createdAt.$lte, values.$set.readAt);
    return { modifiedCount: 7 };
  });
  t.mock.method(Notification, 'countDocuments', async filter => {
    assert.equal(filter.recipient, userId);
    return 1;
  });
  const res = response();
  await controller.markAllRead({ user: { userId } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.updatedCount, 7);
  assert.equal(res.body.unreadCount, 1);
  assert(res.body.readAt instanceof Date);
  assert.equal(update.mock.callCount(), 1);
});

test('mutation notifications use persisted owners and are skipped on a rejected operation', async t => {
  const actorId = id(), ownerId = id(), forgedOwner = id();
  const record = { _id: id(), leadName: 'Buyer', createBy: ownerId };
  const create = t.mock.method(Notification, 'create', async value => value);
  const req = { user: { userId: actorId }, params: {}, body: { createBy: forgedOwner } };
  const res = response();
  await activity('Leads')('record_created', async (_, result) => result.json(record))(req, res, error => { throw error; });
  assert.equal(res.body, record);
  assert.equal(create.mock.callCount(), 2);
  assert(!create.mock.calls.some(call => String(call.arguments[0].recipient) === String(forgedOwner)));
  const rejected = response();
  await activity('Leads')('record_created', async (_, result) => result.status(403).json({ code: 'forbidden' }))(req, rejected, error => { throw error; });
  assert.equal(rejected.statusCode, 403);
  assert.equal(create.mock.callCount(), 2);
});

test('batch deletion notifications are restricted to records actually removed', async t => {
  const actorId = id(), ownerId = id();
  const removed = { _id: id(), leadName: 'Removed buyer', createBy: ownerId };
  const retained = { _id: id(), leadName: 'Retained buyer', createBy: ownerId };
  let lookups = 0;
  t.mock.method(Lead, 'find', () => query(++lookups === 1 ? [removed, retained] : [retained]));
  const create = t.mock.method(Notification, 'create', async value => value);
  await activity('Leads')('record_deleted', async (_, res) => res.json({ modifiedCount: 1 }))(
    { user: { userId: actorId }, params: {}, body: [removed._id, retained._id] }, response(), error => { throw error; },
  );
  assert.equal(create.mock.callCount(), 2);
  assert(create.mock.calls.every(call => String(call.arguments[0].entityId) === String(removed._id)));
});
