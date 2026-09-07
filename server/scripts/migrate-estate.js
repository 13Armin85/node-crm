/* Idempotent, additive migration. Preview by default; --apply writes changes. */
require('dotenv').config();
const mongoose = require('mongoose');
const { categories } = require('../services/estateCatalog');
const PartnerCustomer = require('../model/schema/partnerCustomer');
const { defaults } = require('../services/formDefinitions');
const FormDefinition = require('../model/schema/formDefinition');
const apply = process.argv.includes('--apply');
const propertyMapping = {
  apartment: ['RESIDENTIAL', 'APARTMENT'], residential: ['RESIDENTIAL', 'APARTMENT'], residence: ['RESIDENTIAL', 'RESIDENCE'],
  villa: ['RESIDENTIAL', 'VILLA'], shop: ['COMMERCIAL', 'SHOP'], office: ['COMMERCIAL', 'OFFICE'],
  daire: ['RESIDENTIAL', 'APARTMENT'], rezidans: ['RESIDENTIAL', 'RESIDENCE'], ofis: ['COMMERCIAL', 'OFFICE'],
};
function mapProperty(record) {
  const update = {};
  const type = String(record.propertyType || '').trim().toLowerCase();
  const mapping = propertyMapping[type.replace(/\s+(for\s+)?(sale|rent)$/, '')];
  if (!record.category && mapping) { update.category = mapping[0]; update.subtype = mapping[1]; }
  if (!record.transactionType && /\b(sale|rent)\b/.test(type)) update.transactionType = /rent/.test(type) ? 'RENT' : 'SALE';
  if (!record.title && (record.name || record.propertyName || record.propertyAddress)) update.title = record.name || record.propertyName || record.propertyAddress;
  if (record.floor == null && record.Floor != null && record.Floor !== '' && Number.isInteger(Number(record.Floor)) && Number(record.Floor) >= -2) update.floor = Number(record.Floor) > 20 ? '20+' : String(record.Floor);
  if (!record.description && record.propertyDescription) update.description = record.propertyDescription;
  if (!record.sale?.status && String(record.status).toLowerCase() === 'sold') update['sale.status'] = 'SOLD';
  if (record.price?.amount == null && record.listingPrice != null && String(record.listingPrice).trim() !== '') {
    const amount = Number(String(record.listingPrice).replace(/,/g, ''));
    if (Number.isFinite(amount) && amount >= 0) { update['price.amount'] = amount; if (!record.price?.currency) update['price.currency'] = 'TRY'; }
  }
  if (record.area?.value == null && Number(record.squareFootage) > 0) {
    // squareFootage is not m²: preserve the unit conversion explicitly.
    update['area.value'] = Math.round(Number(record.squareFootage) * 0.09290304 * 100) / 100;
    update['area.unit'] = 'M2';
  }
  return { update, unknown: !record.category && !mapping ? record.propertyType || '(missing type)' : null };
}
async function migrate() {
  await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', { dbName: process.env.DB || 'Prolink', serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  let accounts = 0; let properties = 0; let unknown = 0;
  for await (const record of db.collection('Accounts').find({})) {
    if (await PartnerCustomer.exists({ legacyAccountId: record._id })) continue;
    if (!record.createBy) { console.log('Account missing creator:', String(record._id)); continue; }
    accounts++;
    if (apply) await PartnerCustomer.updateOne({ legacyAccountId: record._id }, { $setOnInsert: {
      _id: record._id, legacyAccountId: record._id, customerType: 'COMPANY', companyName: record.name || '',
      phone: record.officePhone == null ? '' : String(record.officePhone), whatsapp: record.alternatePhone == null ? '' : String(record.alternatePhone),
      email: record.emailAddress, address: [record.billingStreet, record.billingStreet2, record.billingCity, record.billingState, record.billingCountry].filter(Boolean).join(', '),
      notes: record.description, createBy: record.createBy, createdDate: record.createdDate, updatedDate: record.modifiedDate,
      status: 'ACTIVE', deleted: record.deleted || false, customFields: {},
    } }, { upsert: true, timestamps: false });
  }
  for await (const record of db.collection('Properties').find({})) {
    const { update, unknown: unknownType } = mapProperty(record);
    if (unknownType) { unknown++; console.log('Unmapped property type:', String(record._id), unknownType); }
    if (Object.keys(update).length) {
      properties++;
      if (apply) await db.collection('Properties').updateOne({ _id: record._id }, { $set: update });
    }
  }
  if (apply) {
    for (const [moduleName, fields] of Object.entries(defaults)) await FormDefinition.updateOne({ moduleName }, { $setOnInsert: { moduleName, revision: 0, fields: fields.map((f, order) => ({ ...f, order })) } }, { upsert: true });
    for await (const role of db.collection('RoleAccess').find({})) {
      const access = (role.access || []).filter(a => a.title !== 'Payments');
      for (const item of access) if (item.title === 'Account') item.title = 'Partner Customers';
      for (const title of ['Partner Customers', 'Residences']) if (!access.some(a => a.title === title)) access.push({ title, create: false, update: false, delete: false, view: false });
      await db.collection('RoleAccess').updateOne({ _id: role._id }, { $set: { access } });
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', accounts, properties, unknownPropertyTypes: unknown }));
  await mongoose.disconnect();
}
if (require.main === module) migrate().catch(async error => { console.error(error.message); await mongoose.disconnect(); process.exitCode = 1; });
module.exports = { mapProperty };
