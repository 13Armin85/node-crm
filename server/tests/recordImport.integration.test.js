const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

test('record import validates complete batches, permissions, relationships and persisted values', { skip: process.env.RECORD_IMPORT_INTEGRATION !== '1', timeout: 60000 }, async t => {
  const dbName = 'crm_import_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  mongoose.set('strictQuery', false);
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName); assert(dbName.startsWith('crm_import_test_'));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  });
  const app = express(); app.use(express.json()); app.use('/api', require('../controllers/route'));
  app.use(require('../middelwares/securityHeaders').errorHandler);
  const User = require('../model/schema/user');
  const { Contact } = require('../model/schema/contact');
  const { Lead } = require('../model/schema/lead');
  Contact.schema.add({ fullName: String, email: String, phoneNumber: String });
  Lead.schema.add({ leadName: String, leadEmail: String, leadMobile: String });
  const admin = await User.create({ username: 'import-admin@example.test', password: 'test-hash', role: 'admin' });
  const regular = await User.create({ username: 'import-user@example.test', password: 'test-hash', role: 'user' });
  await require('../model/schema/customField').create({ moduleName: 'Contacts', fields: [{ name: 'score', label: 'Score', backendType: 'Number', type: 'number', fixed: false }] });
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const request = async (moduleName, rows, actor = admin, sourceRows) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/import/' + encodeURIComponent(moduleName), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: jwt.sign({ userId: actor._id }, jwtSecret, { expiresIn: '5m' }) },
      body: JSON.stringify({ rows, ...(sourceRows ? { sourceRows } : {}) }),
    });
    return { status: response.status, data: await response.json() };
  };
  const person = (name, index) => ({ fullName: name, email: `contact-${index}@example.test`, phoneNumber: `9055500000${index}`, customFields: { score: 0 } });
  await t.test('valid contacts preserve zero custom values and force authenticated ownership', async () => {
    const result = await request('Contacts', [{ ...person('Import One', 11), createBy: regular._id, deleted: true }, person('Import Two', 12)]);
    assert.equal(result.status, 201, JSON.stringify(result)); assert.deepEqual(result.data.importedRows, [2, 3]);
    const records = await Contact.find({}).lean(); assert.equal(records.length, 2);
    assert(records.every(record => String(record.createBy) === String(admin._id) && record.deleted === false && record.customFields.score === 0));
  });
  await t.test('required, invalid and duplicate rows fail before any row is inserted', async () => {
    const before = await Contact.countDocuments({});
    const invalid = await request('Contacts', [person('Valid pending', 13), { fullName: 'Missing email', phoneNumber: '90555' }], admin, [20, 42]);
    assert.equal(invalid.status, 400); assert(invalid.data.errors.some(error => error.row === 42 && error.field === 'email' && error.code === 'required'));
    assert.equal(await Contact.countDocuments({}), before);
    const duplicate = await request('Contacts', [person('Import One', 14)]);
    assert.equal(duplicate.status, 400); assert.equal(duplicate.data.errors[0].code, 'duplicate');
    const repeated = await request('Contacts', [person('Same person', 15), person('same person', 16)]);
    assert.equal(repeated.status, 400); assert.equal(repeated.data.errors[0].row, 3);
    assert.equal(await Contact.countDocuments({}), before);
    assert.equal((await request('Contacts', Array(101).fill(person('Too many', 17)))).status, 400);
  });
  await t.test('leads import independently and optional relations still enforce visibility', async () => {
    const contact = await Contact.findOne({}).lean();
    const payload = { leadName: 'Imported lead', leadEmail: 'lead@example.test', leadMobile: '+90 555 222 1111' };
    const independent = await request('Leads', [{ leadMessage: 'Independent prospect' }]);
    assert.equal(independent.status, 201, JSON.stringify(independent));
    const forbidden = await request('Leads', [{ ...payload, contact: String(contact._id) }], regular);
    assert.equal(forbidden.status, 400); assert.equal(forbidden.data.errors[0].code, 'relationNotFound');
    const result = await request('Leads', [{ ...payload, contact: String(contact._id) }]);
    assert.equal(result.status, 201, JSON.stringify(result));
    const lead = await Lead.findOne({ leadEmail: payload.leadEmail }).lean();
    assert((await Contact.findById(contact._id).lean()).relatedLeads.some(id => String(id) === String(lead._id)));
  });
  await t.test('residences, partners, opportunities and invoice values persist through the same importer', async () => {
    for (const [name, body] of [
      ['Properties', { title: 'Imported Property', category: 'RESIDENTIAL', subtype: 'VILLA', transactionType: 'SALE', price: { amount: 1500000.5, currency: 'TRY' }, area: { value: 120, type: 'NET' } }],
      ['Residences', { name: 'Import Residence', city: 'Istanbul', maintenanceFee: { amount: 0, currency: 'USD' } }],
      ['Partner Customers', { customerType: 'COMPANY', companyName: 'Imported company', phone: '+90 555 333 4444' }],
      ['Opportunities', { opportunityName: 'Imported opportunity', opportunityAmount: 0 }],
      ['Invoices', { title: 'Imported invoice', invoiceDate: '2026-10-18', currency: 'USD', items: [{ productName: 'Service', qty: 2, rate: 10.5, discount: 0, discountType: 'none' }], ptax: '20' }],
      ['Quotes', { description: 'Imported quote', amount: 0, installments: [{ no: 1, months: 'January', per: 10, total: 10.5 }] }],
      ['Opportunity Project', { name: 'Imported project', requirement: 'Imported requirement' }],
    ]) {
      const result = await request(name, [body]); assert.equal(result.status, 201, name + JSON.stringify(result));
    }
    const invoice = await require('../model/schema/invoices').findOne({}).lean();
    assert.equal(Number(invoice.total), 21); assert.equal(Number(invoice.grandTotal), 25.2); assert.equal(invoice.items[0].rate, 10.5);
    assert.equal((await require('../model/schema/residence').findOne({}).lean()).maintenanceFee.amount, 0);
    assert.equal((await require('../model/schema/property').Property.findOne({}).lean()).price.amount, 1500000.5);
    const quote = await require('../model/schema/quotes').findOne({}).lean(); assert.equal(quote.amount, 0); assert.equal(quote.installments[0].total, 10.5);
    assert.equal((await require('../model/schema/opportunityproject').findOne({}).lean()).requirement, 'Imported requirement');
  });
  await t.test('custom modules work while staff accounts and unsupported system modules stay protected', async () => {
    await require('../model/schema/customField').create({ moduleName: 'ImportedCustom', fields: [{ name: 'name', label: 'Name', backendType: 'String', type: 'text', validation: [{ require: true }] }] });
    const result = await request('ImportedCustom', [{ name: 'Custom record' }]); assert.equal(result.status, 201, JSON.stringify(result));
    assert.equal(await mongoose.model('ImportedCustom').countDocuments({}), 1);
    for (const name of ['Users', 'User', 'Tasks', 'CustomField', 'ModuleActiveDeactive', 'constructor', 'toString']) assert((await request(name, [{ username: 'forged@example.test' }])).status >= 400);
    assert.equal(await User.countDocuments({}), 2);
  });
});
