const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

test('lead ownership, automatic call tasks, exclusive transfers and configured opportunity stages persist through HTTP',
  { skip: process.env.PIPELINE_INTEGRATION !== '1', timeout: 60000 }, async t => {
  const dbName = 'pipeline_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  mongoose.set('strictQuery', false);
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName); assert(dbName.startsWith('pipeline_test_'));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  });
  const app = express(); app.use(express.json()); app.use('/api', require('../controllers/route'));
  app.use(require('../middelwares/securityHeaders').errorHandler);
  const User = require('../model/schema/user'), Task = require('../model/schema/task');
  const { Lead } = require('../model/schema/lead');
  const Opportunity = require('../model/schema/opprtunity');
  const Share = require('../model/schema/recordShare');
  const FormDefinition = require('../model/schema/formDefinition');
  Lead.schema.add({ leadName: String, leadEmail: String, leadMobile: String });
  const module = await require('../model/schema/customField').create({ moduleName: 'Leads', fields: [
    ...require('../db/leadFields').leadFields, { name: 'createBy', backendType: 'Mixed', type: 'text', isDefault: true },
  ] });
  await require('../model/schema/lead').initializeLeadSchema();
  assert.equal(Lead.schema.path('createBy').options.ref, 'User');
  assert.equal(Lead.schema.path('createBy').instance, 'ObjectId');
  const admin = await User.create({ username: 'pipeline-admin@example.test', password: 'unused', role: 'admin' });
  const first = await User.create({ username: 'first@example.test', firstName: 'First', lastName: 'Owner', password: 'unused', role: 'user', moduleVisibility: { Leads: true, Tasks: true } });
  const second = await User.create({ username: 'second@example.test', password: 'unused', role: 'user', moduleVisibility: { Leads: true, Tasks: true } });
  const third = await User.create({ username: 'third@example.test', password: 'unused', role: 'user', moduleVisibility: { Leads: true, Tasks: true } });
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const api = async (method, route, body, actor = first) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api' + route, {
      method, headers: { 'Content-Type': 'application/json', Authorization: jwt.sign({ userId: actor._id }, jwtSecret, { expiresIn: '5m' }) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  const makeLead = async name => {
    const response = await api('POST', '/form/add', { moduleId: String(module._id), leadName: name, createBy: String(third._id) });
    assert.equal(response.status, 200, JSON.stringify(response));
    return response.data.data;
  };
  let lead, firstTask;
  await t.test('creation attributes the original owner and creates exactly one named call task', async () => {
    lead = await makeLead('Example');
    assert.equal(lead.createBy, String(first._id)); assert.equal(lead.assignUser, String(first._id));
    const tasks = await Task.find({ leadCallFor: lead._id, deleted: false }).lean();
    assert.equal(tasks.length, 1); firstTask = tasks[0];
    assert.equal(firstTask.title, 'تماس با لید Example'); assert.equal(String(firstTask.assignedToUser), String(first._id));
    assert.equal(String(firstTask.assignToLead), lead._id);
    const listing = await api('GET', '/lead');
    assert.equal(listing.data[0].createBy.firstName, 'First');
    assert.equal((await api('GET', '/lead', null, second)).data.length, 0);
    const edit = await api('PUT', '/form/edit/' + lead._id, { moduleId: String(module._id), leadName: 'Renamed' });
    assert.equal(edit.status, 200, JSON.stringify(edit));
    assert.equal(await Task.countDocuments({ leadCallFor: lead._id, deleted: false }), 1);
    assert.equal((await Task.findById(firstTask._id)).title, 'تماس با لید Renamed');
  });
  await t.test('administrator transfer removes both items from the former assignee, even with visible modules', async () => {
    const sent = await api('POST', '/record-sharing', { module: 'Leads', recordId: lead._id, recipientId: String(second._id) }, admin);
    assert.equal(sent.status, 201, JSON.stringify(sent));
    assert.equal((await api('GET', '/lead')).data.length, 0);
    assert.equal((await api('GET', '/task')).data.length, 0);
    assert.equal((await api('GET', '/lead/view/' + lead._id)).status, 404);
    assert.equal((await api('PUT', '/lead/edit/' + lead._id, { leadName: 'Unauthorized' })).status, 404);
    const next = await api('GET', '/lead', null, second);
    assert.equal(next.data.length, 1); assert.equal(next.data[0].createBy.firstName, 'First');
    const tasks = await api('GET', '/task', null, second);
    assert.equal(tasks.data.length, 1);
    assert.equal((await Task.findById(firstTask._id)).deleted, true);
    assert.notEqual(tasks.data[0]._id, String(firstTask._id));
    assert.equal(String((await Lead.findById(lead._id)).createBy), String(first._id));
    assert.equal(await Share.countDocuments({ module: 'Leads', recordId: lead._id }), 1);
    const duplicateSend = await api('POST', '/record-sharing', { module: 'Leads', recordId: lead._id, recipientId: String(second._id) }, admin);
    assert.equal(duplicateSend.status, 200);
    assert.equal(await Task.countDocuments({ leadCallFor: lead._id, deleted: false }), 1);
  });
  await t.test('users cannot transfer their lead; another administrator transfer and revocation reconcile tasks', async () => {
    assert.equal((await api('POST', '/record-sharing', { module: 'Leads', recordId: lead._id, recipientId: String(third._id) }, second)).status, 403);
    const forbidden = await api('PUT', '/form/edit/' + lead._id, { moduleId: String(module._id), assignUser: String(third._id) }, second);
    assert.equal(forbidden.status, 403, JSON.stringify(forbidden));
    assert.equal((await api('POST', '/record-sharing', { module: 'Leads', recordId: lead._id, recipientId: String(third._id) }, admin)).status, 201);
    assert.equal((await api('GET', '/lead', null, second)).data.length, 0);
    assert.equal((await api('GET', '/task', null, second)).data.length, 0);
    assert.equal((await api('GET', '/task', null, third)).data.length, 1);
    assert.equal((await api('DELETE', '/record-sharing/Leads/' + lead._id + '/' + third._id, null, admin)).status, 200);
    assert.equal((await api('GET', '/lead')).data.length, 1);
    assert.equal((await api('GET', '/task')).data.length, 1);
    assert.equal((await api('GET', '/task', null, third)).data.length, 0);
  });
  await t.test('delegating the generated task also transfers its lead', async () => {
    const task = await Task.findOne({ leadCallFor: lead._id, deleted: false }).lean();
    const moved = await api('PUT', '/task/edit/' + task._id, { assignedToUser: String(second._id) }, admin);
    assert.equal(moved.status, 200, JSON.stringify(moved));
    assert.equal(String((await Lead.findById(lead._id)).assignUser), String(second._id));
    assert.equal((await api('GET', '/lead')).data.length, 0);
    assert.equal((await api('GET', '/task')).data.length, 0);
  });

  await t.test('simultaneous transfers leave the task and recipient consistent with the final lead assignee', async () => {
    await Promise.all([second, third].map(actor => api('POST', '/record-sharing', {
      module: 'Leads', recordId: lead._id, recipientId: String(actor._id),
    }, admin)));
    const current = await Lead.findById(lead._id);
    const tasks = await Task.find({ leadCallFor: lead._id, deleted: false });
    assert.equal(tasks.length, 1);
    assert.equal(String(tasks[0].assignedToUser), String(current.assignUser));
    assert.equal(String((await Share.findOne({ module: 'Leads', recordId: lead._id })).recipient), String(current.assignUser));
    await api('POST', '/record-sharing', { module: 'Leads', recordId: lead._id, recipientId: String(second._id) }, admin);
  });

  await t.test('conversion and deletion retire automatic call tasks', async () => {
    const converted = await api('POST', '/lead/convert/' + lead._id, { mode: 'contactAndOpportunity' }, second);
    assert.equal(converted.status, 200, JSON.stringify(converted));
    assert.equal(await Task.countDocuments({ leadCallFor: lead._id, deleted: false }), 0);
    assert.equal(String((await Opportunity.findById(converted.data.opportunityId)).createBy), String(second._id));
    const other = await makeLead('To delete');
    assert.equal((await api('DELETE', '/lead/delete/' + other._id)).status, 200);
    assert.equal(await Task.countDocuments({ leadCallFor: other._id, deleted: false }), 0);
  });
  await t.test('bulk inserts and simultaneous updates never duplicate the active call task', async () => {
    const bulk = await api('POST', '/lead/addMany', [{ leadName: 'Bulk One' }, { leadName: 'Bulk Two' }]);
    assert.equal(bulk.status, 200, JSON.stringify(bulk));
    for (const record of bulk.data) assert.equal(await Task.countDocuments({ leadCallFor: record._id, deleted: false }), 1);
    const id = bulk.data[0]._id;
    await Promise.all([1, 2, 3].map(() => api('PUT', '/lead/edit/' + id, { leadName: 'Bulk One Updated' })));
    assert.equal(await Task.countDocuments({ leadCallFor: id, deleted: false }), 1);
  });

  await t.test('legacy leads gain one call task and keep only their last recipient through an idempotent migration', async () => {
    const legacyId = new mongoose.Types.ObjectId();
    await Lead.collection.insertOne({ _id: legacyId, leadName: 'Legacy Prospect', createBy: first._id, deleted: false });
    await Share.insertMany([
      { module: 'Leads', recordId: legacyId, recipient: second._id, sharedBy: admin._id, createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-01') },
      { module: 'Leads', recordId: legacyId, recipient: third._id, sharedBy: admin._id, createdAt: new Date('2020-02-01'), updatedAt: new Date('2020-02-01') },
    ]);
    const legacyOwnId = new mongoose.Types.ObjectId();
    await Lead.collection.insertOne({ _id: legacyOwnId, leadName: 'Legacy own lead', createBy: String(first._id), deleted: false });
    const { reconcileExistingLeads } = require('../services/leadWorkflowMigration');
    const preview = await reconcileExistingLeads();
    assert.equal(preview.legacyTransfers, 1); assert.equal(preview.callTasksToCreate, 2);
    assert.equal(await Task.countDocuments({ leadCallFor: legacyId }), 0);
    await reconcileExistingLeads(true);
    assert.equal(String((await Lead.findById(legacyId)).createBy), String(first._id));
    assert.equal(String((await Lead.findById(legacyId)).assignUser), String(third._id));
    assert.equal(String((await Task.findOne({ leadCallFor: legacyId, deleted: false })).assignedToUser), String(third._id));
    assert.equal(await Share.countDocuments({ module: 'Leads', recordId: legacyId }), 1);
    assert.equal(String((await Lead.findById(legacyOwnId)).assignUser), String(first._id));
    const owned = await api('GET', '/lead');
    assert.equal(owned.data.find(row => row._id === String(legacyOwnId)).createBy.firstName, 'First');
    const repeat = await reconcileExistingLeads(true);
    assert.equal(repeat.legacyTransfers, 0); assert.equal(repeat.callTasksToCreate, 0);
  });

  await t.test('opportunity movement accepts exactly the configured sales stages and enforces mutation ownership', async () => {
    const stages = ['Prospecting', 'Custom Stage'];
    await FormDefinition.create({ moduleName: 'Opportunities', fields: [
      { name: 'salesStage', kind: 'SYSTEM_FIELD', type: 'select', options: stages.map(value => ({ value, label: { en: value } })) },
      { name: 'opportunityName', kind: 'SYSTEM_FIELD', type: 'text', required: true },
      { name: 'extra', kind: 'CUSTOM_FIELD', type: 'text', required: true },
    ] });
    const opportunity = await Opportunity.create({ opportunityName: 'Deal', createBy: first._id, salesStage: stages[0] });
    assert.equal((await api('PUT', '/opportunity/stage/' + opportunity._id, { salesStage: stages[1] })).status, 200);
    assert.equal((await Opportunity.findById(opportunity._id)).salesStage, stages[1]);
    assert.equal((await api('PUT', '/opportunity/stage/' + opportunity._id, { salesStage: 'Qualification' })).status, 400);
    assert.equal((await api('PUT', '/opportunity/stage/' + opportunity._id, { salesStage: stages[0] }, second)).status, 404);
    assert.equal((await Opportunity.findById(opportunity._id)).salesStage, stages[1]);
  });
});
