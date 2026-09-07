const mongoose = require('mongoose');
const { fieldTypes } = require('../../services/estateCatalog');
const localized = { en: String, fa: String, tr: String };
const field = new mongoose.Schema({
  name: { type: String, required: true }, kind: { type: String, enum: ['SYSTEM_FIELD', 'CUSTOM_FIELD'], required: true },
  type: { type: String, enum: fieldTypes, required: true }, label: localized,
  placeholder: localized, helpText: localized, validationMessage: localized,
  options: [{ value: String, label: localized, _id: false }],
  required: Boolean, enabled: Boolean, order: Number, defaultValue: mongoose.Schema.Types.Mixed,
  min: Number, max: Number, locked: Boolean, relation: String,
  condition: mongoose.Schema.Types.Mixed,
}, { _id: false });
const schema = new mongoose.Schema({
  moduleName: { type: String, unique: true, required: true }, fields: [field],
  revision: { type: Number, default: 0 }, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
module.exports = mongoose.model('FormDefinition', schema);
