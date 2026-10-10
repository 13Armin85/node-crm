const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

test('explicit full visibility and per-user controls cover all HTTP surfaces', { skip: process.env.VISIBILITY_INTEGRATION !== '1' }, async t => {
  const dbName = 'crm_visibility_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  mongoose.set('strictQuery', false);
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    assert(dbName.startsWith('crm_visibility_test_'));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  t.mock.method(require('../middelwares/mail'), 'sendEmail', async () => null);
  const app = express();
  app.use(express.json());
  app.use('/api', require('../controllers/route'));
  const User = require('../model/schema/user');
  const CustomField = require('../model/schema/customField');
  const Task = require('../model/schema/task');
  const Notification = require('../model/schema/notification');
  const admin = await User.create({ username: 'admin@example.test', password: 'unused-test-only', role: 'admin' });
  const ordinary = await User.create({ username: 'ordinary@example.test', password: 'unused-test-only', role: 'user', moduleVisibility: Object.fromEntries([...require('../services/moduleVisibility').defaultHidden].map(name => [name, true])) });
  const other = await User.create({ username: 'other@example.test', password: 'unused-test-only', role: 'user', moduleVisibility: Object.fromEntries([...require('../services/moduleVisibility').defaultHidden].map(name => [name, true])) });
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const api = async (method, route, body, actor = ordinary, dataUser = null) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api' + route, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: jwt.sign({ userId: actor._id }, jwtSecret, { expiresIn: '5m' }), ...(dataUser ? { 'X-CRM-Data-User': String(dataUser) } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  // Insert realistic business records with explicit owners and deletion flags.
  const insert = async (model, values) => {
    const record = { _id: new mongoose.Types.ObjectId(), createBy: admin._id, deleted: false, ...values };
    await model.collection.insertOne(record);
    return record;
  };
  const contact = await insert(require('../model/schema/contact').Contact, { firstName: 'Shared', lastName: 'Contact' });
  const lead = await insert(require('../model/schema/lead').Lead, { leadName: 'Shared lead', leadEmail: 'lead@example.test' });
  const property = await insert(require('../model/schema/property').Property, {
    title: 'Shared property', category: 'RESIDENTIAL', subtype: 'APARTMENT', transactionType: 'SALE',
    price: { amount: 1000, currency: 'TRY' }, area: { value: 50, type: 'NET' }, sale: { status: 'AVAILABLE' },
  });
  const partner = await insert(require('../model/schema/partnerCustomer'), { customerType: 'INDIVIDUAL', fullName: 'Shared partner' });
  const residence = await insert(require('../model/schema/residence'), { name: 'Shared residence' });
  const opportunity = await insert(require('../model/schema/opprtunity'), { opportunityName: 'Shared opportunity' });
  const folder = await insert(require('../model/schema/document'), { folderName: 'Shared folder', file: [] });
  const meeting = await insert(require('../model/schema/meeting'), { agenda: 'Shared meeting', dateTime: '2026-10-07T12:00:00Z' });
  await insert(require('../model/schema/email'), { sender: admin._id, subject: 'Shared email', timestamp: new Date('2026-10-07T12:00:00Z') });
  await insert(require('../model/schema/phoneCall'), { sender: admin._id, subject: 'Shared call', timestamp: new Date('2026-10-07T12:00:00Z') });
  await insert(require('../model/schema/textMsg'), { sender: admin._id, timestamp: new Date('2026-10-07T12:00:00Z') });
  const module = await CustomField.create({ moduleName: 'Tasks', fields: [] });
  const contactModule = await CustomField.create({ moduleName: 'Contacts', fields: [] });
  const related = { assignTo: contact._id, assignToLead: lead._id };
  const ownTask = await Task.create({ ...related, title: 'Own assignment', createBy: admin._id, assignedToUser: ordinary._id, status: 'todo' });
  const foreignTask = await Task.create({ ...related, title: 'Other assignment', createBy: ordinary._id, assignedToUser: other._id, status: 'todo' });
  const legacyTask = await Task.create({ ...related, title: 'Legacy own task', createBy: ordinary._id, status: 'todo' });
  const privateLegacy = await Task.create({ ...related, title: 'Legacy other task', createBy: admin._id, status: 'todo' });
  const allTaskIds = [ownTask, foreignTask, legacyTask, privateLegacy].map(task => String(task._id)).sort();
  const ids = rows => rows.map(row => String(row._id)).sort();
  const apiRows = result => Array.isArray(result.data) ? result.data : result.data.items;
  const modules = [
    ['contact', 'Contacts', require('../model/schema/contact').Contact, contact],
    ['lead', 'Leads', require('../model/schema/lead').Lead, lead],
    ['estate/Properties', 'Properties', require('../model/schema/property').Property, property],
    ['estate/Partner%20Customers', 'Partner Customers', require('../model/schema/partnerCustomer'), partner],
    ['estate/Residences', 'Residences', require('../model/schema/residence'), residence],
    ['opportunity', 'Opportunities', require('../model/schema/opprtunity'), opportunity],
    ['invoices', 'Invoices', require('../model/schema/invoices'), await insert(require('../model/schema/invoices'), { title: 'Shared invoice', contact: contact._id })],
    ['meeting', 'Meetings', require('../model/schema/meeting'), meeting],
    ['email', 'Emails', require('../model/schema/email'), await insert(require('../model/schema/email'), { subject: 'Related email', sender: admin._id, createByContact: contact._id })],
    ['phoneCall', 'Calls', require('../model/schema/phoneCall'), await insert(require('../model/schema/phoneCall'), { subject: 'Related call', sender: admin._id, createByContact: contact._id })],
    ['document', 'Documents', require('../model/schema/document'), folder],
    ['task', 'Tasks', Task, foreignTask],
    ['quotes', 'Quotes', require('../model/schema/quotes'), await insert(require('../model/schema/quotes'), { title: 'Shared quote', contact: contact._id })],
    ['email-temp', 'Email Template', require('../model/schema/emailTemplate'), await insert(require('../model/schema/emailTemplate'), { title: 'Shared template' })],
    ['bank-details', 'Bank Details', require('../model/schema/bankDetails'), await insert(require('../model/schema/bankDetails'), { bankName: 'Shared bank' })],
    ['opportunityproject', 'Opportunity Project', require('../model/schema/opportunityproject'), await insert(require('../model/schema/opportunityproject'), { name: 'Shared project' })],
  ];
  await t.test('existing general data is shared by default on list and detail routes', async () => {
    for (const [path, name, Model, record] of modules) {
      const listed = await api('GET', '/' + path);
      assert.equal(listed.status, 200, path + JSON.stringify(listed));
      assert(ids(apiRows(listed)).includes(String(record._id)), name + ' shared list');
      if (!['document', 'quotes', 'email-temp'].includes(path)) {
        const detailPath = path.startsWith('estate/') ? '/' + path + '/' + record._id : '/' + path + '/view/' + record._id;
        assert.equal((await api('GET', detailPath)).status, 200, detailPath);
      }
    }
    assert.deepEqual(ids((await api('GET', '/task')).data), allTaskIds);
    assert.deepEqual(ids((await api('GET', '/form?moduleId=' + module._id)).data.data), allTaskIds);
    assert.equal((await api('GET', '/user')).data.user.length, 3);
    assert((await api('GET', '/user')).data.user.every(user => !user.password && !user.authVersion && !user.moduleVisibility));
    assert.equal((await api('GET', '/visibility/me')).status, 200);
    assert.equal((await api('GET', '/visibility')).status, 403);
    assert.equal((await api('GET', '/visibility', null, admin)).data.users.length, 2);
    const dashboard = (await api('GET', '/status')).data.data;
    assert.deepEqual(ids(dashboard.taskData), allTaskIds);
    assert.equal(dashboard.leadData.length, 1);
    assert((await api('GET', '/calendar')).data.some(row => String(row.id) === String(meeting._id)));
    const totals = (await api('GET', '/reporting/line-chart')).data;
    assert.equal(totals.find(row => row.name === 'Opportunities').length, 1);
    assert.equal(totals.find(row => row.name === 'Tasks').length, 4);
    assert.equal((await api('GET', '/reporting')).data.length, 3);
    assert.equal((await api('POST', '/reporting/index', { startDate: '2026-10-07', endDate: '2026-10-07', filter: 'day' })).data.Email[0].totalEmails, 1);
    assert.equal((await api('GET', '/estate/dashboard/sales-summary')).data.available.count, 1);
  });
  await t.test('shared task reads never grant task delegation or other users mutation rights', async () => {
    assert.equal((await api('GET', '/task/view/' + foreignTask._id)).status, 200);
    assert.equal((await api('GET', '/task/assignees')).status, 403);
    assert.equal((await api('POST', '/task/add', { title: 'Denied', assignedToUser: String(other._id) })).status, 403);
    assert.equal((await api('PUT', '/task/edit/' + foreignTask._id, { title: 'Denied edit' })).status, 403);
    assert.equal((await api('DELETE', '/form/delete/' + foreignTask._id + '?moduleId=' + module._id)).status, 403);
    assert.equal((await Task.findById(foreignTask._id)).deleted, false);
  });
  const genericModule = await CustomField.create({ moduleName: 'Opportunities', fields: [] });
  await require('../model/schema/contact').Contact.updateOne({ _id: contact._id }, { $set: { relatedOpportunities: [opportunity._id] } });
  await require('../model/schema/lead').Lead.updateOne({ _id: lead._id }, { $set: { relatedOpportunities: [opportunity._id] } });
  await require('../model/schema/meeting').collection.updateOne({ _id: meeting._id }, { $set: { attendes: [contact._id], attendesLead: [lead._id] } });
  const NotificationModel = require('../model/schema/notification');
  await NotificationModel.create({ recipient: ordinary._id, module: 'Meetings', type: 'record_created', message: 'Hidden meeting' });
  const ownNotification = await NotificationModel.create({ recipient: ordinary._id, module: 'Tasks', actor: admin._id, type: 'task_assigned', message: 'Own notification' });
  await NotificationModel.create({ recipient: other._id, module: 'Tasks', type: 'task_assigned', message: 'Another inbox' });
  await t.test('turning off quotes preserves independently visible invoice histories', async () => {
    assert.equal((await api('PUT', '/visibility/' + ordinary._id, { visibility: { Quotes: false } }, admin)).status, 200);
    const detail = (await api('GET', '/contact/view/' + contact._id)).data;
    assert.equal(detail.quotes.length, 0);
    assert.equal(detail.invoice.length, 1);
    assert.equal((await api('GET', '/invoices')).data.length, 1);
  });
  await t.test('admin controls each user independently, with immediate enforcement and safe inputs', async () => {
    const patch = { visibility: { Opportunities: false, Meetings: false, Emails: false, Calls: false, Quotes: false, Invoices: false } };
    assert.equal((await api('PUT', '/visibility/' + ordinary._id, patch)).status, 403);
    assert.equal((await api('PUT', '/visibility/' + admin._id, patch, admin)).status, 404);
    assert.equal((await api('PUT', '/visibility/invalid', patch, admin)).status, 400);
    for (const visibility of [{ Opportunities: 'false' }, { password: false }, { 'Opportunities.secret': false }, { Dashboard: null }, {}]) {
      assert.equal((await api('PUT', '/visibility/' + ordinary._id, { visibility }, admin)).status, 400);
    }
    const saved = await api('PUT', '/visibility/' + ordinary._id, patch, admin);
    assert.equal(saved.status, 200, JSON.stringify(saved));
    assert.equal(saved.data.visibility.Opportunities, false);
    assert.equal((await api('GET', '/visibility/me')).data.visibility.Meetings, false);
    for (const path of ['/opportunity', '/opportunity/view/' + opportunity._id, '/meeting', '/email', '/phoneCall', '/quotes', '/invoices', '/form?moduleId=' + genericModule._id, '/form/view/' + opportunity._id + '?moduleId=' + genericModule._id]) {
      assert.equal((await api('GET', path)).status, path.includes('/view/') ? 404 : 200, path);
      if (!path.includes('/view/')) { const response = (await api('GET', path)).data; assert.equal((response.data || response).length, 0, path); }
      assert.equal((await api('GET', path, null, admin)).status, 200, path + ' admin');
      assert.equal((await api('GET', path, null, other)).status, 200, path + ' other user');
    }
    const calendar = await api('GET', '/calendar');
    assert(calendar.data.every(row => row.groupId === 'task'));
    const totals = (await api('GET', '/reporting/line-chart')).data;
    assert.equal(totals.find(row => row.name === 'Opportunities').length, 0);
    assert.equal(totals.find(row => row.name === 'Tasks').length, 4);
    const chart = await api('POST', '/reporting/index', { startDate: '2026-10-07', endDate: '2026-10-07', filter: 'day' });
    assert.equal(chart.data.Email[0].totalEmails, 0);
    assert.equal(chart.data.Call[0].totalCall, 0);
    const report = (await api('GET', '/reporting')).data;
    assert(report.every(row => row.emailsent === 0 && row.outboundcall === 0));
    for (const path of ['/contact/view/' + contact._id, '/lead/view/' + lead._id]) {
      const detail = (await api('GET', path)).data;
      assert.equal((detail.contact || detail.lead).relatedOpportunities.length, 0);
      for (const key of ['EmailHistory', 'phoneCallHistory', 'meetingHistory', 'Email', 'phoneCall', 'meeting', 'quotes', 'invoice']) {
        if (detail[key]) assert.equal(detail[key].length, 0, key);
      }
    }
    const inbox = (await api('GET', '/notification')).data;
    assert.deepEqual(ids(inbox.notifications), [String(ownNotification._id)]);
    assert.equal(inbox.unreadCount, 1);
    await api('PUT', '/user/edit/' + ordinary._id, { moduleVisibility: { Opportunities: true } });
    assert.deepEqual((await api('GET', '/opportunity')).data, [], 'self profile cannot overwrite visibility');
    assert.equal((await api('PUT', '/visibility/' + ordinary._id, { visibility: { Documents: false, Tasks: false, 'Reporting and Analytics': false } }, admin)).status, 200);
    for (const path of ['/document', '/document/download/' + new mongoose.Types.ObjectId(), '/estate/files/' + new mongoose.Types.ObjectId(), '/task', '/reporting']) {
      assert.equal((await api('GET', path)).status, path.includes('/download/') || path.includes('/files/') ? 404 : 200, path);
    }
    assert.deepEqual(ids((await api('GET', '/task')).data), ids([ownTask, legacyTask]));
    assert.equal((await api('GET', '/status')).data.data.taskData.length, 2);
    assert.deepEqual((await api('GET', '/calendar')).data.map(row => String(row.id)).sort(), ids([ownTask, legacyTask]));
    assert.equal((await api('PUT', '/visibility/' + ordinary._id, { visibility: { Dashboard: false } }, admin)).status, 200);
    for (const path of ['/status', '/reporting/line-chart', '/estate/dashboard/sales-summary']) assert.equal((await api('GET', path)).status, 200, path);
  });
  await t.test('developer can restore all visibility; administrator public filters stay global', async () => {
    const developer = await User.create({ username: 'developer@example.test', password: 'unused-test-only', role: 'developer' });
    const restore = Object.fromEntries(['Dashboard', 'Documents', 'Tasks', 'Opportunities', 'Meetings', 'Emails', 'Calls', 'Quotes', 'Invoices', 'Reporting and Analytics'].map(name => [name, true]));
    assert.equal((await api('PUT', '/visibility/' + ordinary._id, { visibility: restore }, developer)).status, 200);
    assert.equal((await api('GET', '/opportunity')).status, 200);
    assert.equal((await api('GET', '/status')).data.data.taskData.length, 4);
    assert.equal((await api('GET', '/reporting')).data.length, 4);
    const ownLead = await insert(require('../model/schema/lead').Lead, { leadName: 'Ordinary user lead', createBy: ordinary._id });
    const otherLead = await insert(require('../model/schema/lead').Lead, { leadName: 'Other user lead', createBy: other._id });
    const leadModule = await CustomField.create({ moduleName: 'Leads', fields: [] });
    const allLeadIds = ids([lead, ownLead, otherLead]);
    assert.deepEqual(ids((await api('GET', '/lead')).data), allLeadIds, 'ordinary users keep shared lead visibility');
    for (const manager of [admin, developer]) {
      for (const [person, expected] of [[ordinary, ownLead], [other, otherLead], [admin, lead]]) {
        const filteredLeads = await api('GET', '/lead', null, manager, person._id);
        assert.equal(filteredLeads.status, 200);
        assert.deepEqual(ids(filteredLeads.data), [String(expected._id)], 'lead selector filters the creator');
        const filteredForm = await api('GET', '/form?moduleId=' + leadModule._id, null, manager, person._id);
        assert.equal(filteredForm.status, 200);
        assert.deepEqual(ids(filteredForm.data.data), [String(expected._id)], 'generic lead list uses the same filter');
      }
      assert.deepEqual(ids((await api('GET', '/lead', null, manager)).data), allLeadIds, 'all users restores all leads');
      assert.equal((await api('GET', '/lead/view/' + lead._id, null, manager, ordinary._id)).status, 200, 'admin keeps direct lead detail access');
      for (const path of ['/task', '/contact', '/estate/Properties']) {
        const all = await api('GET', path, null, manager);
        const filtered = await api('GET', path, null, manager, ordinary._id);
        assert.deepEqual(ids(apiRows(all)), ids(apiRows(filtered)), path + ' stays public');
      }
      assert.equal((await api('GET', '/opportunity', null, manager, ordinary._id)).data.length, 0, 'personal admin filter retained');
      assert.equal((await api('GET', '/opportunity/view/' + opportunity._id, null, manager, ordinary._id)).status, 200, 'admin detail keeps full access');
    }
    assert.equal((await api('PUT', '/visibility/' + ordinary._id, { visibility: { Dashboard: false } }, admin)).status, 200);
    assert.equal((await api('GET', '/status')).status, 200);
    assert.deepEqual(ids((await api('GET', '/status')).data.data.leadData), ids([ownLead]));
    assert.equal((await api('GET', '/reporting/line-chart')).status, 200, 'reports remain independent of dashboard access');
    assert.equal((await api('PUT', '/visibility/' + ordinary._id, { visibility: { 'Reporting and Analytics': false } }, admin)).status, 200);
    assert.equal((await api('GET', '/reporting/line-chart')).status, 200);
    assert.equal((await api('GET', '/reporting/line-chart')).data.find(row => row.name === 'Leads').length, 1);
    assert.equal((await api('GET', '/estate/dashboard/sales-summary')).data.available.count, 0);
    assert.equal((await api('PUT', '/visibility/' + ordinary._id, { visibility: { Dashboard: true, 'Reporting and Analytics': true } }, admin)).status, 200);
    assert.equal((await api('GET', '/invoices', null, ordinary, admin._id)).status, 403);
    assert.equal((await api('GET', '/lead', null, ordinary, admin._id)).status, 403);
    assert.equal((await api('GET', '/task', null, admin, 'invalid')).status, 400);
  });
});
