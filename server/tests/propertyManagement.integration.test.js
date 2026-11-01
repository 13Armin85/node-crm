const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

test('property layouts, assigned agents, reusable owners and lead relationships persist through the API', { skip: process.env.ESTATE_INTEGRATION !== '1' }, async t => {
  const dbName = 'crm_property_management_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    assert(dbName.startsWith('crm_property_management_test_'));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const User = require('../model/schema/user');
  const { Property } = require('../model/schema/property');
  const { Contact, initializeContactSchema } = require('../model/schema/contact');
  const { Lead, initializeLeadSchema } = require('../model/schema/lead');
  const CustomField = require('../model/schema/customField');
  const FormDefinition = require('../model/schema/formDefinition');
  const { defaults } = require('../services/formDefinitions');
  await CustomField.create({ moduleName: 'Contacts', fields: require('../db/contactFields').contactFields });
  const leadModule = await CustomField.create({ moduleName: 'Leads', fields: require('../db/leadFields').leadFields });
  await initializeContactSchema(); await initializeLeadSchema();
  const admin = await User.create({ username: 'property-admin', password: 'unused', firstName: 'Admin', role: 'admin' });
  const agent = await User.create({ username: 'property-agent', password: 'unused', firstName: 'Property', lastName: 'Agent', role: 'user' });
  const app = express(); app.use(express.json());
  app.use('/api/estate', require('../controllers/estate/_routes'));
  app.use('/api/form', require('../controllers/form/_routes'));
  app.use('/api/lead', require('../controllers/lead/_routes'));
  app.use('/api/contact', require('../controllers/contact/_routes'));
  app.use('/api/property', require('../controllers/property/_routes'));
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const api = async (method, route, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`, { method,
      headers: { 'Content-Type': 'application/json', Authorization: jwt.sign({ userId: admin._id }, jwtSecret, { expiresIn: '5m' }) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };

  await FormDefinition.create({ moduleName: 'Properties', fields: defaults.Properties.filter(field => !['propertyAgent', 'propertyOwner'].includes(field.name)).map(field =>
    field.name === 'bedroom' ? { ...field, type: 'number', options: [] }
      : field.name === 'district' ? { ...field, type: 'select', options: [{ value: 'şişli', label: { en: 'Sisli', fa: 'شیشلی', tr: 'Şişli' } }] } : field) });
  const { importLegacyDistricts } = require('../services/districtCatalog');
  await importLegacyDistricts(); await importLegacyDistricts();
  const catalog = await api('GET', '/estate/districts');
  assert.equal(catalog.status, 200); assert.equal(catalog.data.total, 1);
  const districtOption = (await api('GET', '/estate/districts/options?id=' + encodeURIComponent('Şişli'))).data[0];
  assert.equal(districtOption.value, 'şişli'); assert.equal(districtOption.label.fa, 'شیشلی');
  const district = await api('POST', '/estate/districts', { name: 'New property district' });
  assert.equal(district.status, 201);
  assert.equal((await api('POST', '/estate/districts', { name: ' new property district ' })).status, 409);
  assert.equal((await api('POST', '/estate/districts', { name: String(admin._id) })).status, 400);
  assert.equal((await api('GET', '/estate/districts/options?q=New')).data[0].value, district.data.name);
  const definition = (await api('GET', '/estate/definitions/Properties')).data;
  assert.equal(definition.fields.find(field => field.name === 'bedroom').type, 'select');
  assert(definition.fields.find(field => field.name === 'bedroom').options.some(option => option.value === '1+4'));
  assert.equal(definition.fields.find(field => field.name === 'propertyAgent').relation, 'Users');
  assert.equal(definition.fields.find(field => field.name === 'propertyOwner').relation, 'Contacts');
  assert.equal(definition.fields.find(field => field.name === 'district').catalog, 'districts');
  assert.equal(definition.fields.find(field => field.name === 'district').options, undefined);
  assert(!(await api('GET', '/estate/definitions')).data.includes('Districts'));
  await FormDefinition.create({ moduleName: 'Leads', fields: defaults.Leads.map(field =>
    field.name === 'listedFor' ? { ...field, label: { en: 'Listed For', fa: 'نوع درخواست', tr: 'Listed For' } }
      : field.name === 'associatedListing' ? { ...field, external: true } : field) });
  const leadDefinition = (await api('GET', '/estate/definitions/Leads')).data;
  const transactionField = leadDefinition.fields.find(field => field.name === 'listedFor');
  assert.deepEqual(transactionField.options.map(option => option.label.fa), ['اجاره', 'فروش']);
  assert.deepEqual(transactionField.options.map(option => option.value), ['Rent', 'Buy']);
  assert.equal(transactionField.label.fa, 'نوع درخواست');
  assert.equal(leadDefinition.fields.find(field => field.name === 'associatedListing').external, false);

  const invalidOwner = await api('POST', '/estate/Properties/owners', { fullName: 'Incomplete' });
  assert.equal(invalidOwner.status, 400); assert.equal(invalidOwner.data.field, 'email');
  const ownerPayload = { fullName: 'Reusable Owner', email: 'owner@example.test', phoneNumber: '+90 (555) 123-4567' };
  const owner = await api('POST', '/estate/Properties/owners', ownerPayload);
  assert.equal(owner.status, 201, JSON.stringify(owner));
  assert.equal(owner.data.fullName, ownerPayload.fullName);
  assert.equal((await api('POST', '/estate/Properties/owners', ownerPayload)).status, 409);
  assert.equal(await Contact.countDocuments({ deleted: false }), 1);
  for (const q of ['Reusable', '5551234567']) {
    const options = await api('GET', '/estate/Contacts/options?q=' + q);
    assert.equal(options.status, 200); assert.equal(options.data[0].value, owner.data._id);
    assert(options.data[0].label.includes(ownerPayload.phoneNumber));
  }
  assert((await api('GET', '/contact')).data.some(contact => contact._id === owner.data._id));
  const payload = { title: 'Bedroom layout test', category: 'RESIDENTIAL', subtype: 'APARTMENT', transactionType: 'SALE',
    price: { amount: 100000, currency: 'TRY' }, area: { value: 90, type: 'NET' }, bedroom: '1+4', floor: '3',
    propertyAgent: String(agent._id), propertyOwner: owner.data._id, district: district.data.name };
  const property = await api('POST', '/estate/Properties', payload);
  assert.equal(property.status, 201, JSON.stringify(property));
  assert.equal(property.data.bedroom, '1+4'); assert.equal(property.data.propertyOwner, owner.data._id);
  assert.equal(property.data.district, district.data.name);
  assert.equal((await api('DELETE', '/estate/districts/' + district.data._id)).status, 409);
  const residence = await api('POST', '/estate/Residences', { name: 'New Inline Residence', district: district.data.name });
  assert.equal(residence.status, 201, JSON.stringify(residence));
  assert.equal((await api('GET', '/estate/Residences/options?id=' + residence.data._id)).data[0].value, residence.data._id);
  const withResidence = await api('PUT', '/estate/Properties/' + property.data._id, { isInsideResidence: true, residence: residence.data._id });
  assert.equal(withResidence.status, 200); assert.equal(withResidence.data.residence, residence.data._id);
  const unusedDistrict = await api('POST', '/estate/districts', { name: 'Unused area' });
  assert.equal((await api('DELETE', '/estate/districts/' + unusedDistrict.data._id)).status, 200);
  assert.equal((await api('GET', '/estate/districts/options?q=Unused')).data.length, 0);
  await importLegacyDistricts();
  assert.equal((await api('GET', '/estate/districts/options?q=Unused')).data.length, 0);
  const persisted = await Property.findById(property.data._id).lean();
  assert.equal(persisted.bedroom, '1+4'); assert.equal(String(persisted.propertyAgent), String(agent._id));
  const list = await api('GET', '/estate/Properties');
  assert.equal(list.data.items[0].floor, '3'); assert.equal(list.data.items[0].propertyAgent.firstName, 'Property');
  assert.equal(list.data.items[0].propertyOwner.fullName, ownerPayload.fullName);
  const fetched = await api('GET', '/estate/Properties/' + property.data._id);
  assert.equal(fetched.data.propertyAgent, String(agent._id)); assert.equal(fetched.data.bedroom, '1+4');
  for (const [field, value] of [['bedroom', '1-4'], ['propertyAgent', 'bad-id'], ['propertyOwner', String(new mongoose.Types.ObjectId())]]) {
    const invalid = await api('PUT', '/estate/Properties/' + property.data._id, { [field]: value });
    assert.equal(invalid.status, 400); assert.equal(invalid.data.field, field);
  }
  const changed = await api('PUT', '/estate/Properties/' + property.data._id, { propertyAgent: String(admin._id), bedroom: '4+2' });
  assert.equal(changed.status, 200); assert.equal(changed.data.propertyAgent, String(admin._id)); assert.equal(changed.data.bedroom, '4+2');
  const second = await api('POST', '/property/add', { ...payload, title: 'Same owner, another property' });
  assert.equal(second.status, 200, JSON.stringify(second)); assert.equal(second.data.propertyOwner, owner.data._id);
  assert.equal(await Contact.countDocuments({ deleted: false }), 1);
  const cleared = await api('PUT', '/estate/Properties/' + second.data._id, { propertyAgent: null, propertyOwner: null });
  assert.equal(cleared.status, 200); assert.equal(cleared.data.propertyAgent, null); assert.equal(cleared.data.propertyOwner, null);

  const lead = await api('POST', '/form/add', { moduleId: String(leadModule._id), leadName: 'Interested Customer',
    leadMobile: '+905559876543', listedFor: 'Rent', associatedListing: property.data._id, assignUser: String(agent._id) });
  assert.equal(lead.status, 200, JSON.stringify(lead));
  const leads = await api('GET', '/lead');
  const row = leads.data.find(item => item._id === lead.data.data._id);
  assert.equal(row.leadName, 'Interested Customer'); assert.equal(row.assignUser.firstName, 'Property');
  assert.equal(row.associatedListing.title, payload.title); assert.equal(row.leadMobile, '+905559876543');
  assert.equal(row.listedFor, 'Rent'); assert(Number.isFinite(Date.parse(row.createdDate)));
  assert((await Property.findById(property.data._id)).relatedLeads.some(id => String(id) === row._id));
  for (const value of ['invalid', String(new mongoose.Types.ObjectId())]) {
    const rejected = await api('PUT', '/form/edit/' + row._id, { moduleId: String(leadModule._id), associatedListing: value });
    assert.equal(rejected.status, 400); assert.equal(rejected.data.field, 'associatedListing');
    assert.equal(String((await Lead.findById(row._id)).associatedListing), property.data._id);
  }
  const moved = await api('PUT', '/form/edit/' + row._id, { moduleId: String(leadModule._id), associatedListing: second.data._id, listedFor: 'Buy' });
  assert.equal(moved.status, 200, JSON.stringify(moved));
  assert.equal((await Lead.findById(row._id).lean()).listedFor, 'Buy');
  assert(!(await Property.findById(property.data._id)).relatedLeads.some(id => String(id) === row._id));
  assert((await Property.findById(second.data._id)).relatedLeads.some(id => String(id) === row._id));
  const unlinked = await api('PUT', '/form/edit/' + row._id, { moduleId: String(leadModule._id), associatedListing: null });
  assert.equal(unlinked.status, 200); assert.equal((await Lead.findById(row._id)).associatedListing, null);
  assert(!(await Property.findById(second.data._id)).relatedLeads.some(id => String(id) === row._id));
  await Lead.create({ createBy: admin._id });
  const sparse = (await api('GET', '/lead')).data.find(item => item._id !== row._id);
  assert.equal(sparse.associatedListing, null); assert.equal(sparse.assignUser, null);
});
