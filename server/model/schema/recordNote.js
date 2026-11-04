const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  module: { type: String, enum: ['Contacts', 'Opportunities'], required: true },
  record: { type: mongoose.Schema.Types.ObjectId, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: String,
  text: { type: String, required: true, trim: true, maxlength: 10000 },
  clientId: { type: String, required: true, maxlength: 100 },
}, { timestamps: true });
schema.index({ module: 1, record: 1, _id: -1 });
schema.index({ module: 1, record: 1, author: 1, clientId: 1 }, { unique: true });
module.exports = mongoose.model('RecordNote', schema);
