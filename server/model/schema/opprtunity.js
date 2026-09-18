const mongoose = require('mongoose');

const Opportunity = new mongoose.Schema({
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    opportunityName: String,
    accountName: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PartnerCustomers',
    },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contacts', default: null },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Leads', default: null },
    properties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Properties' }],
    assignUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    type: String,
    leadSource: String,
    currency: String,
    opportunityAmount: String,
    amount: String,
    expectedCloseDate: Date,
    nextStep: String,
    salesStage: String,
    probability: String,
    description: String,
    createBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    createdDate: {
        type: Date,
        default: Date.now
    },
    modifiedDate: {
        type: Date,
        default: Date.now
    },
    deleted: {
        type: Boolean,
        default: false,
    },
})

Opportunity.index({ contact: 1, deleted: 1 });
Opportunity.index({ lead: 1, deleted: 1 });
Opportunity.index({ accountName: 1, deleted: 1 });

module.exports = mongoose.model('Opportunities', Opportunity, 'Opportunities');
