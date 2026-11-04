const mongoose = require('mongoose');

const TextMsg = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    to: { type: String },
    message: { type: String },
    createFor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact',
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
})

TextMsg.index({ timestamp: 1, sender: 1 });
TextMsg.index({ sender: 1, timestamp: 1 });
module.exports = mongoose.model('TextMsg', TextMsg, 'TextMsg');
