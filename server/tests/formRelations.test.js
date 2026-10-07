const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../model/schema/user');
const Notification = require('../model/schema/notification');
const CustomField = require('../model/schema/customField');
const FormDefinition = require('../model/schema/formDefinition');
const { Lead, initializeLeadSchema } = require('../model/schema/lead');
const { Contact } = require('../model/schema/contact');
const { Property } = require('../model/schema/property');
const PartnerCustomer = require('../model/schema/partnerCustomer');
const { leadFields } = require('../db/leadFields');
const { jwtSecret } = require('../config/auth');

test('authenticated lead form create, reload, edit and clear retain relations with database adapters mocked', async t => {
  const actor = { _id: '64d33173fd7ff3fa0924a101', role: 'admin', deleted: false };
  const module = { _id: '64d33173fd7ff3fa0924a102', moduleName: 'Leads', fields: leadFields };
  const contact = '64d33173fd7ff3fa0924a103';
  const partner = '64d33173fd7ff3fa0924a104';
  const opportunity = '64d33173fd7ff3fa0924a105';
  const notifications = t.mock.method(Notification, 'create', async value => value);
  const records = new Map();
  const query = value => ({ select: () => query(value), lean: () => Promise.resolve(value), then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
  t.mock.method(User, 'findOne', () => query(actor));
  t.mock.method(CustomField, 'findById', () => query(module));
  t.mock.method(CustomField, 'findOne', () => query(module));
  t.mock.method(CustomField, 'find', () => query([module]));
  t.mock.method(FormDefinition, 'findOne', () => query(null));
  await initializeLeadSchema();
  const previousDb = mongoose.connection.db;
  mongoose.connection.db = { listCollections: () => ({ hasNext: async () => true }) };
  t.after(() => { mongoose.connection.db = previousDb; });
  t.mock.method(Lead, 'exists', async filter => records.has(String(filter._id)));
  t.mock.method(Lead, 'findById', id => query(records.get(String(id))));
  t.mock.method(Lead, 'findOne', filter => query(records.get(String(filter._id))));
  t.mock.method(Lead.prototype, 'save', async function () {
    await this.validate();
    records.set(String(this._id), this.toObject());
    return this;
  });
  t.mock.method(Lead, 'findOneAndUpdate', async (filter, update) => {
    const previous = records.get(String(filter._id));
    if (!previous) return null;
    const values = { ...previous, ...update.$set };
    for (const key of Object.keys(update.$unset || {})) delete values[key];
    const document = new Lead(values);
    await document.validate();
    records.set(String(document._id), document.toObject());
    return document;
  });
  for (const model of [Contact, Property, PartnerCustomer]) {
    t.mock.method(model, 'updateMany', async () => ({ modifiedCount: 1 }));
    t.mock.method(model, 'updateOne', async () => ({ modifiedCount: 1 }));
  }
  const app = express();
  app.use(express.json());
  app.use('/api/form', require('../controllers/form/_routes'));
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const api = async (method, route, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/form${route}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ userId: actor._id }, jwtSecret, { expiresIn: '5m' })}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  const created = await api('POST', '/add', { moduleId: module._id, leadName: 'Lead', leadEmail: 'lead@example.com', contact, partnerCustomer: partner, associatedListing: null, assignUser: null });
  assert.equal(created.status, 200, JSON.stringify(created));
  const id = created.data.data._id;
  const reload = () => api('GET', `/view/${id}?moduleId=${module._id}`);
  assert.equal((await reload()).data.data.contact, contact);
  assert.equal((await reload()).data.data.partnerCustomer, partner);
  const edited = await api('PUT', `/edit/${id}`, { ...(await reload()).data.data, moduleId: module._id, leadName: 'Updated', relatedOpportunities: [opportunity] });
  assert.equal(edited.status, 200, JSON.stringify(edited));
  const saved = (await reload()).data.data;
  assert.equal(saved.leadName, 'Updated');
  assert.equal(saved.contact, contact);
  assert.equal(saved.partnerCustomer, partner);
  assert.deepEqual(saved.relatedOpportunities, [opportunity]);
  assert(Contact.updateOne.mock.calls.some(call => String(call.arguments[0]._id) === contact));
  assert(PartnerCustomer.updateOne.mock.calls.some(call => String(call.arguments[0]._id) === partner));
  const cleared = await api('PUT', `/edit/${id}`, { moduleId: module._id, contact: null, partnerCustomer: null, relatedOpportunities: [] });
  assert.equal(cleared.status, 200, JSON.stringify(cleared));
  const empty = (await reload()).data.data;
  assert.equal(empty.contact, null);
  assert.equal(empty.partnerCustomer, null);
  assert(notifications.mock.calls.some(call => call.arguments[0].type === 'record_created'));
  assert(notifications.mock.calls.some(call => call.arguments[0].type === 'record_updated'));
  assert(notifications.mock.calls.every(call => String(call.arguments[0].recipient) === actor._id));
});
