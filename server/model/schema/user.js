const mongoose = require('mongoose');

// create login schema
const user = new mongoose.Schema({
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        select: false,
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user',
        required: true,
    },
    emailsent: { type: Number, default: 0 },
    textsent: { type: Number, default: 0 },
    outboundcall: { type: Number, default: 0 },
    phoneNumber: { type: Number },
    firstName: String,
    lastName: String,
    updatedDate: {
        type: Date,
        default: Date.now
    },
    createdDate: {
        type: Date,
    },
    deleted: {
        type: Boolean,
        default: false,
    },
})

module.exports = mongoose.model('User', user, 'User')
