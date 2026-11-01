const mongoose = require('mongoose');
const { normalize } = require('../../services/districtNames');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  normalizedName: { type: String, required: true },
  label: { en: String, fa: String, tr: String },
  createBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deleted: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'createdDate', updatedAt: 'updatedDate' } });
schema.pre('validate', function () { this.normalizedName = normalize(this.name); });
schema.index({ normalizedName: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
module.exports = mongoose.model('Districts', schema, 'Districts');
