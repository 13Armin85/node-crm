const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

test('ordinary users see shared directories and only their personal records through all HTTP surfaces', { skip: process.env.VISIBILITY_INTEGRATION !== '1' }, async t => {
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
  const ordinary = await User.create({ username: 'ordinary@example.test', password: 'unused-test-only', role: 'user' });
  const other = await User.create({ username: 'other@example.test', password: 'unused-test-only', role: 'user' });
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
  const ownIds = [ownTask, legacyTask].map(task => String(task._id)).sort();
  const ids = rows => rows.map(row => String(row._id)).sort();
  for (const [route, id, wrapped] of [
    ['/contact', contact._id], ['/lead', lead._id],
    ['/estate/Properties', property._id, true], ['/estate/Partner%20Customers', partner._id, true], ['/estate/Residences', residence._id, true],
  ]) {
    const response = await api('GET', route);
    assert.equal(response.status, 200, route + ': ' + JSON.stringify(response));
    assert(ids(wrapped ? response.data.items : response.data).includes(String(id)), route);
  }
  for (const route of ['/contact/view/' + contact._id, '/lead/view/' + lead._id, '/estate/Properties/' + property._id,
    '/estate/Partner%20Customers/' + partner._id, '/estate/Residences/' + residence._id, '/user/view/' + admin._id]) {
    const response = await api('GET', route);
    assert.equal(response.status, 200, route + ': ' + JSON.stringify(response));
    assert.equal(response.data.password, undefined);
    if (response.data.task) assert.deepEqual(ids(response.data.task), [String(ownTask._id), String(legacyTask._id)].sort());
  }
  const genericContacts = await api('GET', '/form?moduleId=' + contactModule._id);
  assert.equal(genericContacts.status, 200);
  assert(ids(genericContacts.data.data).includes(String(contact._id)));
  assert.equal((await api('GET', '/form/view/' + contact._id + '?moduleId=' + contactModule._id)).status, 200);
  const accounts = await api('GET', '/user');
  assert.equal(accounts.status, 200);
  assert.equal(accounts.data.user.length, 3);
  assert(accounts.data.user.every(user => user.password === undefined));

  const tasks = await api('GET', '/task');
  assert.equal(tasks.status, 200);
  assert.deepEqual(ids(tasks.data), ownIds);
  const genericTasks = await api('GET', '/form?moduleId=' + module._id);
  assert.equal(genericTasks.status, 200);
  assert.deepEqual(ids(genericTasks.data.data), ownIds);
  for (const task of [foreignTask, privateLegacy]) {
    assert.equal((await api('GET', '/task/view/' + task._id)).status, 404);
    assert.equal((await api('GET', '/form/view/' + task._id + '?moduleId=' + module._id)).status, 404);
    assert.equal((await api('DELETE', '/form/delete/' + task._id + '?moduleId=' + module._id)).status, 404);
  }
  const dashboard = await api('GET', '/status');
  assert.equal(dashboard.status, 200);
  assert.deepEqual(ids(dashboard.data.data.taskData), ownIds);
  assert.equal(dashboard.data.data.leadData.length, 0);
  const calendar = await api('GET', '/calendar');
  assert.equal(calendar.status, 200);
  assert.deepEqual(calendar.data.filter(item => item.groupId === 'task').map(item => String(item.id)).sort(), ownIds);
  assert(!calendar.data.some(item => String(item.id) === String(meeting._id)));

  for (const route of ['/email', '/phoneCall']) {
    const response = await api('GET', route);
    assert.equal(response.status, 200, JSON.stringify(response));
    assert.equal(response.data.length, 0, route);
  }
  const reports = await api('GET', '/reporting');
  assert.equal(reports.status, 200);
  assert.equal(reports.data.length, 1);
  assert.equal(reports.data[0]._id, String(ordinary._id));
  assert.equal(reports.data[0].emailsent, 0);
  assert.equal(reports.data.find(row => row._id === String(ordinary._id)).tasks, 2);
  const totals = await api('GET', '/reporting/line-chart');
  assert.equal(totals.status, 200);
  assert.equal(totals.data.find(row => row.name === 'Contacts').length, 0);
  assert.equal(totals.data.find(row => row.name === 'Opportunities').length, 0);
  assert.equal(totals.data.find(row => row.name === 'Tasks').length, 2);
  const chart = await api('POST', '/reporting/index', { startDate: '2026-10-07', endDate: '2026-10-07', filter: 'day' });
  assert.equal(chart.status, 200);
  assert.equal(chart.data.Email[0].totalEmails, 0);

  // No colleague records through direct URLs, generic forms, forged filters or nested histories.
  const privateCases = [
    ['opportunity', 'Opportunities', require('../model/schema/opprtunity'), opportunity],
    ['invoices', 'Invoices', require('../model/schema/invoices'), await insert(require('../model/schema/invoices'), { title: 'Private invoice', contact: contact._id })],
    ['meeting', 'Meetings', require('../model/schema/meeting'), meeting],
    ['email', 'Emails', require('../model/schema/email'), await insert(require('../model/schema/email'), { sender: admin._id, createByContact: contact._id, createByLead: lead._id })],
    ['phoneCall', 'Calls', require('../model/schema/phoneCall'), await insert(require('../model/schema/phoneCall'), { sender: admin._id, createByContact: contact._id, createByLead: lead._id })],
  ];
  const ownPrivate = [];
  for (const [path, moduleName, Model, foreign] of privateCases) {
    const module = await CustomField.create({ moduleName, fields: [] });
    const own = await insert(Model, { ...foreign, _id: new mongoose.Types.ObjectId(), createBy: ordinary._id,
      ...(moduleName === 'Calls' || moduleName === 'Emails' ? { sender: ordinary._id, timestamp: new Date('2026-10-07T12:00:00Z') } : {}) });
    ownPrivate.push(own);
    const rows = await api('GET', '/' + path);
    assert.equal(rows.status, 200, path + JSON.stringify(rows));
    assert.deepEqual(ids(rows.data), [String(own._id)], path);
    const forged = await api('GET', '/' + path + '?createBy=' + admin._id);
    assert.equal(forged.status, 200, path);
    assert(!ids(forged.data).includes(String(foreign._id)), path);
    assert.equal((await api('GET', '/' + path + '/view/' + foreign._id)).status, 404, path);
    assert.equal((await api('GET', '/' + path + '/view/' + own._id)).status, 200, path);
    const generic = await api('GET', '/form?moduleId=' + module._id);
    assert.equal(generic.status, 200, JSON.stringify(generic));
    assert.deepEqual(ids(generic.data.data), [String(own._id)], moduleName);
    assert.equal((await api('GET', '/form/view/' + foreign._id + '?moduleId=' + module._id)).status, 404, moduleName);
    const adminRows = await api('GET', '/' + path, null, admin);
    assert.equal(adminRows.status, 200);
    assert(ids(adminRows.data).includes(String(foreign._id)), moduleName + ' admin read');
    if (moduleName === 'Opportunities' || moduleName === 'Invoices') {
      const assigned = await insert(Model, { ...foreign, _id: new mongoose.Types.ObjectId(), [moduleName === 'Invoices' ? 'assignedTo' : 'assignUser']: ordinary._id });
      assert(ids((await api('GET', '/' + path)).data).includes(String(assigned._id)), 'assigned ' + moduleName);
      assert(ids((await api('GET', '/form?moduleId=' + module._id)).data.data).includes(String(assigned._id)));
    }
  }
  await require('../model/schema/contact').Contact.updateOne({ _id: contact._id }, { $set: { relatedOpportunities: [opportunity._id] } });
  await require('../model/schema/lead').Lead.updateOne({ _id: lead._id }, { $set: { relatedOpportunities: [opportunity._id] } });
  await require('../model/schema/meeting').collection.updateOne({ _id: meeting._id }, { $set: { attendes: [contact._id], attendesLead: [lead._id] } });
  const fileId = new mongoose.Types.ObjectId();
  await require('../model/schema/document').collection.updateOne({ _id: folder._id }, { $set: { file: [{ _id: fileId, fileName: 'private.txt', deleted: false, path: 'private.txt', img: 'http://localhost/api/document/images/private.txt', linkContact: contact._id, linkLead: lead._id }] } });
  for (const route of ['/contact/view/' + contact._id, '/lead/view/' + lead._id]) {
    const detail = (await api('GET', route)).data;
    assert.equal((detail.contact || detail.lead).relatedOpportunities.length, 0, route);
    for (const key of ['EmailHistory', 'phoneCallHistory', 'meetingHistory', 'Email', 'phoneCall', 'meeting', 'Document', 'invoice']) {
      if (detail[key]) {
        const privateIds = new Set([folder._id, meeting._id, ...privateCases.map(row => row[3]._id)].map(String));
        assert(detail[key].every(row => !privateIds.has(String(row._id))), key + ': nested privacy');
      }
    }
  }
  assert.equal((await api('GET', '/document')).data.length, 0);
  assert.equal((await api('GET', '/document/download/' + fileId)).status, 404);
  assert.equal((await api('GET', '/document/images/private.txt')).status, 404);
  const foreignAttachment = await insert(mongoose.model('EstateFile'), { name: 'private.txt', storageName: 'private.txt' });
  assert.equal((await api('GET', '/estate/files/' + foreignAttachment._id)).status, 404);
  const ownFolder = await insert(require('../model/schema/document'), { createBy: ordinary._id, folderName: 'My folder', file: [] });
  assert.deepEqual(ids((await api('GET', '/document')).data), [String(ownFolder._id)]);
  const ownCalendar = await api('GET', '/calendar');
  const foreignIds = new Set([meeting._id, ...privateCases.map(row => row[3]._id)].map(String));
  assert(ownCalendar.data.every(row => !foreignIds.has(String(row.id))));
  for (const own of ownPrivate.slice(2)) assert(ownCalendar.data.some(row => String(row.id) === String(own._id)));
  const privateTimeline = await api('POST', '/reporting/index?sender=' + admin._id, { startDate: '2026-10-07', endDate: '2026-10-07', filter: 'day' });
  assert.equal(privateTimeline.data.Email[0].totalEmails, 1, 'forged reporting sender');
  const ownReport = await api('GET', '/reporting');
  assert.equal(ownReport.data.length, 1);
  assert.equal(ownReport.data[0].emailsent, 1);
  const allReports = await api('GET', '/reporting', null, admin);
  assert.equal(allReports.data.length, 3);

  assert.equal((await api('PUT', '/task/edit/' + ownTask._id, { assignedToUser: String(other._id) })).status, 403);
  assert.equal((await api('POST', '/user/register', { username: 'forbidden@example.test', password: 'unused-test-only' })).status, 403);
  assert.equal((await api('DELETE', '/user/delete/' + admin._id)).status, 403);
  // Admins and developers can read every record or focus every data surface on one person.
  const developer = await User.create({ username: 'developer@example.test', password: 'unused-test-only', role: 'developer' });
  const { readScope } = require('../services/recordAccess');
  const newDirectory = [
    ['contact', 'Contacts', require('../model/schema/contact').Contact, { firstName: 'Own', lastName: 'Contact' }],
    ['lead', 'Leads', require('../model/schema/lead').Lead, { leadName: 'Own lead' }],
    ['property', 'Properties', require('../model/schema/property').Property, { title: 'Own property' }],
    ['estate/Partner%20Customers', 'Partner Customers', require('../model/schema/partnerCustomer'), { fullName: 'Own partner' }],
    ['estate/Residences', 'Residences', require('../model/schema/residence'), { name: 'Own residence' }],
    ['quotes', 'Quotes', require('../model/schema/quotes'), { title: 'Own quote' }],
    ['email-temp', 'Email Template', require('../model/schema/emailTemplate'), { title: 'Own template' }],
    ['bank-details', 'Bank Details', require('../model/schema/bankDetails'), { bankName: 'Own bank' }],
    ['opportunityproject', 'Opportunity Project', require('../model/schema/opportunityproject'), { name: 'Own project' }],
  ];
  for (const [path, name, Model, values] of newDirectory) await insert(Model, { ...values, createBy: ordinary._id });
  const surfaces = [
    ...newDirectory.map(row => row.slice(0, 3)),
    ...privateCases.map(([path, name, Model]) => [path, name, Model]),
    ['document', 'Documents', require('../model/schema/document')],
    ['task', 'Tasks', Task],
  ];
  for (const manager of [admin, developer]) {
    for (const [path, name, Model] of surfaces) {
      const all = await api('GET', '/' + path, null, manager);
      assert.equal(all.status, 200, path + ' all');
      const allRows = Array.isArray(all.data) ? all.data : all.data.items;
      const expectedAll = await Model.find({ deleted: false }).select('_id').lean();
      assert.deepEqual(ids(allRows), ids(expectedAll), name + ' admin complete data');
      const selected = await api('GET', '/' + path, null, manager, ordinary._id);
      assert.equal(selected.status, 200, path + JSON.stringify(selected));
      const rows = Array.isArray(selected.data) ? selected.data : selected.data.items;
      const expected = await Model.find(readScope({ dataSubject: ordinary._id }, manager, name, { deleted: false })).select('_id').lean();
      assert.deepEqual(ids(rows), ids(expected), name + ' selected user');
    }
    const selectedTasks = await api('GET', '/form?moduleId=' + module._id, null, manager, ordinary._id);
    assert.deepEqual(ids(selectedTasks.data.data), ownIds);
    const focusedContacts = await api('GET', '/form?moduleId=' + contactModule._id, null, manager, ordinary._id);
    assert.equal(focusedContacts.data.data.length, 1);
    const focusedCalendar = await api('GET', '/calendar', null, manager, ordinary._id);
    assert.deepEqual(focusedCalendar.data.filter(row => row.groupId === 'task').map(row => String(row.id)).sort(), ownIds);
    assert(focusedCalendar.data.every(row => !foreignIds.has(String(row.id))));
    const focusedReport = await api('GET', '/reporting', null, manager, ordinary._id);
    assert.deepEqual(ids(focusedReport.data), [String(ordinary._id)]);
    const focusedChart = await api('POST', '/reporting/index', { startDate: '2026-10-07', endDate: '2026-10-07', filter: 'day' }, manager, ordinary._id);
    assert.equal(focusedChart.data.Email[0].totalEmails, 1, 'selected timeline');
    const focusedAnalytics = await api('GET', '/reporting/line-chart', null, manager, ordinary._id);
    assert.equal(focusedAnalytics.data.find(row => row.name === 'Contacts').length, 1);
    const selectedProfiles = await api('GET', '/user', null, manager, ordinary._id);
    assert.deepEqual(ids(selectedProfiles.data.user), [String(ordinary._id)]);
    // Selecting another person is a filter and never removes the admin's record-view authority.
    assert.equal((await api('GET', '/contact/view/' + contact._id, null, manager, ordinary._id)).status, 200);
    assert.equal((await api('GET', '/task/view/' + foreignTask._id, null, manager, ordinary._id)).status, 200);
  }
  assert.equal((await api('GET', '/invoices', null, ordinary, admin._id)).status, 403);
  assert.equal((await api('GET', '/task', null, admin, 'invalid')).status, 400);
  assert.equal((await api('GET', '/task', null, admin, new mongoose.Types.ObjectId())).status, 404);
  // Data belonging to a removed creator remains readable to admins.
  const orphan = await insert(require('../model/schema/contact').Contact, { createBy: new mongoose.Types.ObjectId(), firstName: 'Archived owner record' });
  assert(ids((await api('GET', '/contact', null, admin)).data).includes(String(orphan._id)));

  const ownNotification = await Notification.create({ recipient: ordinary._id, actor: admin._id, type: 'task_assigned', message: 'Own assignment' });
  await Notification.create({ recipient: other._id, type: 'task_assigned', message: 'Other assignment' });
  const inbox = await api('GET', '/notification');
  assert.equal(inbox.status, 200);
  assert.deepEqual(ids(inbox.data.notifications), [String(ownNotification._id)]);
});
