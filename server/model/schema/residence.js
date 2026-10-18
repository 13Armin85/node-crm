const mongoose = require('mongoose');
const { constructionStatuses, amenities } = require('../../services/residenceCatalog');
const { ages, bedrooms } = require('../../services/estateCatalog');
const optionalEnum = values => ({ type: String, enum: values, set: value => value === '' ? undefined : value });
const count = min => ({ type: Number, min, validate: value => value == null || Number.isInteger(value) });
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, description: String, developer: String,
  constructionStatus: optionalEnum(Object.keys(constructionStatuses)),
  category: optionalEnum(['RESIDENTIAL', 'COMMERCIAL']),
  transactionType: { type: String, enum: ['SALE', 'RENT'], default: 'SALE' },
  price: { amount: { type: Number, min: 0 }, currency: { type: String, enum: ['TRY', 'USD', 'EUR', ''], default: 'TRY' } },
  area: { value: { type: Number, min: 0.01 }, type: optionalEnum(['NET', 'GROSS']), unit: { type: String, default: 'M2' } },
  occupancyStatus: optionalEnum(['EMPTY', 'TENANTED', 'OWNER_OCCUPIED']),
  sale: {
    status: { type: String, enum: ['AVAILABLE', 'SOLD', 'RENTED'], default: 'AVAILABLE' },
    buyerType: { type: String, enum: ['LEAD', 'PARTNER_CUSTOMER', null], default: null },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Leads', default: null },
    partnerCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'PartnerCustomers', default: null },
    soldAt: { type: Date, default: null },
    soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  country: String, city: String, district: String, neighborhood: String,
  address: String, postalCode: String, mapUrl: String,
  constructionYear: { ...count(1800), max: 2200 }, buildingAge: optionalEnum(ages), completionDate: Date,
  blockCount: count(1), floorCount: count(1), unitCount: count(1), totalArea: { type: Number, min: 0.01 },
  unitTypes: [{ type: String, enum: bedrooms }], amenities: [{ type: String, enum: Object.keys(amenities) }],
  heatingType: String, parkingCapacity: count(0),
  managementCompany: String, contactPerson: String, phone: String, email: String, website: String,
  maintenanceFee: { amount: { type: Number, min: 0 }, currency: { type: String, enum: ['TRY', 'USD', 'EUR', ''], default: 'TRY' } },
  files: [{ name: String, url: String, mimeType: String, size: Number, uploadedAt: Date, storageName: String }],
  notes: String, customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  createBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deleted: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'createdDate', updatedAt: 'updatedDate' } });
schema.index({ deleted: 1, name: 1 });
schema.plugin(require('../../services/duplicateRecords').duplicateRecords, { moduleName: 'Residences' });
module.exports = mongoose.model('Residences', schema, 'Residences');
