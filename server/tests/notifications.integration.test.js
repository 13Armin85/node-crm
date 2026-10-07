const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwtSecret } = require('../config/auth');

test('task notifications persist and enforce recipient isolation through authenticated HTTP routes', { skip: process.env.NOTIFICATION_INTEGRATION !== '1' }, async t => {
    const dbName = 'crm_notifications_test_' + crypto.randomUUID().replace(/-/g, '');
    await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
    let server;
    t.after(async () => {
        if (server) await new Promise(resolve => server.close(resolve));
        assert.equal(mongoose.connection.name, dbName);
        assert(dbName.startsWith('crm_notifications_test_'));
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });
    t.mock.method(require('../middelwares/mail'), 'sendEmail', async () => null);
    const app = express();
    app.use(express.json());
    app.use('/api', require('../controllers/route'));
    const User = require('../model/schema/user');
    const Notification = require('../model/schema/notification');
    const admin = await User.create({ username: 'admin@example.test', password: 'test-only', firstName: 'Manager', role: 'admin' });
    const first = await User.create({ username: 'first@example.test', password: 'test-only', role: 'user' });
    const second = await User.create({ username: 'second@example.test', password: 'test-only', role: 'user' });
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    const api = async (method, route, body, actor = admin) => {
        const res = await fetch(base + route, {
            method,
            headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: jwt.sign({ userId: actor._id }, jwtSecret, { expiresIn: '5m' }) } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return { status: res.status, data: await res.json() };
    };
    const inbox = actor => api('GET', '/notification', null, actor);
    assert.equal((await inbox(null)).status, 401);
    const created = await api('POST', '/task/add', { title: 'Review contract', assignedToUser: String(first._id) });
    assert.equal(created.status, 200, JSON.stringify(created));
    const taskId = created.data._id;
    const firstInbox = (await inbox(first)).data;
    assert.equal(firstInbox.unreadCount, 1);
    assert.equal(firstInbox.notifications[0].type, 'task_assigned');
    assert.equal(firstInbox.notifications[0].actor.firstName, 'Manager');
    assert.equal(firstInbox.notifications[0].link, '/view/' + taskId);
    assert.equal((await api('GET', firstInbox.notifications[0].link.replace('/view/', '/task/view/'), null, first)).status, 200);
    const ownNotification = firstInbox.notifications[0]._id;
    assert.equal((await api('PUT', '/notification/' + ownNotification + '/read', {}, second)).status, 404);
    const read = await api('PUT', '/notification/' + ownNotification + '/read', {}, first);
    assert.equal(read.status, 200);
    const readAgain = await api('PUT', '/notification/' + ownNotification + '/read', {}, first);
    assert.equal(readAgain.data.readAt, read.data.readAt);
    assert.equal((await inbox(first)).data.unreadCount, 0);
    assert.equal((await api('PUT', '/task/changeStatus/' + taskId, { status: 'completed' }, first)).status, 200);
    const managerInbox = (await inbox(admin)).data;
    assert.equal(managerInbox.notifications[0].type, 'task_status_changed');
    assert.equal((await api('PUT', '/task/edit/' + taskId, { assignedToUser: String(second._id) })).status, 200);
    assert.equal((await inbox(first)).data.notifications[0].type, 'task_unassigned');
    assert.equal((await inbox(second)).data.notifications[0].type, 'task_assigned');
    assert.equal((await api('PUT', '/task/edit/' + taskId, { description: 'Updated contract' })).status, 200);
    assert.equal((await inbox(second)).data.notifications[0].type, 'task_updated');
    assert.equal((await api('POST', '/task/deleteMany', [taskId])).status, 200);
    assert.equal((await inbox(second)).data.notifications[0].type, 'task_deleted');
    assert.equal((await inbox(second)).data.notifications[0].link, '/task');

    const property = await api('POST', '/estate/Properties', {
        title: 'Test apartment', category: 'RESIDENTIAL', subtype: 'APARTMENT', transactionType: 'SALE',
        price: { amount: 1000, currency: 'TRY' }, area: { value: 50, type: 'NET' }, sale: { status: 'AVAILABLE' },
    }, first);
    assert.equal(property.status, 201, JSON.stringify(property));
    assert.equal((await inbox(first)).data.notifications[0].type, 'record_created');
    assert.equal((await api('PUT', '/estate/Properties/' + property.data._id, { title: 'Updated apartment' })).status, 200);
    assert.equal((await inbox(first)).data.notifications[0].type, 'record_updated');
    assert.equal((await api('DELETE', '/estate/Properties/' + property.data._id)).status, 200);
    assert.equal((await inbox(first)).data.notifications[0].type, 'record_deleted');

    const meeting = await api('POST', '/meeting/add', { agenda: 'Review buyer offer', dateTime: '2026-10-07T12:00:00Z' }, first);
    assert.equal(meeting.status, 200, JSON.stringify(meeting));
    assert.equal((await inbox(first)).data.notifications[0].module, 'Meetings');
    const template = await api('POST', '/email-temp/add', { templateName: 'Buyer follow-up', html: '<p>Hello</p>' }, first);
    assert.equal(template.status, 200, JSON.stringify(template));
    assert.equal((await inbox(first)).data.notifications[0].module, 'Email Template');
    assert.equal((await inbox(first)).data.notifications[0].message, 'Buyer follow-up');
    assert.equal((await api('PUT', '/email-temp/edit/' + template.data._id, { templateName: 'Updated follow-up' }, first)).status, 200);
    assert.equal((await inbox(first)).data.notifications[0].type, 'record_updated');
    assert.equal((await api('DELETE', '/email-temp/delete/' + template.data._id, null, first)).status, 200);
    assert.equal((await inbox(first)).data.notifications[0].type, 'record_deleted');
    const developer = await User.create({ username: 'developer@example.test', password: 'test-only', role: 'developer' });
    const registered = await api('POST', '/user/register', { username: 'registered@example.test', password: 'test-password-123', role: 'user' }, developer);
    assert.equal(registered.status, 200, JSON.stringify(registered));
    const newUser = await User.findOne({ username: 'registered@example.test' });
    assert.equal((await inbox(newUser)).data.notifications[0].type, 'account_created');
    assert.equal((await api('PUT', '/user/edit/' + newUser._id, { role: 'admin' }, developer)).status, 200);
    assert.equal((await inbox(newUser)).status, 401, 'A role change invalidates the old session');
    const changedUser = await User.findById(newUser._id).select('+authVersion');
    const changedToken = jwt.sign({ userId: changedUser._id, sv: changedUser.authVersion }, jwtSecret, { expiresIn: '5m' });
    const changedInbox = await fetch(base + '/notification', { headers: { Authorization: changedToken } });
    assert.equal(changedInbox.status, 200);
    assert.equal((await changedInbox.json()).notifications[0].type, 'role_changed');
    // Role restrictions also apply to the generic form route and legacy records.
    const Task = require('../model/schema/task');
    const CustomField = require('../model/schema/customField');
    const module = await CustomField.create({ moduleName: 'Tasks', fields: [] });
    assert.equal((await api('GET', '/task/assignees', null, first)).status, 403);
    for (const prefix of ['/task', '/form']) {
        const metadata = prefix === '/form' ? { moduleId: String(module._id) } : {};
        const unwrap = data => prefix === '/form' ? data.data : data;
        const countBefore = await Notification.countDocuments({});
        const forbiddenCreate = await api('POST', prefix + '/add', { ...metadata, title: 'Unauthorized assignment', assignedToUser: String(second._id) }, first);
        assert.equal(forbiddenCreate.status, 403, JSON.stringify(forbiddenCreate));
        assert.equal(await Notification.countDocuments({}), countBefore);
        const own = await api('POST', prefix + '/add', { ...metadata, title: 'Own task' }, first);
        assert.equal(own.status, 200, JSON.stringify(own));
        const ownTask = unwrap(own.data);
        assert.equal(ownTask.assignedToUser, String(first._id));
        for (const assignedToUser of [String(second._id), null, '']) {
            assert.equal((await api('PUT', prefix + '/edit/' + ownTask._id, { ...metadata, assignedToUser }, first)).status, 403);
        }
        assert.equal(String((await Task.findById(ownTask._id)).assignedToUser), String(first._id));
        assert.equal((await api('PUT', prefix + '/edit/' + ownTask._id, { ...metadata, description: 'Own edit' }, first)).status, 200);
        for (const actor of [admin, developer]) {
            const assignedToUser = actor === admin ? String(second._id) : String(first._id);
            const delegated = await api('PUT', prefix + '/edit/' + ownTask._id, { ...metadata, assignedToUser }, actor);
            assert.equal(delegated.status, 200, JSON.stringify(delegated));
            assert.equal(unwrap(delegated.data).assignedToUser, assignedToUser);
            assert.equal(unwrap(delegated.data).delegatedBy, String(actor._id));
            const target = actor === admin ? second : first;
            assert.equal((await api('PUT', prefix + '/edit/' + ownTask._id, { ...metadata, notes: 'Assigned user can edit' }, target)).status, 200);
        }
        const legacy = await Task.create({ title: 'Legacy', createBy: first._id });
        assert.equal((await api('PUT', prefix + '/edit/' + legacy._id, { ...metadata, description: 'Legacy edit' }, first)).status, 200);
        assert.equal((await Task.findById(legacy._id)).assignedToUser, undefined);
    }
    const firstNotifications = (await inbox(first)).data.notifications;
    const paged = await api('GET', '/notification?limit=2', null, first);
    assert.equal(paged.data.notifications.length, 2);
    assert.equal(paged.data.hasMore, true);
    const older = await api('GET', '/notification?limit=2&before=' + paged.data.nextCursor, null, first);
    assert(!older.data.notifications.some(item => paged.data.notifications.some(newer => newer._id === item._id)));
    assert(firstNotifications.every(item => String(item.recipient) === String(first._id)));
    assert.equal((await api('PUT', '/notification/read-all', {}, first)).status, 200);
    assert.equal((await inbox(first)).data.unreadCount, 0);
    assert((await inbox(second)).data.unreadCount > 0);
    assert((await Notification.countDocuments({ recipient: first._id })) > 0);
});
