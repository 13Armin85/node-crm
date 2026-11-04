const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

test('configured residence multiselects and equivalent property room plans persist after creation and editing', { skip: process.env.ESTATE_INTEGRATION !== '1' }, async t => {
  const dbName = 'crm_inline_details_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName); assert(dbName.startsWith('crm_inline_details_test_'));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  });
  require('../node_modules/nodemailer').createTransport = () => ({ sendMail: async () => ({ accepted: [] }) });
  const User = require('../model/schema/user');
  const actor = await User.create({ username: 'inline-detail-reviewer', password: 'unused', role: 'admin' });
  const FormDefinition = require('../model/schema/formDefinition');
  const { defaults } = require('../services/formDefinitions');
  const custom = { name: 'reference', kind: 'CUSTOM_FIELD', type: 'text', label: { en: 'Reference', fa: 'مرجع', tr: 'Referans' }, enabled: true };
  await FormDefinition.create({ moduleName: 'Residences', fields: [...defaults.Residences.map(field => field.name === 'constructionStatus'
    ? { ...field, type: 'multiselect', options: [...field.options, { value: 'Resale', label: { en: 'Resale', fa: 'فروش مجدد', tr: 'İkinci el' } }] } : field), custom] });
  await FormDefinition.create({ moduleName: 'Properties', removedFields: ['area.type'], fields: [...defaults.Properties.filter(field => field.name !== 'area.type').map(field => field.name === 'bedroom'
    ? { ...field, options: [{ value: '1+2', label: { en: '1+2', fa: '1+2', tr: '1+2' } }] } : field), custom] });
  const app = express(); app.use(express.json()); app.use('/api/estate', require('../controllers/estate/_routes'));
  app.use('/api/form', require('../controllers/form/_routes'));
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const api = async (method, route, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/estate${route}`, { method,
      headers: { 'Content-Type': 'application/json', Authorization: jwt.sign({ userId: actor._id }, jwtSecret, { expiresIn: '5m' }) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  const residence = await api('POST', '/Residences', { name: 'Configured Residence', constructionStatus: ['READY', 'Resale'], unitTypes: ['1+2', '2+1'], customFields: { reference: 'Keep all project data' } });
  assert.equal(residence.status, 201, JSON.stringify(residence));
  assert.deepEqual(residence.data.constructionStatus, ['READY', 'Resale']); assert.deepEqual(residence.data.unitTypes, ['2+1']);
  const editedResidence = await api('PUT', '/Residences/' + residence.data._id, { name: 'Updated Residence' });
  assert.equal(editedResidence.status, 200, JSON.stringify(editedResidence));
  assert.deepEqual(editedResidence.data.constructionStatus, ['READY', 'Resale']);
  assert.equal(editedResidence.data.customFields.reference, 'Keep all project data');
  assert.equal((await api('POST', '/Residences', { name: 'Invalid choices', constructionStatus: ['UNKNOWN'] })).status, 400);
  const legacyResidence = await require('../model/schema/residence').create({ name: 'Legacy scalar status', constructionStatus: 'READY', createBy: actor._id });
  const upgraded = await api('PUT', '/Residences/' + legacyResidence._id, { name: 'Renamed legacy residence' });
  assert.equal(upgraded.status, 200, JSON.stringify(upgraded)); assert.deepEqual(upgraded.data.constructionStatus, ['READY']);
  const property = await api('POST', '/Properties', { title: 'Equivalent Rooms', category: 'RESIDENTIAL', subtype: 'APARTMENT', transactionType: 'SALE', price: { amount: 100, currency: 'TRY' }, area: { value: 90 }, bedroom: '۲ + ۱', customFields: { reference: 'Preserve property data' } });
  assert.equal(property.status, 201, JSON.stringify(property)); assert.equal(property.data.bedroom, '2+1'); assert.equal(property.data.area.type, 'NET');
  for (const bedroom of ['1+2', '2+1']) {
    const edited = await api('PUT', '/Properties/' + property.data._id, { bedroom });
    assert.equal(edited.status, 200, JSON.stringify(edited)); assert.equal(edited.data.bedroom, '2+1');
    assert.equal(edited.data.customFields.reference, 'Preserve property data');
    assert.equal((await api('GET', '/Properties?bedroom=' + encodeURIComponent(bedroom))).data.total, 1);
  }
  assert.equal((await api('PUT', '/Properties/' + property.data._id, { bedroom: '5+5' })).status, 400);
  const metadata = await require('../model/schema/customField').create({ moduleName: 'Leads', fields: require('../db/leadFields').leadFields });
  const { Lead, initializeLeadSchema } = require('../model/schema/lead'); await initializeLeadSchema();
  const lead = await Lead.create({ leadName: 'Before', associatedListing: property.data._id, assignUser: actor._id, createBy: actor._id });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/form/edit/${lead._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: jwt.sign({ userId: actor._id }, jwtSecret, { expiresIn: '5m' }) }, body: JSON.stringify({ moduleId: metadata._id, leadName: 'After' }) });
  assert.equal(response.status, 200, await response.text());
  const persistedLead = await Lead.findById(lead._id).lean(); assert.equal(persistedLead.leadName, 'After'); assert.equal(String(persistedLead.associatedListing), property.data._id); assert.equal(String(persistedLead.assignUser), String(actor._id));
});
