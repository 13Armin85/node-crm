const mongoose = require('mongoose');

// Define the schema for individual files
const fileSchema = new mongoose.Schema({
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    fileName: {
        type: String,
        required: true,
    },
    linkContact: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact',
    },
    linkLead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
    },  
    linkProperty: { type: mongoose.Schema.Types.ObjectId, ref: 'Properties' },
    linkOpportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunities' },
    linkPartnerCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'PartnerCustomers' },
    entityType: { type: String, enum: ['Contact', 'Lead', 'Property', 'Opportunity', 'PartnerCustomer', null], default: null },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    path: {
        type: String,
        required: true,
    },
    img: String,
    mimeType: String,
    size: Number,
    createOn: {
        type: Date,
        default: Date.now,
    },
    deleted: {
        type: Boolean,
        default: false,
    },
});

// Define the schema for the main document
const documentSchema = new mongoose.Schema({
    folderName: {
        type: String,
        required: true,
    },
    file: [fileSchema],
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
    createBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdDate: { type: Date, default: Date.now },
    updatedDate: { type: Date, default: Date.now },
    deleted: { type: Boolean, default: false },
});

documentSchema.index({ createBy: 1, parentFolder: 1, folderName: 1, deleted: 1 });

// Create the model for the main document


module.exports = mongoose.model('Document', documentSchema, 'Document');
