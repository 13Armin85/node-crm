const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');

test('dashboard values, form filters, lead notes and opportunity activities/documents persist together', { skip: process.env.CRM_FIXES_INTEGRATION !== '1' }, async t => {
  const dbName = 'crm_dashboard_workspace_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  const app = express(); app.use(express.json()); app.use('/api', require('../controllers/route'));
  const User = require('../model/schema/user'), Opportunity = require('../model/schema/opprtunity');
  const { Property } = require('../model/schema/property'), Residence = require('../model/schema/residence');
  const { Lead } = require('../model/schema/lead'), Document = require('../model/schema/document');
  const admin = await User.create({ username: 'dashboard@example.test', password: 'unused', role: 'admin' });
  const other = await User.create({ username: 'other@example.test', password: 'unused', role: 'user' });
  const lead = await Lead.create({ createBy: admin._id, assignUser: admin._id });
  const opportunity = await Opportunity.create({ opportunityName: 'Standalone opportunity', createBy: admin._id, salesStage: 'Closed/Won', commission: 25, amount: '1000000', currency: 'USD' });
  await Opportunity.create({ opportunityName: 'Lost', createBy: admin._id, salesStage: 'Closed/Lost', commission: 9, amount: '90000', currency: 'TRY' });
  await Opportunity.create({ opportunityName: 'Open', createBy: admin._id, salesStage: 'Prospecting', commission: 999, currency: 'TRY' });
  await Opportunity.create({ opportunityName: 'Deleted', createBy: admin._id, deleted: true, salesStage: 'Closed/Won', commission: 999, currency: 'TRY' });
  const residence = await Residence.create({ name: 'Cash Residence', city: 'Istanbul', district: 'Kadikoy', constructionStatus: 'READY', price: { amount: 100, currency: 'USD' }, paymentMethod: 'CASH', createBy: admin._id });
  await Residence.create({ name: 'Installment Residence', city: 'Ankara', district: 'Cankaya', constructionStatus: 'UNDER_CONSTRUCTION', price: { amount: 200, currency: 'TRY' }, paymentMethod: 'INSTALLMENTS', createBy: admin._id });
  await Property.create({ title: 'Sold', category: 'RESIDENTIAL', subtype: 'VILLA', transactionType: 'SALE', district: 'Kadikoy', residence: residence._id, bedroom: '2+1', floor: '3', occupancyStatus: 'EMPTY', price: { amount: 1000, currency: 'USD' }, sale: { status: 'SOLD' }, createBy: admin._id });
  await Property.create({ title: 'Available', price: { amount: 3400, currency: 'TRY' }, sale: { status: 'AVAILABLE' }, createBy: admin._id });
  await Property.create({ title: 'Deleted property', deleted: true, price: { amount: 999999, currency: 'TRY' }, sale: { status: 'SOLD' }, createBy: admin._id });
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const uploaded = [];
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    const root = path.resolve(__dirname, '../uploads/document') + path.sep;
    for (const filename of uploaded) { assert(filename.startsWith(root)); await fs.unlink(filename).catch(() => {}); }
    assert.equal(mongoose.connection.name, dbName); assert(dbName.startsWith('crm_dashboard_workspace_'));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  });
  const api = async (method, route, body, actor = admin) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api' + route, {
      method, headers: { Authorization: jwt.sign({ userId: actor._id }, require('../config/auth').jwtSecret, { expiresIn: '5m' }), ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  const finance = await api('GET', '/estate/dashboard/finance');
  assert.equal(finance.status, 200, JSON.stringify(finance));
  assert.deepEqual(finance.data, {
    soldProperties: { count: 1, values: [{ currency: 'USD', amount: 1000 }] },
    successfulIncome: { count: 1, values: [{ currency: 'USD', amount: 25 }] },
    lostIncome: { count: 1, values: [{ currency: 'TRY', amount: 9 }] },
  });
  await Opportunity.create({ opportunityName: 'Historical sale', createBy: admin._id, salesStage: 'Closed/Won', commission: 999, currency: 'TRY', closedAt: new Date('2000-01-01'), createdDate: new Date('2000-01-01') });
  const recent = await api('GET', '/estate/dashboard/finance?period=week');
  assert.equal(recent.status, 200); assert.deepEqual(recent.data, finance.data);
  const allTime = (await api('GET', '/estate/dashboard/finance')).data;
  assert.equal(allTime.successfulIncome.count, 2);
  assert.equal(allTime.successfulIncome.values.find(value => value.currency === 'TRY').amount, 999);
  assert.deepEqual(allTime.soldProperties, finance.data.soldProperties);
  assert.equal(allTime.unsoldProperties, undefined);
  assert.equal((await api('GET', '/estate/dashboard/finance?period=invalid')).status, 400);
  const params = new URLSearchParams({ city: 'Istanbul', district: 'Kadikoy', constructionStatus: 'READY', 'price.currency': 'USD', paymentMethod: 'CASH', priceMin: '90', priceMax: '110' });
  const filtered = await api('GET', '/estate/Residences?' + params);
  assert.equal(filtered.status, 200); assert.equal(filtered.data.total, 1); assert.equal(filtered.data.items[0]._id, String(residence._id));
  assert.equal((await api('GET', '/estate/Residences?paymentMethod=INSTALLMENTS&price.currency=USD')).data.total, 0);
  const definition = (await api('GET', '/estate/definitions/Residences')).data;
  assert.deepEqual(definition.fields.find(field => field.name === 'paymentMethod').options.map(option => option.value), ['CASH', 'INSTALLMENTS', 'BOTH']);
  const saved = await api('PUT', '/estate/Residences/' + residence._id, { paymentMethod: 'BOTH' });
  assert.equal(saved.status, 200, JSON.stringify(saved));
  assert.equal((await api('GET', '/estate/Residences?paymentMethod=BOTH')).data.total, 1);
  const propertyFilters = new URLSearchParams({ category: 'RESIDENTIAL', subtype: 'VILLA', transactionType: 'SALE', district: 'Kadikoy', residence: String(residence._id), bedroom: '2+1', floor: '3', occupancyStatus: 'EMPTY', 'sale.status': 'SOLD' });
  assert.equal((await api('GET', '/estate/Properties?' + propertyFilters)).data.total, 1);
  assert.equal((await api('GET', '/estate/Properties?residence=' + residence._id + '&floor=4')).data.total, 0);
  const notes = '/record-workspace/Leads/' + lead._id + '/notes';
  assert.equal((await api('POST', notes, { text: 'Lead note', clientId: 'lead-note' })).status, 201);
  assert.equal((await api('POST', notes, { text: 'Retry', clientId: 'lead-note' })).status, 201);
  assert.equal((await api('GET', notes)).data.items.length, 1);
  assert.equal((await api('GET', notes, undefined, other)).status, 404);
  const id = String(opportunity._id);
  const task = await api('POST', '/task/add', { title: 'Opportunity task', category: 'None', opportunity: id, status: 'todo', priority: 'normal' });
  assert.equal(task.status, 200, JSON.stringify(task));
  const meeting = await api('POST', '/meeting/add', { agenda: 'Opportunity meeting', opportunity: id, related: 'None', dateTime: new Date().toISOString() });
  assert.equal(meeting.status, 200, JSON.stringify(meeting));
  const call = await api('POST', '/phoneCall/add', { recipient: '+905551234567', callNotes: 'Opportunity call', opportunity: id, sender: String(admin._id), salesAgent: String(admin._id), startDate: new Date().toISOString() });
  assert.equal(call.status, 200, JSON.stringify(call));
  const mail = require('../middelwares/mail'), original = mail.sendEmail;
  mail.sendEmail = async () => ({ accepted: ['recipient@example.test'] });
  try {
    const email = await api('POST', '/email/add', { recipient: 'recipient@example.test', subject: 'Opportunity email', message: 'Message', type: 'message', opportunity: id });
    assert.equal(email.status, 200, JSON.stringify(email));
  } finally { mail.sendEmail = original; }
  const activities = await api('GET', '/record-workspace/Opportunities/' + id + '/activities');
  assert.equal(activities.status, 200, JSON.stringify(activities));
  for (const module of ['Tasks', 'Meetings', 'Calls', 'Emails']) { assert.equal(activities.data[module].length, 1); assert.equal(activities.data[module][0].opportunity, id); }
  assert.equal((await api('POST', '/meeting/add', { agenda: 'Invalid relation', opportunity: String(new mongoose.Types.ObjectId()) })).status, 404);
  for (const [entityType, entityId] of [['Lead', lead._id], ['Opportunity', opportunity._id]]) {
    const form = new FormData(); form.append('folderName', 'Record documents'); form.append('entityType', entityType); form.append('entityId', String(entityId));
    form.append('files', new Blob(['record document ' + crypto.randomUUID()], { type: 'text/plain' }), 'record.txt');
    const result = await api('POST', '/document/add', form);
    assert.equal(result.status, 200, JSON.stringify(result));
    const folder = await Document.findById(result.data.folder._id).lean(); uploaded.push(...folder.file.map(file => file.path));
    const related = await api('GET', '/document/?' + new URLSearchParams({ entityType, entityId: String(entityId) }));
    assert.equal(related.data.flatMap(folder => folder.files).length, 1);
    const global = await api('GET', '/document/?category=' + (entityType === 'Lead' ? 'LEADS' : 'OPPORTUNITIES'));
    assert.equal(global.data.flatMap(folder => folder.files).length, 1);
  }
});
