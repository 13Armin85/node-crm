const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Task = require('../model/schema/task');
const User = require('../model/schema/user');
const Notification = require('../model/schema/notification');
const mail = require('../middelwares/mail');

test('creating an assigned task emails the selected user', async t => {
  const actorId = new mongoose.Types.ObjectId();
  const assigneeId = new mongoose.Types.ObjectId();
  const actor = { _id: actorId, username: 'manager@example.com', firstName: 'Task', lastName: 'Manager', role: 'admin' };
  const assignee = { _id: assigneeId, username: 'assignee@example.com', firstName: 'Task', lastName: 'Owner' };

  t.mock.method(User, 'findOne', query => {
    if (String(query._id) === String(actorId)) return Promise.resolve(actor);
    return { select: () => Promise.resolve(assignee) };
  });
  t.mock.method(User, 'exists', async () => ({ _id: assigneeId }));
  t.mock.method(Task, 'create', async task => ({ ...task, _id: new mongoose.Types.ObjectId() }));
  const createNotification = t.mock.method(Notification, 'create', async notification => notification);
  const sendEmail = t.mock.method(mail, 'sendEmail', async () => 'sent');
  const controller = require('../controllers/task/task');
  const response = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await controller.add({
    user: { userId: String(actorId) },
    body: { title: 'Call the customer', assignedToUser: String(assigneeId) },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(sendEmail.mock.callCount(), 1);
  assert.equal(sendEmail.mock.calls[0].arguments[0], assignee.username);
  assert.match(sendEmail.mock.calls[0].arguments[1], /new task has been sent/i);
  assert.match(sendEmail.mock.calls[0].arguments[2], /Call the customer/);
  assert.match(sendEmail.mock.calls[0].arguments[2], /A new task has been sent to you/i);
  assert.equal(createNotification.mock.callCount(), 1);
  assert.equal(String(createNotification.mock.calls[0].arguments[0].recipient), String(assigneeId));
  assert.equal(createNotification.mock.calls[0].arguments[0].type, 'task_assigned');
});
