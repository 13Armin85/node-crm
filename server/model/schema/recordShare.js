const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  module: { type: String, required: true },
  recordId: { type: mongoose.Schema.Types.ObjectId, required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.index({ recipient: 1, module: 1, recordId: 1 }, { unique: true });
schema.index({ module: 1, recordId: 1 });
module.exports = mongoose.model('RecordShare', schema, 'RecordShares');
