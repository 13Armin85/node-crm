const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { preservedCollections, inventory, collectionDigest, resetOperationalData } = require('../services/crmReset');
test('reset empties all operational collections and exactly preserves accounts and form settings', { skip: process.env.ESTATE_INTEGRATION !== '1' }, async t => {
  const name = 'crm_reset_test_' + require('node:crypto').randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName: name });
  t.after(async () => { assert.equal(mongoose.connection.name, name); assert(name.startsWith('crm_reset_test_')); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const db = mongoose.connection.db;
  for (const collection of [...preservedCollections, 'Leads', 'Contacts', 'Opportunities', 'Document', 'recordnotes', 'Notifications', 'CustomBusinessModule']) await db.collection(collection).insertOne({ value: 'Original data', active: true });
  const hashes = new Map(); for (const collection of preservedCollections) hashes.set(collection, await collectionDigest(db, collection));
  const names = (await inventory(db)).map(item => item.name);
  await assert.rejects(resetOperationalData(db, 'wrong_database', names));
  await assert.rejects(resetOperationalData(db, name, names.filter(item => item !== 'Contacts')));
  const report = await resetOperationalData(db, name, names);
  assert.equal(report.deletedRecords, 7);
  for (const [collection, hash] of hashes) assert.equal(await collectionDigest(db, collection), hash);
  assert(report.collections.every(item => item.preserve ? item.count === 1 : item.count === 0));
  assert.equal((await resetOperationalData(db, name, names)).deletedRecords, 0);
  const definitions = db.collection('formdefinitions');
  await definitions.deleteMany({});
  const field = (name, label) => ({ name, kind: 'SYSTEM_FIELD', type: 'text', enabled: true, label: { en: label, fa: label, tr: label } });
  await definitions.insertMany([
    { moduleName: 'Contacts', revision: 3, fields: [field('fullName', 'Custom contact name')], removedFields: ['campaign'] },
    { moduleName: 'Leads', revision: 2, fields: [field('leadName', 'Custom lead name')], removedFields: ['listedFor', 'leadCampaign'] },
    { moduleName: 'Opportunities', fields: [field('opportunityName', 'Custom opportunity name')] },
    { moduleName: 'Properties', fields: [{ name: 'legacySuitable', kind: 'CUSTOM_FIELD', type: 'multiselect', enabled: true,
      label: { en: 'Avalable', fa: 'مناسب', tr: 'Uygun' }, options: [
        { value: 'Citizdenship', label: { en: 'Citizdenship', fa: 'شهروندی', tr: 'Vatandaşlık' } },
        { value: 'Residenty', label: { en: 'Residenty', fa: 'اقامت', tr: 'ikamet' } },
      ] }] },
  ]);
  await require('../scripts/reset-crm-data').prepareForms(db);
  for (const moduleName of ['Contacts', 'Leads', 'Opportunities']) {
    const definition = await definitions.findOne({ moduleName });
    const request = definition.fields.find(field => field.name === 'listedFor');
    assert.equal(request.enabled, true); assert.equal(request.label.fa, 'نوع درخواست');
    assert.deepEqual(request.options.map(option => option.value), ['Buy', 'Rent']);
    assert(!definition.removedFields.includes('listedFor'));
  }
  assert.equal((await definitions.findOne({ moduleName: 'Contacts' })).fields.find(field => field.name === 'fullName').label.en, 'Custom contact name');
  assert((await definitions.findOne({ moduleName: 'Leads' })).removedFields.includes('leadCampaign'));
  const suitability = (await definitions.findOne({ moduleName: 'Properties' })).fields[0];
  assert.deepEqual(suitability.options.map(option => option.value), ['Citizdenship', 'Residenty', 'LIVING', 'INVESTMENT']);
  assert.equal(await collectionDigest(db, 'User'), hashes.get('User'));
});
