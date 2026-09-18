const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  customerType: { type: String, enum: ['INDIVIDUAL', 'COMPANY'], default: 'INDIVIDUAL' },
  fullName: { type: String, trim: true }, companyName: { type: String, trim: true },
  contactPerson: String, phone: String, whatsapp: String, email: String, nationality: String,
  address: String, district: String, neighborhood: String, taxNumber: String, notes: String,
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contacts' }],
  leads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Leads' }],
  opportunities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Opportunities' }],
  properties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Properties' }],
  legacyAccountId: { type: mongoose.Schema.Types.ObjectId, index: { unique: true, sparse: true } },
  createBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deleted: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'createdDate', updatedAt: 'updatedDate' } });
schema.index({ deleted: 1, createdDate: -1 });
schema.index({ phone: 1 });
schema.index({ fullName: 1, companyName: 1 });
module.exports = mongoose.model('PartnerCustomers', schema, 'PartnerCustomers');
