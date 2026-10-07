const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Notification = require('../model/schema/notification');
const Task = require('../model/schema/task');
const User = require('../model/schema/user');
const controller = require('../controllers/notification/notification');

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('notification list and unread count are scoped to the authenticated user', async t => {
  const userId = new mongoose.Types.ObjectId();
  const rows = [{ _id: new mongoose.Types.ObjectId() }];
  const query = {
    populate() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => rows,
  };
  const find = t.mock.method(Notification, 'find', filter => {
    assert.equal(String(filter.recipient), String(userId));
    return query;
  });
  const countDocuments = t.mock.method(Notification, 'countDocuments', filter => {
    assert.equal(String(filter.recipient), String(userId));
    assert.equal(filter.readAt, null);
    return Promise.resolve(1);
  });
  const response = createResponse();

  await controller.index({ user: { userId: String(userId) } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { notifications: rows, unreadCount: 1, hasMore: false, nextCursor: null });
  assert.equal(find.mock.callCount(), 1);
  assert.equal(countDocuments.mock.callCount(), 1);
});

test('a user can only mark their own notification as read', async t => {
  const userId = new mongoose.Types.ObjectId();
  const notificationId = new mongoose.Types.ObjectId();
  const notification = { _id: notificationId, recipient: userId, readAt: new Date() };
  const findOneAndUpdate = t.mock.method(Notification, 'findOneAndUpdate', (filter, update) => {
    assert.equal(String(filter._id), String(notificationId));
    assert.equal(String(filter.recipient), String(userId));
    assert.equal(update[0].$set.readAt.$ifNull[0], '$readAt');
    assert.ok(update[0].$set.readAt.$ifNull[1] instanceof Date);
    return Promise.resolve(notification);
  });
  const response = createResponse();

  await controller.markRead({ user: { userId: String(userId) }, params: { id: String(notificationId) } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, notification);
  assert.equal(findOneAndUpdate.mock.callCount(), 1);
});

test('invalid notification IDs are rejected before querying the database', async t => {
  const findOneAndUpdate = t.mock.method(Notification, 'findOneAndUpdate');
  const response = createResponse();

  await controller.markRead({ user: { userId: new mongoose.Types.ObjectId() }, params: { id: 'invalid' } }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(findOneAndUpdate.mock.callCount(), 0);
});

test('changing a task status notifies its assignee but not the acting user', async t => {
  const actorId = new mongoose.Types.ObjectId();
  const assigneeId = new mongoose.Types.ObjectId();
  const actor = { _id: actorId, role: 'user' };
  const task = {
    _id: new mongoose.Types.ObjectId(),
    title: 'Prepare the contract',
    assignedToUser: assigneeId,
    createBy: actorId,
    status: 'todo',
    async save() {},
  };
  t.mock.method(User, 'findOne', async () => actor);
  t.mock.method(Task, 'findOne', async () => task);
  const createNotification = t.mock.method(Notification, 'create', async value => value);
  const response = createResponse();
  const taskController = require('../controllers/task/task');

  await taskController.changeStatus({
    user: { userId: String(actorId) },
    params: { id: String(task._id) },
    body: { status: 'completed' },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(createNotification.mock.callCount(), 1);
  assert.equal(String(createNotification.mock.calls[0].arguments[0].recipient), String(assigneeId));
  assert.equal(createNotification.mock.calls[0].arguments[0].type, 'task_status_changed');
  assert.equal(createNotification.mock.calls[0].arguments[0].status, 'Completed');
});

test('delegating an existing task creates a notification for the new assignee', async t => {
  const actorId = new mongoose.Types.ObjectId();
  const previousAssigneeId = new mongoose.Types.ObjectId();
  const newAssigneeId = new mongoose.Types.ObjectId();
  const taskId = new mongoose.Types.ObjectId();
  const actor = { _id: actorId, role: 'admin', username: 'manager@example.com' };
  const newAssignee = { _id: newAssigneeId, firstName: 'New', lastName: 'Owner' };
  const existingTask = {
    _id: taskId,
    title: 'Prepare the contract',
    assignedToUser: previousAssigneeId,
    createBy: actorId,
    status: 'todo',
  };
  const updatedTask = { ...existingTask, assignedToUser: newAssigneeId };
  t.mock.method(User, 'findOne', query => (
    String(query._id) === String(actorId)
      ? Promise.resolve(actor)
      : { select: () => Promise.resolve(newAssignee) }
  ));
  t.mock.method(User, 'exists', async () => ({ _id: newAssigneeId }));
  t.mock.method(Task, 'findOne', async () => existingTask);
  t.mock.method(Task, 'findByIdAndUpdate', async () => updatedTask);
  const createNotification = t.mock.method(Notification, 'create', async value => value);
  const response = createResponse();
  const taskController = require('../controllers/task/task');

  await taskController.edit({
    user: { userId: String(actorId) },
    params: { id: String(taskId) },
    body: { assignedToUser: String(newAssigneeId) },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(createNotification.mock.callCount(), 2);
  assert.equal(createNotification.mock.calls[1].arguments[0].type, 'task_unassigned');
  assert.equal(String(createNotification.mock.calls[1].arguments[0].recipient), String(previousAssigneeId));
  assert.equal(String(createNotification.mock.calls[0].arguments[0].recipient), String(newAssigneeId));
  assert.equal(createNotification.mock.calls[0].arguments[0].type, 'task_assigned');
  assert.equal(createNotification.mock.calls[0].arguments[0].message, existingTask.title);
});

test('regular users cannot create tasks assigned to someone else', async t => {
  const actorId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();
  t.mock.method(User, 'findOne', async () => ({ _id: actorId, role: 'user' }));
  const createTask = t.mock.method(Task, 'create');
  const response = createResponse();
  const taskController = require('../controllers/task/task');

  await taskController.add({
    user: { userId: String(actorId) },
    body: { title: 'Restricted assignment', assignedToUser: String(otherUserId) },
  }, response);

  assert.equal(response.statusCode, 403);
  assert.equal(createTask.mock.callCount(), 0);
});

test('regular users cannot change an existing task assignee', async t => {
  const actorId = new mongoose.Types.ObjectId();
  const previousAssigneeId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();
  const task = { _id: new mongoose.Types.ObjectId(), assignedToUser: previousAssigneeId };
  t.mock.method(User, 'findOne', async () => ({ _id: actorId, role: 'user' }));
  t.mock.method(Task, 'findOne', async () => task);
  const updateTask = t.mock.method(Task, 'findByIdAndUpdate');
  const response = createResponse();
  const taskController = require('../controllers/task/task');

  await taskController.edit({
    user: { userId: String(actorId) },
    params: { id: String(task._id) },
    body: { assignedToUser: String(otherUserId) },
  }, response);

  assert.equal(response.statusCode, 403);
  assert.equal(updateTask.mock.callCount(), 0);
});

test('creating a task assigned to its creator still creates an assignment notification', async t => {
  const actorId = new mongoose.Types.ObjectId();
  const actor = { _id: actorId, role: 'user', username: 'owner@example.com' };
  let userLookupCount = 0;
  t.mock.method(User, 'findOne', () => {
    userLookupCount += 1;
    if (userLookupCount === 1) return Promise.resolve(actor);
    return { select: () => Promise.resolve(actor) };
  });
  t.mock.method(User, 'exists', async () => ({ _id: actorId }));
  t.mock.method(Task, 'create', async task => ({ ...task, _id: new mongoose.Types.ObjectId() }));
  const createNotification = t.mock.method(Notification, 'create', async value => value);
  const response = createResponse();
  const taskController = require('../controllers/task/task');

  await taskController.add({
    user: { userId: String(actorId) },
    body: { title: 'My own task', assignedToUser: String(actorId) },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(createNotification.mock.callCount(), 1);
  assert.equal(String(createNotification.mock.calls[0].arguments[0].recipient), String(actorId));
  assert.equal(createNotification.mock.calls[0].arguments[0].type, 'task_assigned');
});
