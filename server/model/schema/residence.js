const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, district: String, neighborhood: String,
  address: String, notes: String, customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  createBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deleted: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'createdDate', updatedAt: 'updatedDate' } });
schema.index({ deleted: 1, name: 1 });
module.exports = mongoose.model('Residences', schema, 'Residences');
