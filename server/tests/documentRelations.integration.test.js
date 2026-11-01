const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

test('document uploads preserve verified property/owner and customer/property links', { skip: process.env.DOCUMENTS_INTEGRATION !== '1' }, async t => {
  const dbName = 'crm_document_relations_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  mongoose.set('strictQuery', false);
  const app = express(); app.use(express.json()); app.use('/api', require('../controllers/route'));
  const User = require('../model/schema/user'), Document = require('../model/schema/document');
  const { Contact } = require('../model/schema/contact'), { Lead } = require('../model/schema/lead');
  const { Property } = require('../model/schema/property');
  const admin = await User.create({ username: 'admin@example.test', password: 'unused', role: 'admin' });
  const restricted = await User.create({ username: 'restricted@example.test', password: 'unused', role: 'user', moduleVisibility: { Properties: false } });
  const owner = await Contact.create({ fullName: 'Property Owner', createBy: admin._id });
  const property = await Property.create({ title: 'Garden Villa', propertyOwner: owner._id, createBy: admin._id });
  const unrelated = await Property.create({ title: 'Unrelated', createBy: admin._id });
  const lead = await Lead.create({ associatedListing: property._id, createBy: admin._id });
  await Contact.updateOne({ _id: owner._id }, { $addToSet: { interestProperty: property._id } });
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const uploadedPaths = [];
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    const root = path.resolve(__dirname, '../uploads/document');
    for (const filePath of uploadedPaths) { assert(filePath.startsWith(root + path.sep)); await fs.unlink(filePath).catch(() => {}); }
    assert.equal(mongoose.connection.name, dbName); assert(dbName.startsWith('crm_document_relations_test_'));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  });
  const token = actor => jwt.sign({ userId: actor._id }, jwtSecret, { expiresIn: '5m' });
  const get = async (route, actor = admin) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/' + route, { headers: { Authorization: token(actor) } });
    return { status: response.status, data: await response.json() };
  };
  const upload = async (type, id, extra = {}) => {
    const form = new FormData(); form.append('entityType', type); form.append('entityId', String(id));
    for (const [key, value] of Object.entries(extra)) form.append(key, String(value));
    form.append('files', new Blob(['document relation ' + crypto.randomUUID()], { type: 'text/plain' }), 'relation.txt');
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/document/add', {
      method: 'POST', headers: { Authorization: token(admin) }, body: form,
    });
    const data = await response.json();
    if (data.folder) {
      const folder = await Document.findById(data.folder._id).lean();
      uploadedPaths.push(...folder.file.map(file => file.path));
    }
    return { status: response.status, data };
  };
  await t.test('offers only the selected property owner and associated customer properties', async () => {
    const options = await get(`document/related-options?entityType=Property&entityId=${property._id}`);
    assert.equal(options.status, 200);
    assert.deepEqual(options.data.contacts, [{ value: String(owner._id), label: 'Property Owner' }]);
    for (const [type, record] of [['Lead', lead], ['Contact', owner]]) {
      const result = await get(`document/related-options?entityType=${type}&entityId=${record._id}`);
      assert.equal(result.status, 200);
      assert.deepEqual(result.data.properties, [{ value: String(property._id), label: 'Garden Villa' }]);
    }
  });
  await t.test('stores property and owner names together and supports both relation filters', async () => {
    const result = await upload('Property', property._id, { linkContact: owner._id });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    const file = result.data.folder.file.at(-1);
    assert.equal(file.linkProperty, String(property._id)); assert.equal(file.linkContact, String(owner._id));
    assert.deepEqual(file.relatedRecords.map(item => item.label), ['Garden Villa', 'Property Owner']);
    const listing = await get(`document?entityType=Contact&entityId=${owner._id}`);
    assert.equal(listing.data.flatMap(folder => folder.files).length, 1);
  });
  await t.test('stores a property alongside either a lead or a contact', async () => {
    for (const [type, record] of [['Lead', lead], ['Contact', owner]]) {
      const result = await upload(type, record._id, { linkProperty: property._id });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      const file = result.data.folder.file.at(-1);
      assert.equal(file.entityType, type); assert.equal(file.linkProperty, String(property._id));
      assert.equal(file.relatedRecords[1].label, 'Garden Villa');
    }
  });
  await t.test('legacy documents show their stored category, owner and property names without uploading again', async () => {
    const folder = await Document.create({ folderName: 'Legacy Documents', createBy: admin._id, file: [{
      fileName: 'legacy-plan.pdf', path: '/test/legacy-plan.pdf', category: 'PROPERTIES',
      linkProperty: property._id, linkContact: owner._id, customFields: { reference: 'Original reference', pages: 0 },
    }] });
    const result = await get('document');
    assert.equal(result.status, 200);
    const file = result.data.find(item => item._id === String(folder._id)).files[0];
    assert.equal(file.entityType, 'Property');
    assert.deepEqual(file.relatedRecords.map(record => record.label), ['Garden Villa', 'Property Owner']);
    assert.equal(file.customFields.reference, 'Original reference'); assert.equal(file.customFields.pages, 0);
  });
  await t.test('legacy record upload placeholders do not prevent the real customer link', async () => {
    const result = await upload('Contact', owner._id, { linkLead: 'false' });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.folder.file.at(-1).linkContact, String(owner._id));
  });
  await t.test('rejects unrelated secondary records and inaccessible primary records', async () => {
    // Test validation directly so a rejected upload does not leave test bytes on disk.
    const { documentRelations } = require('../services/documentRelations');
    await assert.rejects(documentRelations({ actor: admin, body: { linkProperty: String(unrelated._id) } },
      { entityType: 'Lead', entityId: String(lead._id) }), error => error.code === 'relationNotFound');
    const result = await get(`document/related-options?entityType=Property&entityId=${property._id}`, restricted);
    assert.equal(result.status, 404);
  });
});
