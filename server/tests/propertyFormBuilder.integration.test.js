const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

// Every Form Builder change to the Properties form must reach the actual
// property API: deleted, disabled and optional fields, edited options, new
// custom fields and ordering — while existing records stay intact.
test('Form Builder changes control property create and edit', { skip: process.env.FORM_BUILDER_INTEGRATION !== '1' }, async t => {
  const dbName = 'crm_property_form_builder_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    assert(mongoose.connection.name.startsWith('crm_property_form_builder_test_'));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const User = require('../model/schema/user');
  const { Property } = require('../model/schema/property');
  const admin = await User.create({ username: 'pfb-admin@example.test', password: 'unused', role: 'admin' });
  const user = await User.create({ username: 'pfb-user@example.test', password: 'unused', role: 'user' });
  const app = express(); app.use(express.json());
  app.use('/api/estate', require('../controllers/estate/_routes'));
  app.use(require('../middelwares/securityHeaders').errorHandler);
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const api = async (method, route, body, actor = admin) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/estate${route}`, { method,
      headers: { 'Content-Type': 'application/json', Authorization: jwt.sign({ userId: actor._id, sv: 0 }, jwtSecret, { expiresIn: '5m' }) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  const label = (en, fa = en, tr = en) => ({ en, fa, tr });
  const load = async () => (await api('GET', '/definitions/Properties')).data;
  const save = async edit => {
    const current = await load();
    const result = await api('PUT', '/definitions/Properties', { ...current, fields: edit(current.fields) });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    return result.data;
  };
  const names = definition => definition.fields.map(field => field.name);
  const base = { title: 'Base flat', category: 'RESIDENTIAL', subtype: 'APARTMENT', transactionType: 'SALE',
    price: { amount: 100, currency: 'TRY' }, area: { value: 90, type: 'NET' }, sale: { status: 'AVAILABLE' } };

  const existing = await api('POST', '/Properties', base);
  assert.equal(existing.status, 201, JSON.stringify(existing.data));

  await t.test('the default definition still enforces built-in required fields', async () => {
    const missing = await api('POST', '/Properties', { ...base, price: { currency: 'TRY' } });
    assert.equal(missing.status, 400); assert.equal(missing.data.field, 'price.amount');
  });

  await t.test('deleted system fields are no longer required, stay removed and keep stored values', async () => {
    const saved = await save(fields => fields.filter(field => !['price.amount', 'area.value', 'buildingAge'].includes(field.name)));
    for (const name of ['price.amount', 'area.value', 'buildingAge']) assert(!names(saved).includes(name), name);
    assert(saved.removedFields.includes('price.amount'));
    const created = await api('POST', '/Properties', { ...base, title: 'No price', price: { currency: 'USD' }, area: { type: 'NET' } });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    // A later unrelated save must not resurrect removed fields.
    const again = await save(fields => fields);
    assert(!names(again).includes('price.amount'));
    const kept = await Property.findById(existing.data._id).lean();
    assert.equal(kept.price.amount, 100); assert.equal(kept.area.value, 90);
  });

  await t.test('disabled and optional fields are not enforced; re-required fields are', async () => {
    await save(fields => fields.map(field => field.name === 'price.currency' ? { ...field, enabled: false }
      : field.name === 'subtype' ? { ...field, required: false } : field));
    const created = await api('POST', '/Properties', { ...base, title: 'No subtype', subtype: '', price: {} });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    await save(fields => fields.map(field => field.name === 'subtype' ? { ...field, required: true } : field));
    const rejected = await api('POST', '/Properties', { ...base, title: 'Missing subtype', subtype: '' });
    assert.equal(rejected.status, 400); assert.equal(rejected.data.field, 'subtype');
  });

  await t.test('added and deleted options apply to the property API', async () => {
    const saved = await save(fields => fields.map(field => field.name === 'subtype'
      ? { ...field, options: [...field.options.filter(option => option.value !== 'VILLA'), { value: 'LAND', label: label('Land', 'زمین', 'Arsa') }] }
      : field.name === 'occupancyStatus' ? { ...field, options: [...field.options, { value: 'UNDER_RENOVATION', label: label('Renovation', 'در حال بازسازی', 'Tadilatta') }] } : field));
    assert(saved.fields.find(field => field.name === 'subtype').options.some(option => option.value === 'LAND'));
    const land = await api('POST', '/Properties', { ...base, title: 'Plot', subtype: 'LAND', occupancyStatus: 'UNDER_RENOVATION' });
    assert.equal(land.status, 201, JSON.stringify(land.data));
    assert.equal((await Property.findById(land.data._id).lean()).subtype, 'LAND');
    const villa = await api('POST', '/Properties', { ...base, title: 'Villa', subtype: 'VILLA' });
    assert.equal(villa.status, 400); assert.equal(villa.data.field, 'subtype');
    // Built-in category pairing still applies to built-in subtypes.
    const mismatch = await api('POST', '/Properties', { ...base, title: 'Shop flat', subtype: 'SHOP' });
    assert.equal(mismatch.status, 400); assert.equal(mismatch.data.field, 'subtype');
  });

  await t.test('custom fields validate, persist and can be deleted again', async () => {
    const saved = await save(fields => [...fields, { name: 'field_view', kind: 'CUSTOM_FIELD', type: 'select', required: true, enabled: true,
      label: label('View', 'چشم‌انداز', 'Manzara'), options: [{ value: 'SEA', label: label('Sea', 'دریا', 'Deniz') }] }]);
    assert(names(saved).includes('field_view'));
    assert.equal((await api('POST', '/Properties', { ...base, title: 'No view' })).status, 400);
    const sea = await api('POST', '/Properties', { ...base, title: 'Sea view', customFields: { field_view: 'SEA' } });
    assert.equal(sea.status, 201, JSON.stringify(sea.data));
    const removed = await save(fields => fields.filter(field => field.name !== 'field_view'));
    assert(!names(removed).includes('field_view'));
    assert.equal((await api('POST', '/Properties', { ...base, title: 'After removal' })).status, 201);
    assert.equal((await Property.findById(sea.data._id).lean()).customFields.field_view, 'SEA');
  });

  await t.test('editing an existing record follows the current definition', async () => {
    const edited = await api('PUT', `/Properties/${existing.data._id}`, { title: 'Renamed', subtype: 'LAND' });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    assert.equal((await Property.findById(existing.data._id).lean()).subtype, 'LAND');
    assert.equal((await Property.findById(existing.data._id).lean()).price.amount, 100);
    assert.equal((await Property.findById(existing.data._id).lean()).area.value, 90);
  });

  await t.test('removed transaction fields do not erase an existing rental when editing', async () => {
    const buyer = await require('../model/schema/partnerCustomer').create({ customerType: 'INDIVIDUAL', fullName: 'Tenant', createBy: admin._id });
    const rental = await Property.create({ ...base, title: 'Existing rental', transactionType: 'RENT', sale: { status: 'RENTED', buyerType: 'PARTNER_CUSTOMER', partnerCustomer: buyer._id }, createBy: admin._id });
    await save(fields => fields.filter(field => !['transactionType', 'sale.status', 'sale.buyerType', 'sale.partnerCustomer'].includes(field.name)));
    const edited = await api('PUT', `/Properties/${rental._id}`, { title: 'Rental renamed' });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    const kept = await Property.findById(rental._id).lean();
    assert.equal(kept.transactionType, 'RENT'); assert.equal(kept.sale.status, 'RENTED');
    assert.equal(String(kept.sale.partnerCustomer), String(buyer._id));
  });

  await t.test('field order is saved and only administrators may change the form', async () => {
    const saved = await save(fields => [fields.find(field => field.name === 'description'), ...fields.filter(field => field.name !== 'description')]);
    assert.equal(saved.fields[0].name, 'description');
    const current = await load();
    assert.equal((await api('PUT', '/definitions/Properties', { ...current, fields: [] }, user)).status, 403);
  });
});
