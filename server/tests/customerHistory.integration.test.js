const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

test('customer history shares past and future notes, paginates without copies, and synchronizes request types', { skip: process.env.ESTATE_INTEGRATION !== '1' }, async t => {
  const dbName = 'crm_customer_history_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    assert(dbName.startsWith('crm_customer_history_test_'));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  });
  const User = require('../model/schema/user');
  const CustomField = require('../model/schema/customField');
  const { Contact, initializeContactSchema } = require('../model/schema/contact');
  const { Lead, initializeLeadSchema } = require('../model/schema/lead');
  const Opportunity = require('../model/schema/opprtunity');
  const Note = require('../model/schema/recordNote');
  const Definition = require('../model/schema/formDefinition');
  await CustomField.create({ moduleName: 'Contacts', fields: require('../db/contactFields').contactFields });
  await CustomField.create({ moduleName: 'Leads', fields: require('../db/leadFields').leadFields });
  await initializeContactSchema(); await initializeLeadSchema(); await Note.init(); await Opportunity.init();
  const actor = await User.create({ username: 'history@example.test', password: 'unused', role: 'admin' });
  const other = await User.create({ username: 'other@example.test', password: 'unused', role: 'user', moduleVisibility: { Contacts: true, Opportunities: true } });
  const app = express(); app.use(express.json());
  app.use('/api/record-workspace', require('../controllers/recordWorkspace'));
  app.use('/api/contact', require('../controllers/contact/_routes'));
  app.use('/api/lead', require('../controllers/lead/_routes'));
  app.use('/api/estate', require('../controllers/estate/_routes'));
  app.use('/api/form', require('../controllers/form/_routes'));
  app.use('/api/opportunity', require('../controllers/opportunities/_routes'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ code: err.code || 'serverError' }));
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const api = async (method, route, body, user = actor) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api' + route, {
      method, headers: { Authorization: jwt.sign({ userId: user._id, sv: user.authVersion || 0 }, require('../config/auth').jwtSecret, { expiresIn: '5m' }), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    return { status: response.status, data };
  };
  const path = (module, id) => '/record-workspace/' + module + '/' + id + '/notes';
  const lead = await Lead.create({ leadName: 'History Customer', leadEmail: 'customer@example.test', leadMobile: '+905551111111', listedFor: 'Buy', assignUser: actor._id, createBy: actor._id });
  const first = await api('POST', path('Leads', lead._id), { text: 'Before conversion', clientId: 'before' });
  assert.equal(first.status, 201);
  const conversion = await api('POST', '/lead/convert/' + lead._id, { mode: 'contactAndOpportunity' });
  assert.equal(conversion.status, 200, JSON.stringify(conversion));
  const { contactId, opportunityId } = conversion.data;
  for (const [module, id] of [['Contacts', contactId], ['Opportunities', opportunityId], ['Leads', lead._id]]) {
    const result = await api('GET', path(module, id));
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.deepEqual(result.data.items.map(note => note.text), ['Before conversion']);
  }
  assert.equal((await Contact.findById(contactId)).listedFor, 'Buy');
  assert.equal((await Opportunity.findById(opportunityId)).listedFor, 'Buy');
  assert.equal((await api('POST', path('Leads', lead._id), { text: 'Archived write', clientId: 'archive' })).status, 404);
  await api('POST', path('Contacts', contactId), { text: 'After conversion', clientId: 'after' });
  const reply = await api('POST', path('Opportunities', opportunityId), { text: 'Opportunity reply', clientId: 'reply' });
  assert.equal(reply.status, 201);
  await api('POST', path('Opportunities', opportunityId), { text: 'Retry', clientId: 'reply' });
  assert.equal((await api('GET', path('Contacts', contactId))).data.items.length, 3);
  const contactInfo = (await api('GET', '/record-workspace/Contacts/' + contactId)).data;
  const edit = await api('PUT', '/form/edit/' + contactId, { moduleId: contactInfo.legacyModuleId, listedFor: 'Rent' });
  assert.equal(edit.status, 200, JSON.stringify(edit));
  assert.equal((await Lead.findById(lead._id)).listedFor, 'Rent');
  assert.equal((await Opportunity.findById(opportunityId)).listedFor, 'Rent');
  const edited = await api('PUT', '/opportunity/edit/' + opportunityId, { listedFor: 'Buy' });
  assert.equal(edited.status, 200, JSON.stringify(edited));
  assert.equal((await Contact.findById(contactId)).listedFor, 'Buy');
  assert.equal((await Lead.findById(lead._id)).listedFor, 'Buy');
  const anotherOpportunity = await Opportunity.create({ opportunityName: 'Second request', listedFor: '', contact: contactId, createBy: actor._id });
  assert.equal(anotherOpportunity.listedFor, 'Buy');
  assert.equal((await Contact.findById(contactId)).listedFor, 'Buy');
  assert.equal((await api('PUT', '/opportunity/edit/' + opportunityId, { listedFor: 'INVALID' })).status, 400);
  const contactNote = await Note.findOne({ module: 'Contacts', record: contactId });
  await Note.create({ module: 'Opportunities', record: opportunityId, author: actor._id, text: contactNote.text,
    clientId: 'contact-transfer-' + contactNote._id, createdAt: contactNote.createdAt });
  const isolated = await Contact.create({ fullName: 'Unrelated Customer', email: 'unrelated@example.test', phoneNumber: '+905552222222', createBy: actor._id });
  await api('POST', path('Contacts', isolated._id), { text: 'Separate history', clientId: 'separate' });
  await Note.insertMany(Array.from({ length: 53 }, (_, index) => ({ module: index % 2 ? 'Contacts' : 'Opportunities', record: index % 2 ? contactId : opportunityId,
    author: actor._id, text: 'History ' + index, clientId: 'history-' + index })));
  const page = await api('GET', path('Contacts', contactId));
  assert.equal(page.data.items.length, 50); assert(page.data.before);
  const older = await api('GET', path('Opportunities', opportunityId) + '?before=' + page.data.before);
  assert.equal(older.data.items.length, 6);
  const items = [...older.data.items, ...page.data.items];
  assert.equal(new Set(items.map(note => note._id)).size, 56);
  assert.equal(items.filter(note => note.text === 'After conversion').length, 1);
  assert(!items.some(note => note.text === 'Separate history'));
  assert.equal((await api('GET', path('Contacts', contactId) + '?before=' + new mongoose.Types.ObjectId())).status, 400);
  assert.equal((await api('GET', path('Leads', lead._id), null, other)).status, 404);
  const userNotes = await api('GET', path('Contacts', contactId), null, other);
  assert.equal(userNotes.status, 200);
  const userOlder = await api('GET', path('Contacts', contactId) + '?before=' + userNotes.data.before, null, other);
  assert(![...userNotes.data.items, ...userOlder.data.items].some(note => note.text === 'Before conversion'));

  // Existing contact -> opportunity conversion remains repeatable and reads live notes.
  await Contact.updateOne({ _id: isolated._id }, { $set: { listedFor: 'Rent' } });
  const converted = await api('POST', '/contact/to-opportunity/' + isolated._id, {});
  const retry = await api('POST', '/contact/to-opportunity/' + isolated._id, {});
  assert.equal(retry.data.opportunityId, converted.data.opportunityId);
  assert.equal((await Opportunity.findById(converted.data.opportunityId)).listedFor, 'Rent');
  await api('POST', path('Opportunities', converted.data.opportunityId), { text: 'Live response', clientId: 'live' });
  assert.deepEqual((await api('GET', path('Contacts', isolated._id))).data.items.map(note => note.text), ['Separate history', 'Live response']);
  assert.equal(await Note.countDocuments({ record: converted.data.opportunityId }), 1);

  // Suitability works both with system fields and with existing Form Builder fields.
  const propertyPayload = { title: 'Suitable Villa', category: 'RESIDENTIAL', subtype: 'VILLA', transactionType: 'SALE', price: { amount: 100, currency: 'TRY' }, area: { value: 90, type: 'NET' }, suitableFor: ['LIVING', 'INVESTMENT'] };
  const property = await api('POST', '/estate/Properties', propertyPayload);
  assert.equal(property.status, 201, JSON.stringify(property));
  assert.equal((await api('GET', '/estate/Properties?suitableFor=INVESTMENT')).data.total, 1);
  assert.equal((await api('GET', '/estate/Properties?suitableFor=CITIZENSHIP')).data.total, 0);
  assert.equal((await api('GET', '/estate/Properties?suitableFor=INVALID')).status, 400);
  const definition = (await api('GET', '/estate/definitions/Properties')).data;
  const custom = { name: 'legacySuitability', kind: 'CUSTOM_FIELD', type: 'multiselect', enabled: true,
    label: { en: 'Suitable For', fa: 'مناسب', tr: 'Uygun' }, options: [{ value: 'Citizdenship', label: { en: 'Citizenship', fa: 'شهروندی', tr: 'Vatandaşlık' } }] };
  await Definition.create({ moduleName: 'Properties', fields: [...definition.fields.filter(field => field.name !== 'suitableFor'), custom] });
  const legacyProperty = await api('POST', '/estate/Properties', { ...propertyPayload, title: 'Legacy suitable villa', customFields: { legacySuitability: ['Citizdenship'] } });
  assert.equal(legacyProperty.status, 201, JSON.stringify(legacyProperty));
  assert.equal((await api('GET', '/estate/Properties?customFields.legacySuitability=Citizdenship')).data.total, 1);
  assert(!(await api('GET', '/estate/definitions/Properties')).data.fields.some(field => field.name === 'suitableFor'));
});
