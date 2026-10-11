const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwtSecret } = require('../config/auth');
require('dotenv').config();
const enabled = process.env.ESTATE_INTEGRATION === '1';
test('authenticated estate CRUD, role permissions, definitions, relations and files', { skip: !enabled }, async () => {
  const dbName = `crm_estate_test_${crypto.randomUUID().replace(/-/g, '')}`;
  let server;
  await mongoose.connect(process.env.TEST_MONGO_URL || process.env.DB_URL || 'mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  try {
    const app = express(); app.use(express.json()); app.use('/api', require('../controllers/route'));
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const User = require('../model/schema/user');
    const admin = await User.create({ username: 'integration-admin', password: 'unused-test-hash', role: 'admin' });
    const user = await User.create({ username: 'integration-user', password: 'unused-test-hash', role: 'user', moduleVisibility: Object.fromEntries([...require('../services/moduleVisibility').defaultHidden].map(name => [name, true])) });
    const token = actor => jwt.sign({ userId: actor._id }, jwtSecret, { expiresIn: '5m' });
    const api = async (method, route, body, actor = admin) => {
      const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: token(actor) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    assert.equal((await api('GET', '/estate/Properties', null, null)).status, 401);
    assert.equal((await api('GET', '/estate/Properties', null, user)).status, 200);
    const residencePayload = { name: 'Integration Residence', description: 'Full project', developer: 'Builder', country: 'Turkey', city: 'Istanbul', district: 'District', neighborhood: 'Neighborhood', address: 'Street 1', postalCode: '34000', mapUrl: 'https://example.com/map', constructionStatus: 'READY', constructionYear: 2020, buildingAge: 'AGE_5_10', completionDate: '2020-05-01', blockCount: 2, floorCount: 10, unitCount: 100, totalArea: 2500, unitTypes: ['1+1', '1+3'], amenities: ['POOL', 'SECURITY'], heatingType: 'Central', parkingCapacity: 100, managementCompany: 'Management', contactPerson: 'Manager', phone: '+905551112233', email: 'management@example.com', website: 'https://example.com', maintenanceFee: { amount: 50, currency: 'USD' } };
    const residence = await api('POST', '/estate/Residences', residencePayload);
    assert.equal(residence.status, 201, JSON.stringify(residence));
    const partner = await api('POST', '/estate/Partner%20Customers', { customerType: 'COMPANY', companyName: 'Integration Company', phone: '+905551112233', status: 'ACTIVE', createBy: user._id });
    assert.equal(partner.status, 201, JSON.stringify(partner)); assert.equal(partner.data.createBy, String(admin._id));
    const { defaults } = require('../services/formDefinitions');
    const FormDefinition = require('../model/schema/formDefinition');
    for (const [key, value] of Object.entries(residencePayload)) {
      if (key === 'completionDate') assert.equal(residence.data[key].slice(0, 10), value);
      else assert.deepEqual(residence.data[key], value, key);
    }
    const changedFee = await api('PUT', `/estate/Residences/${residence.data._id}`, { maintenanceFee: { amount: 75 } });
    assert.deepEqual(changedFee.data.maintenanceFee, { amount: 75, currency: 'USD' });
    assert.equal((await api('GET', '/estate/Residences?city=Istanbul&constructionStatus=READY')).data.total, 1);
    assert.equal((await api('PUT', `/estate/Residences/${residence.data._id}`, { unitCount: 1.5 })).status, 400);
    assert.equal((await api('PUT', `/estate/Residences/${residence.data._id}`, { amenities: ['UNKNOWN'] })).status, 400);
    const clearedResidence = await api('PUT', `/estate/Residences/${residence.data._id}`, { buildingAge: '', constructionStatus: '' });
    assert.equal(clearedResidence.status, 200, JSON.stringify(clearedResidence));
    await FormDefinition.create({ moduleName: 'Residences', fields: defaults.Residences.filter(field => ['name', 'district', 'neighborhood', 'address', 'notes'].includes(field.name)) });
    const expandedResidence = await api('GET', '/estate/definitions/Residences');
    assert.equal(expandedResidence.data.fields.length, defaults.Residences.length);
    assert.equal(expandedResidence.data.fields.find(field => field.name === 'unitCount').integer, true);
    await FormDefinition.deleteOne({ moduleName: 'Residences' });
    // Older saved definitions must pick up new statuses and discard removed defaults.
    await FormDefinition.create({ moduleName: 'Leads', fields: defaults.Leads.map(field => field.name === 'leadStatus'
      ? { ...field, defaultValue: 'rented', options: [...field.options, { value: 'sold', label: { en: 'Sold', fa: 'Sold', tr: 'Sold' } }, { value: 'rented', label: { en: 'Rented', fa: 'Rented', tr: 'Rented' } }] } : field) });
    const leadDefinition = await api('GET', '/estate/definitions/Leads');
    const leadStatus = leadDefinition.data.fields.find(field => field.name === 'leadStatus');
    assert.equal(leadStatus.defaultValue, '');
    assert.deepEqual(leadStatus.options, defaults.Leads.find(field => field.name === 'leadStatus').options);
    await FormDefinition.create({ moduleName: 'Partner Customers', fields: defaults['Partner Customers'].map(field => field.name === 'status'
      ? { ...field, options: field.options.filter(option => ['ACTIVE', 'INACTIVE'].includes(option.value)) } : field) });
    const partnerDefinition = await api('GET', '/estate/definitions/Partner%20Customers');
    const partnerStatuses = partnerDefinition.data.fields.find(field => field.name === 'status').options;
    assert.deepEqual(partnerStatuses, defaults['Partner Customers'].find(field => field.name === 'status').options);
    for (const option of partnerStatuses) {
      const changed = await api('PUT', `/estate/Partner%20Customers/${partner.data._id}`, { status: option.value });
      assert.equal(changed.status, 200, JSON.stringify(changed));
      assert.equal(changed.data.status, option.value);
      assert.equal((await api('GET', '/estate/Partner%20Customers?status=' + option.value)).data.total, 1);
    }
    assert.equal((await api('PUT', `/estate/Partner%20Customers/${partner.data._id}`, { status: 'RENTED' })).status, 400);
    assert.equal((await api('PUT', `/estate/Partner%20Customers/${partner.data._id}`, { status: 'SOLD' })).status, 400);
    const soldResidence = await api('POST', '/estate/Residences', { name: 'Sold Residence', transactionType: 'SALE', price: { amount: 9000000, currency: 'TRY' }, area: { value: 500, type: 'GROSS' }, sale: { status: 'SOLD', buyerType: 'PARTNER_CUSTOMER', partnerCustomer: partner.data._id } });
    assert.equal(soldResidence.status, 201, JSON.stringify(soldResidence));
    assert.equal((await api('GET', '/estate/Residences?priceMin=8000000&priceMax=10000000&sort=price.amount')).data.total, 1);
    assert.equal((await api('GET', '/estate/Residences/' + soldResidence.data._id)).data.sale.customerName, 'Integration Company');
    assert.equal((await api('GET', '/estate/Residences?sale.status=SOLD')).data.items[0].sale.customerName, 'Integration Company');
    assert.equal((await api('POST', '/estate/Residences', { name: 'Missing buyer', sale: { status: 'SOLD' } })).status, 400);
    assert.equal((await api('PUT', '/estate/Residences/' + soldResidence.data._id, { sale: { status: 'SOLD', buyerType: 'LEAD', lead: String(new mongoose.Types.ObjectId()) } })).status, 400);
    assert.equal((await api('DELETE', '/estate/Partner%20Customers/' + partner.data._id)).status, 409);
    const { Lead } = require('../model/schema/lead');
    Lead.schema.add({ leadName: String, leadEmail: String });
    const customerLead = await Lead.create({ leadName: 'Rental Customer', leadEmail: 'tenant@example.com', createBy: admin._id });
    const rentedResidence = await api('POST', '/estate/Residences', { name: 'Rented Residence', transactionType: 'RENT', sale: { status: 'RENTED', buyerType: 'LEAD', lead: String(customerLead._id) } });
    assert.equal(rentedResidence.status, 201, JSON.stringify(rentedResidence));
    assert.equal((await api('GET', '/estate/Residences/' + rentedResidence.data._id)).data.sale.customerName, 'Rental Customer');
    assert.equal((await api('GET', '/estate/Residences?sale.status=RENTED')).data.total, 1);
    const ownerResidence = await require('../model/schema/residence').create({ name: 'Own residence, hidden customer', createBy: user._id, transactionType: 'SALE', sale: { status: 'SOLD', buyerType: 'LEAD', lead: customerLead._id } });
    await User.updateOne({ _id: user._id }, { $set: { 'moduleVisibility.Leads': false } });
    assert.equal((await api('GET', '/estate/Residences/' + ownerResidence._id, null, user)).data.sale.customerName, null);
    const releasedResidence = await api('PUT', '/estate/Residences/' + rentedResidence.data._id, { sale: { status: 'AVAILABLE' } });
    assert.equal(releasedResidence.data.sale.lead, null); assert.equal(releasedResidence.data.sale.soldAt, null);
    const definition = await api('GET', '/estate/definitions/Properties');
    const field = { name: 'field_reference', kind: 'CUSTOM_FIELD', type: 'text', enabled: true, required: true, label: { en: 'Reference', fa: 'مرجع', tr: 'Referans' } };
    const updated = await api('PUT', '/estate/definitions/Properties', { ...definition.data, fields: [...definition.data.fields, field] });
    assert.equal(updated.status, 200, JSON.stringify(updated));
    assert.equal((await api('PUT', '/estate/definitions/Properties', updated.data, user)).status, 403);
    const payload = { title: 'Integration Property', category: 'RESIDENTIAL', subtype: 'VILLA', transactionType: 'SALE', price: { amount: 1500000, currency: 'TRY' }, area: { value: 120, type: 'NET' }, isInsideResidence: true, residence: residence.data._id, sale: { status: 'SOLD', buyerType: 'PARTNER_CUSTOMER', partnerCustomer: partner.data._id } };
    assert.equal((await api('POST', '/estate/Properties', payload)).status, 400);
    payload.customFields = { field_reference: 'REF-1' };
    const property = await api('POST', '/estate/Properties', payload);
    assert.equal(property.status, 201, JSON.stringify(property));
    assert.equal(property.data.sale.partnerCustomer, partner.data._id);
    assert.equal((await api('GET', '/estate/Properties/' + property.data._id)).data.sale.customerName, 'Integration Company');
    assert.equal((await api('GET', '/estate/Properties?sale.status=SOLD')).data.items[0].sale.customerName, 'Integration Company');
    assert.equal((await api('DELETE', `/estate/Partner%20Customers/${partner.data._id}`)).status, 409);
    assert.equal((await api('POST', '/estate/Properties', { ...payload, residence: String(new mongoose.Types.ObjectId()) })).status, 400);
    const rented = await api('POST', '/estate/Properties', { ...payload, title: 'Rented home', transactionType: 'RENT', sale: { status: 'RENTED', buyerType: 'PARTNER_CUSTOMER', partnerCustomer: partner.data._id } });
    assert.equal(rented.status, 201, JSON.stringify(rented)); assert.equal(rented.data.status, 'Rented');
    assert.equal((await api('GET', '/estate/Properties?sale.status=RENTED')).data.total, 1);
    const invalidInvoice = await api('POST', '/invoices/add', { title: 'Incomplete', property: rented.data._id });
    assert.equal(invalidInvoice.status, 400); assert.equal(invalidInvoice.data.field, 'transactionType');
    const invoice = await api('POST', '/invoices/add', { title: 'Rent invoice', property: rented.data._id, transactionType: 'RENT' });
    assert.equal(invoice.status, 200, JSON.stringify(invoice));
    const invoiceView = await api('GET', '/invoices/view/' + invoice.data._id);
    assert.equal(invoiceView.data.result.propertyName, 'Rented home'); assert.equal(invoiceView.data.result.transactionType, 'RENT');
    const invoiceList = await api('GET', '/invoices');
    assert.equal(invoiceList.data.find(item => item._id === invoice.data._id).propertyName, 'Rented home');
    assert.equal((await api('PUT', '/invoices/edit/' + invoice.data._id, { description: 'Updated' })).status, 200);
    assert.equal((await api('GET', '/invoices/view/' + invoice.data._id)).data.result.property, rented.data._id);
    const quote = await require('../model/schema/quotes').create({ property: rented.data._id, createBy: admin._id });
    const converted = await api('POST', '/quotes/convertToInvoice', { _id: String(quote._id) });
    assert.equal(converted.status, 200, JSON.stringify(converted));
    const convertedInvoice = await require('../model/schema/invoices').findOne({ quotesId: quote._id }).lean();
    assert.equal(String(convertedInvoice.property), rented.data._id); assert.equal(convertedInvoice.transactionType, 'RENT');
    const released = await api('PUT', '/estate/Properties/' + rented.data._id, { sale: { status: 'AVAILABLE' } });
    assert.equal(released.data.sale.partnerCustomer, null);
    await api('DELETE', '/estate/Properties/' + rented.data._id);
    const cleared = await api('PUT', `/estate/Properties/${property.data._id}`, { isInsideResidence: false, sale: { status: 'AVAILABLE' }, category: 'COMMERCIAL', subtype: 'SHOP', bedroom: '1+1' });
    assert.equal(cleared.status, 200, JSON.stringify(cleared)); assert.equal(cleared.data.residence, null); assert.equal(cleared.data.sale.partnerCustomer, null); assert.equal(cleared.data.bedroom, null);
    const list = await api('GET', '/estate/Properties?category=COMMERCIAL&priceMin=100&limit=1');
    assert.equal(list.data.total, 1); assert.equal(list.data.items.length, 1);
    assert.equal((await api('GET', '/estate/Properties/not-an-id')).status, 400);
    const form = new FormData(); form.append('files', new Blob(['integration test'], { type: 'text/plain' }), 'integration.txt');
    const upload = await fetch(base + '/estate/files', { method: 'POST', headers: { Authorization: token(admin) }, body: form });
    assert.equal(upload.status, 201); const files = await upload.json(); assert.ok(files[0].uploadedAt);
    assert.equal((await api('PUT', `/estate/Properties/${property.data._id}`, { files })).status, 200);
    const residenceFiles = await api('PUT', `/estate/Residences/${residence.data._id}`, { files: files.map(file => ({ ...file, name: 'forged-name', storageName: '../forged.txt' })) });
    assert.equal(residenceFiles.status, 200, JSON.stringify(residenceFiles));
    assert.equal(residenceFiles.data.files[0].name, 'integration.txt');
    const residenceReload = await api('GET', `/estate/Residences/${residence.data._id}`);
    assert.equal(residenceReload.data.unitCount, 100); assert.equal(residenceReload.data.maintenanceFee.currency, 'USD');
    assert.equal(residenceReload.data.files[0]._id, files[0].id);
    assert.equal((await api('PUT', `/estate/Residences/${residence.data._id}`, { files: [{ id: String(new mongoose.Types.ObjectId()) }] })).status, 400);
    assert.equal((await api('PUT', `/estate/Properties/${property.data._id}`, { description: 'keeps stored file metadata' })).status, 200);
    const download = await fetch(`${base}/estate/files/${files[0].id}`, { headers: { Authorization: token(admin) } });
    assert.equal(await download.text(), 'integration test');
    assert.equal((await api('DELETE', `/estate/Properties/${property.data._id}`)).status, 200);
    assert.equal((await api('GET', '/estate/Properties')).data.total, 0);
    assert.equal((await api('GET', `/estate/Properties/${property.data._id}`, null, user)).status, 404);
    const CustomField = require('../model/schema/customField');
    await CustomField.create({ moduleName: 'Residences', fields: [{ name: 'legacy_note', label: 'Legacy note', type: 'text' }] });
    const original = await api('GET', '/estate/definitions/Residences');
    assert(original.data.fields.some(item => item.name === 'legacy_note'));
    const saved = await api('PUT', '/estate/definitions/Residences', {
      ...original.data,
      fields: original.data.fields.filter(item => item.name !== 'legacy_note').map(item =>
        item.name === 'notes' ? { ...item, enabled: false, required: true, label: { en: 'Changed notes', fa: 'یادداشت جدید', tr: 'Yeni notlar' } } : item),
    });
    assert.equal(saved.status, 200, JSON.stringify(saved));
    for (const actor of [admin, user]) {
      const reloaded = await api('GET', '/estate/definitions/Residences', null, actor);
      assert.equal(reloaded.data.revision, saved.data.revision);
      assert(!reloaded.data.fields.some(item => item.name === 'legacy_note'));
      assert.equal(reloaded.data.fields.find(item => item.name === 'notes').enabled, false);
      assert.equal(reloaded.data.fields.find(item => item.name === 'notes').label.en, 'Changed notes');
    }
    assert.equal((await api('PUT', '/estate/definitions/Residences', original.data)).status, 409);
    assert.equal((await api('POST', '/estate/Residences', { name: 'Hidden required notes do not prevent saving' }, user)).status, 201);
    const storedFiles = await mongoose.model('EstateFile').find().lean();
    const fs = require('fs'); const path = require('path');
    for (const file of storedFiles) await fs.promises.unlink(path.resolve(__dirname, '../uploads/estate', file.storageName));
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name !== dbName || !dbName.startsWith('crm_estate_test_')) throw new Error('Unexpected integration database');
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
