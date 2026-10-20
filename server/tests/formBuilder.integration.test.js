const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const enabled = process.env.FORM_BUILDER_INTEGRATION === '1';

test('admin field configuration persists and controls actual forms without changing existing records', { skip: !enabled }, async t => {
  const dbName = 'crm_unlocked_forms_test_' + crypto.randomUUID().replace(/-/g, '');
  let server;
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  try {
    require('../middelwares/mail').sendEmail = async () => null;
    const app = express(); app.use(express.json()); app.use('/api', require('../controllers/route'));
    app.use(require('../middelwares/securityHeaders').errorHandler);
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const User = require('../model/schema/user');
    const CustomField = require('../model/schema/customField');
    const FormDefinition = require('../model/schema/formDefinition');
    const { Contact, initializeContactSchema } = require('../model/schema/contact');
    const { getDefinition } = require('../services/formDefinitions');
    const admin = await User.create({ username: 'forms-admin@example.test', password: 'test-hash', role: 'admin' });
    const user = await User.create({ username: 'forms-user@example.test', password: 'test-hash', role: 'user' });
    const legacy = await CustomField.create({ moduleName: 'Contacts', fields: ['fullName', 'email', 'phoneNumber', 'campaign'].map(name => ({ name, label: name, type: 'text', backendType: 'String', fixed: true })) });
    await initializeContactSchema();
    const original = await Contact.create({ fullName: 'Existing person', email: 'existing@example.test', createBy: admin._id });
    const originalRecord = await Contact.findById(original._id).lean();
    const api = async (method, route, body, actor = admin) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`, { method,
        headers: { 'Content-Type': 'application/json', Authorization: jwt.sign({ userId: actor._id, sv: 0 }, jwtSecret, { expiresIn: '5m' }) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    let saved;
    await t.test('admin can edit every previously locked field setting and system options', async () => {
      const definition = await getDefinition('Contacts');
      assert(definition.fields.every(field => !field.locked));
      const fields = definition.fields.map(field => ({ ...field, required: false,
        ...(field.name === 'fullName' ? { type: 'textarea', label: { en: 'Admin name', fa: 'نام دلخواه', tr: 'Ad' } } : {}),
        ...(field.name === 'email' ? { enabled: false } : {}),
        ...(field.name === 'campaign' ? { options: [{ value: 'CUSTOM', label: { en: 'Custom', fa: 'دلخواه', tr: 'Özel' } }] } : {}),
      })).reverse();
      saved = await api('PUT', '/estate/definitions/Contacts', { ...definition, fields });
      assert.equal(saved.status, 200, JSON.stringify(saved));
      const loaded = await api('GET', '/estate/definitions/Contacts');
      assert.deepEqual(loaded.data, saved.data);
      assert.equal(loaded.data.fields.find(field => field.name === 'fullName').type, 'textarea');
      assert.equal(loaded.data.fields.find(field => field.name === 'fullName').required, false);
      assert.equal(loaded.data.fields.find(field => field.name === 'email').enabled, false);
      assert.deepEqual(loaded.data.fields.find(field => field.name === 'campaign').options.map(option => option.value), ['CUSTOM']);
    });
    await t.test('normal users cannot save definitions and stale admin saves conflict', async () => {
      assert.equal((await api('PUT', '/estate/definitions/Contacts', saved.data, user)).status, 403);
      assert.equal((await api('PUT', '/estate/definitions/Contacts', { ...saved.data, revision: 0 })).status, 409);
    });
    await t.test('system fields may be removed without resurrection on repeated saves', async () => {
      saved = await api('PUT', '/estate/definitions/Contacts', { ...saved.data, fields: saved.data.fields.filter(field => field.name !== 'phoneNumber') });
      assert.equal(saved.status, 200, JSON.stringify(saved));
      assert(saved.data.removedFields.includes('phoneNumber'));
      saved = await api('PUT', '/estate/definitions/Contacts', saved.data);
      const loaded = await api('GET', '/estate/definitions/Contacts');
      assert.equal(saved.status, 200);
      assert(!loaded.data.fields.some(field => field.name === 'phoneNumber'));
    });
    await t.test('actual record creation accepts relaxed requirements and edited options', async () => {
      const created = await api('POST', '/form/add', { moduleId: legacy._id, fullName: 'New configurable person', campaign: 'CUSTOM' });
      assert.equal(created.status, 200, JSON.stringify(created));
      assert.equal(created.data.data.campaign, 'CUSTOM');
      assert.equal(created.data.data.email, undefined);
      const invalid = await api('POST', '/form/add', { moduleId: legacy._id, fullName: 'Invalid choice', campaign: 'Referral' });
      assert.equal(invalid.status, 400);
      assert.equal(invalid.data.field, 'campaign');
      assert.deepEqual(await Contact.findById(original._id).lean(), originalRecord);
    });
    await t.test('user labels, optional phone and ordering follow administrator configuration', async () => {
      const definition = await getDefinition('Users');
      const fields = definition.fields.map(field => ({ ...field, required: field.name === 'phoneNumber', label: { en: field.name, fa: field.name, tr: field.name } })).reverse();
      const savedUsers = await api('PUT', '/estate/definitions/Users', { ...definition, fields });
      assert.equal(savedUsers.status, 200, JSON.stringify(savedUsers));
      const loaded = await getDefinition('Users');
      assert.equal(loaded.fields.find(field => field.name === 'phoneNumber').required, true);
      assert.equal(loaded.fields.find(field => field.name === 'username').label.en, 'username');
      assert.deepEqual(loaded.fields.map(field => field.name), fields.map(field => field.name));
      assert.equal(await FormDefinition.countDocuments(), 2);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    assert(dbName.startsWith('crm_unlocked_forms_test_'));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
});
