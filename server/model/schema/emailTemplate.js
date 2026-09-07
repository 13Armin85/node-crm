const mongoose = require('mongoose');

const EmailTemp = new mongoose.Schema({
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    templateName: String,
    description: String,
    design: { type: Object },
    html: String,
    createBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdDate: {
        type: Date,
    },
    deleted: {
        type: Boolean,
        default: false,
    },
})

module.exports = mongoose.model('EmailTemps', EmailTemp, 'EmailTemps');