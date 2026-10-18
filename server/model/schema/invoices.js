const mongoose = require('mongoose');

const Invoices = new mongoose.Schema({
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    title: String,
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Properties', default: null },
    transactionType: { type: String, enum: ['SALE', 'RENT', '', null], default: '' },
    description: String,
    quoteNumber: String,
    quoteDate: Date,
    dueDate: Date,
    invoiceDate: Date,
    status: String,
    billingStreet: String,
    billingCity: String,
    billingState: String,
    billingPostalCode: String,
    billingCountry: String,
    shippingStreet: String,
    shippingCity: String,
    shippingState: String,
    shippingPostalCode: String,
    shippingCountry: String,
    invoiceNumber: String,
    lineItems: String,
    total: String,
    subtotal: String,
    discount: String,
    tax: String,
    ptax: String,
    shipping: String,
    shippingTax: String,
    grandTotal: String,
    currency: String,
    quoteStage: String,
    paymentTerms: String,
    description: String,
    approvalStatus: String,
    invoiceStatus: String,
    discountType: String,
    items: [],
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PartnerCustomers",
    },
    contact: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Contacts",
    },
    quotesId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Quotes",
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    createBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isCheck: {
        type: Boolean,
        default: false,
    },
    deleted: {
        type: Boolean,
        default: false,
    },
    invoiceConvertDate: {
        type: Date,
    },
    updatedDate: {
        type: Date,
        default: Date.now
    },
    createdDate: {
        type: Date,
    },
})

// Recalculate every invoice write, including imports and quote conversions.
Invoices.pre('validate', function () {
    const { normalizeInvoiceAmounts } = require('../../services/invoiceAmounts');
    const values = this.toObject();
    this.set(normalizeInvoiceAmounts(values, this.isNew ? {} : values));
});
Invoices.pre('findOneAndUpdate', async function () {
    const update = this.getUpdate();
    if (!update?.$set) return;
    const calculationFields = ['items', 'shipping', 'ptax', 'currency', 'total', 'discount', 'subtotal', 'tax', 'shippingTax', 'grandTotal', 'isCheck'];
    if (!Object.keys(update.$set).some(key => calculationFields.includes(key) || /^(billing|shipping)(Street|City|State|PostalCode|Country)$/.test(key))) return;
    const previous = await this.model.findOne(this.getQuery()).lean();
    if (!previous) return;
    update.$set = require('../../services/invoiceAmounts').normalizeInvoiceAmounts(update.$set, previous);
    this.setUpdate(update);
});
module.exports = mongoose.model('Invoices', Invoices, 'Invoices');

