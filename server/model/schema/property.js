const mongoose = require("mongoose");

const fetchSchemaFields = async () => {
    const CustomFieldModel = mongoose.model("CustomField");
    return await CustomFieldModel.find({ moduleName: "Properties" });
};

const unitTypeSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    sqm: {
        type: String,
    },
    executive:{
        type: String,
    },
    order: {
        type: Number,
    },
    price: {
        type: String,
    },
});

const flatSchema = new mongoose.Schema({
    flateName: { type: Number },
    status: { type: String },
    unitType: { type: String },
});

const floorSchema = new mongoose.Schema({
    floorNumber: { type: Number },
    flats: [flatSchema],
});

const propertySchema = new mongoose.Schema({
    title: String,
    name: String,
    status: String,
    description: String,
    category: { type: String, enum: ['RESIDENTIAL', 'COMMERCIAL'] },
    subtype: { type: String, enum: ['APARTMENT', 'RESIDENCE', 'VILLA', 'SHOP', 'OFFICE'] },
    transactionType: { type: String, enum: ['SALE', 'RENT'] },
    price: { amount: { type: Number, min: 0 }, currency: { type: String, enum: ['TRY', 'USD', 'EUR'], default: 'TRY' } },
    district: String,
    neighborhood: String,
    isInsideResidence: { type: Boolean, default: false },
    residence: { type: mongoose.Schema.Types.ObjectId, ref: 'Residences', default: null },
    bedroom: { type: String, enum: [...require('../../services/estateCatalog').bedrooms, null] },
    buildingAge: { type: String, enum: require('../../services/estateCatalog').ages },
    occupancyStatus: { type: String, enum: ['EMPTY', 'TENANTED', 'OWNER_OCCUPIED'] },
    floor: { type: String, enum: require('../../services/estateCatalog').floors },
    area: { value: { type: Number, min: 0 }, type: { type: String, enum: ['NET', 'GROSS'] }, unit: { type: String, default: 'M2', enum: ['M2'] } },
    sale: {
        status: { type: String, enum: ['AVAILABLE', 'SOLD'], default: 'AVAILABLE' },
        buyerType: { type: String, enum: ['LEAD', 'PARTNER_CUSTOMER', null], default: null },
        lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Leads', default: null },
        partnerCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'PartnerCustomers', default: null },
        soldAt: { type: Date, default: null },
    },
    files: [{ name: String, url: String, mimeType: String, size: Number, uploadedAt: Date, storageName: String }],
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    // //1. basicPropertyInformation:
    // propertyType: String,
    // propertyAddress: String,
    // listingPrice: String,
    // squareFootage: String,
    // numberofBedrooms: Number,
    // numberofBathrooms: Number,
    // yearBuilt: Number,
    // propertyDescription: String,
    // //2. Property Features and Amenities:
    // lotSize: String,
    // parkingAvailability: String,
    // appliancesIncluded: String,
    // heatingAndCoolingSystems: String,
    // flooringType: String,
    // exteriorFeatures: String,
    // communityAmenities: String,
    // //3. Media and Visuals:
    propertyPhotos: [],
    virtualToursOrVideos: [],
    floorPlans: [],
    propertyDocuments: [],
    // //4. Listing and Marketing Details:
    // listingStatus: String,
    // listingAgentOrTeam: String,
    // listingDate: String,
    // marketingDescription: String,
    // multipleListingService: String,
    // //5. Property History:
    // previousOwners: Number,
    // purchaseHistory: String,
    // //6. Financial Information:
    // propertyTaxes: String,
    // homeownersAssociation: String,
    // mortgageInformation: String,
    // //7. Contacts Associated with Property:
    // sellers: String,
    // buyers: String,
    // photo: String,
    // propertyManagers: String,
    // contractorsOrServiceProviders: String,
    // //8. Property Notes and Comments:
    // internalNotesOrComments: String,
    unitType: {
        type: [unitTypeSchema],
        default: [],
    },
    units: {
        type: [floorSchema],
        default: [],
    },
    deleted: {
        type: Boolean,
        default: false,
    },
    updatedDate: {
        type: Date,
        default: Date.now,
    },
    createdDate: {
        type: Date,
    },
    createBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
});

const initializePropertySchema = async () => {
    const schemaFieldsData = await fetchSchemaFields();
    schemaFieldsData[0]?.fields?.forEach((item) => {
        if (!propertySchema.path(item.name) && !propertySchema.nested[item.name]) propertySchema.add({ [item.name]: item?.backendType });
    });
};

propertySchema.index({ deleted: 1, category: 1, subtype: 1, transactionType: 1 });
propertySchema.index({ district: 1, neighborhood: 1 });
propertySchema.index({ 'price.amount': 1 });
propertySchema.index({ createdDate: -1 });
propertySchema.index({ 'sale.lead': 1 });
propertySchema.index({ 'sale.partnerCustomer': 1 });
propertySchema.index({ residence: 1 });
const Property = mongoose.model("Properties", propertySchema, "Properties");
module.exports = { Property, initializePropertySchema };
