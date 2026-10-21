const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const User = require('../model/schema/user');
const Share = require('../model/schema/recordShare');
const Notification = require('../model/schema/notification');
const { Lead } = require('../model/schema/lead');
const PartnerCustomer = require('../model/schema/partnerCustomer');
const actor = { _id: '64d33173fd7ff3fa0924a101', role: 'admin', deleted: false };
const recipient = { _id: '64d33173fd7ff3fa0924a102', role: 'user', firstName: 'Ali', deleted: false };
const id = '64d33173fd7ff3fa0924a103';
test('the sending API restricts modules and returns persisted recipient names to admins', async t => {
  const query = value => ({ select() { return this; }, populate() { return this; }, lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
  t.mock.method(User, 'findOne', () => query(actor));
  t.mock.method(User, 'exists', async () => true);
  t.mock.method(Lead, 'findOne', () => query({ _id: id, leadName: 'Lead' }));
  t.mock.method(PartnerCustomer, 'findOne', () => query({ _id: id, fullName: 'Partner customer' }));
  const save = t.mock.method(Share, 'updateOne', async () => ({ upsertedId: id }));
  t.mock.method(require('../services/leadWorkflow'), 'assignLead', async (recordId, recipientId) => {
    await Share.updateOne({ module: 'Leads', recordId, recipient: recipientId }, {});
    return { created: true };
  });
  t.mock.method(Share, 'find', () => query([{ recipient, createdAt: new Date() }]));
  t.mock.method(Notification, 'create', async value => value);
  const app = express(); app.use(express.json()); app.use('/sharing', require('../controllers/recordSharing'));
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const api = async (method, path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sharing${path}`, {
      method, headers: { Authorization: jwt.sign({ userId: actor._id }, jwtSecret, { expiresIn: '5m' }), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  for (const module of ['Contacts', 'Invoices', 'Meetings', 'Calls', 'Emails', 'Properties']) {
    assert.equal((await api('POST', '/', { module, recordId: id, recipientId: recipient._id })).status, 400);
  }
  assert.equal(save.mock.callCount(), 0);
  assert.equal((await api('POST', '/', { module: 'Leads', recordId: id, recipientId: recipient._id })).status, 201);
  assert.equal(save.mock.callCount(), 1);
  const saved = await api('GET', `/Leads/${id}`);
  assert.equal(saved.status, 200); assert.equal(saved.body[0].user.firstName, 'Ali');
  assert.equal((await api('POST', '/', { module: 'Partner Customers', recordId: id, recipientId: recipient._id })).status, 201);
  assert.equal(save.mock.callCount(), 2);
  const partnerRecipients = await api('GET', `/Partner%20Customers/${id}`);
  assert.equal(partnerRecipients.status, 200);
  assert.equal(partnerRecipients.body[0].user._id, recipient._id);
  assert.equal(save.mock.calls[1].arguments[0].module, 'Partner Customers');
  assert.deepEqual(require('../services/recordSharing').shareableModules, ['Leads', 'Opportunities', 'Documents', 'Partner Customers']);
});
