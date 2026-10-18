const { readScope, readActor } = require('../../services/recordAccess');
const { isAdmin } = require('../../services/userRoles');
const Invoices = require("../../model/schema/invoices.js");
const mongoose = require("mongoose");
const User = require('../../model/schema/user')
const Quotes = require("../../model/schema/quotes.js");



async function getNextAutoIncrementValue() {
    const num = await Invoices.countDocuments({});
    return num + 1;
}

const index = async (req, res) => {
    const query = req.query;
    query.deleted = false;
    try {
        let result = await Invoices.aggregate([
            { $match: query },
            { $lookup: { from: "Properties", pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Properties') }], localField: "property", foreignField: "_id", as: "propertyData" } },
            { $addFields: { propertyName: { $ifNull: [{ $arrayElemAt: ['$propertyData.title', 0] }, { $arrayElemAt: ['$propertyData.name', 0] }] } } },
            { $project: { propertyData: 0 } },
            {
                $lookup: {
                    from: "Contacts", pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Contacts') }],
                    localField: "contact",
                    foreignField: "_id",
                    as: "contactData",
                },
            },
            {
                $lookup: {
                    from: "PartnerCustomers", pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Partner Customers') }],
                    localField: "account",
                    foreignField: "_id",
                    as: "accountData",
                },
            },
            {
                $lookup: {
                    from: "User",
                    localField: "createBy",
                    foreignField: "_id",
                    as: "users",
                },
            },
            {
                $lookup: {
                    from: "User",
                    localField: "modifiedBy",
                    foreignField: "_id",
                    as: "modifiedByUser",
                },
            },
            {
                $lookup: {
                    from: "User",
                    localField: "assignedTo",
                    foreignField: "_id",
                    as: "assignedToData",
                },
            },
            { $unwind: { path: "$users", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$contactData", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$accountData", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$modifiedByUser', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$assignedToData", preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    assignUserName: {
                        $cond: {
                            if: '$assignUsers',
                            then: { $concat: ['$assignUsers.firstName', ' ', '$assignUsers.lastName'] },
                            else: { $concat: [''] }
                        }
                    },
                    createdByName: { $concat: ['$users.firstName', ' ', '$users.lastName'] },
                    modifiedUserName: { $concat: ['$modifiedByUser.firstName', ' ', '$modifiedByUser.lastName'] },
                    contactName: { $concat: ['$contactData.firstName', ' ', '$contactData.lastName'] },
                    accountName: { $ifNull: ['$accountData.companyName', '$accountData.fullName'] }
                }
            },
            { $project: { users: 0, contactData: 0, accountData: 0, modifiedByUser: 0, assignedToData: 0 } },
        ]);
        res.send(result.map(invoice => ({ ...invoice, ...require('../../services/invoiceAmounts').invoiceDisplayAmounts(invoice) })));
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
    }
};

const add = async (req, res) => {
    try {
        const nextAutoIncrementValue = await getNextAutoIncrementValue();
        const values = require('../../services/invoiceAmounts').normalizeInvoiceAmounts(req.body);
        const result = new Invoices({ ...values, invoiceNumber: nextAutoIncrementValue });
        await result.save();
        res.status(200).json(result);
    } catch (err) {
        console.error("Failed to create Invoices:", err);
        res.status(400).json({ code: err.code || "invalid", field: err.field, error: "Failed to create Invoices" });
    }
};

const edit = async (req, res) => {
    try {

        let result = await Invoices.findOneAndUpdate(
            { _id: req.params.id },
            { $set: req.body },
            { new: true }
        );

        res.status(200).json(result);
    } catch (err) {
        console.error("Failed to create Invoices:", err);
        res.status(400).json({ code: err.code || "invalid", field: err.field, error: "Failed to update Invoices" });
    }
};
const addMany = async (req, res) => {
    try {
        const data = req.body.map((item) => ({
            ...require('../../services/invoiceAmounts').normalizeInvoiceAmounts(item),
            account: item.account ? item.account : null,
            contact: item.contact ? item.contact : null,
        }))
        for (const item of data) await require('../../services/invoiceProperty').validateInvoiceProperty(req, item);
        const inserted = await Invoices.insertMany(data);

        res.status(200).json(inserted);
    } catch (err) {
        console.error('Failed to create Invoices :', err);
        res.status(400).json({ code: err.code || 'invalid', field: err.field, error: 'Failed to create Invoices' });
    }
};
const view = async (req, res) => {
    try {
        let response = await Invoices.findOne({ _id: req.params.id });
        if (!response) return res.status(404).json({ message: "no Data Found." });
        let result = await Invoices.aggregate([
            { $match: { _id: response._id } },
            { $lookup: { from: "Properties", pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Properties') }], localField: "property", foreignField: "_id", as: "propertyData" } },
            { $addFields: { propertyName: { $ifNull: [{ $arrayElemAt: ['$propertyData.title', 0] }, { $arrayElemAt: ['$propertyData.name', 0] }] } } },
            { $project: { propertyData: 0 } },
            {
                $lookup: {
                    from: "Opportunities",
                    pipeline: [{ $match: readScope(req, req.actor, "Opportunities", { deleted: false }) }],
                    localField: "oppotunity",
                    foreignField: "_id",
                    as: "oppotunityData",
                },
            },
            {
                $lookup: {
                    from: "Contacts", pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Contacts') }],
                    localField: "contact",
                    foreignField: "_id",
                    as: "contactData",
                },
            },
            {
                $lookup: {
                    from: "PartnerCustomers", pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Partner Customers') }],
                    localField: "account",
                    foreignField: "_id",
                    as: "accountData",
                },
            },
            {
                $lookup: {
                    from: "User",
                    localField: "createBy",
                    foreignField: "_id",
                    as: "users",
                },
            },
            {
                $lookup: {
                    from: "User",
                    localField: "modifiedBy",
                    foreignField: "_id",
                    as: "modifiedByUser",
                },
            },
            {
                $lookup: {
                    from: "User",
                    localField: "assignedTo",
                    foreignField: "_id",
                    as: "assignedToData",
                },
            },
            { $unwind: { path: "$users", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$contactData", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$accountData", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$modifiedByUser', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$assignedToData", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$oppotunityData", preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    assignUserName: {
                        $cond: {
                            if: '$assignedToData',
                            then: { $concat: ['$assignedToData.firstName', ' ', '$assignedToData.lastName'] },
                            else: { $concat: [''] }
                        }
                    },
                    oppotunityName: '$oppotunityData.opportunityName',
                    createdByName: { $concat: ['$users.firstName', ' ', '$users.lastName'] },
                    modifiedUserName: { $concat: ['$modifiedByUser.firstName', ' ', '$modifiedByUser.lastName'] },
                    contactName: { $concat: ['$contactData.firstName', ' ', '$contactData.lastName'] },
                    accountName: { $ifNull: ['$accountData.companyName', '$accountData.fullName'] }
                }
            },
            { $project: { users: 0, contactData: 0, accountData: 0, modifiedByUser: 0, oppotunityData: 0, assignedToData: 0 } },
        ]);
        let quotesDetails = await Quotes.aggregate([
            { $match: readScope(req, req.actor, 'Quotes', { _id: response.quotesId, deleted: false }) },
            {
                $lookup: {
                    from: "Contacts", pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Contacts') }],
                    localField: "contact",
                    foreignField: "_id",
                    as: "contactData",
                },
            },
            {
                $lookup: {
                    from: "PartnerCustomers", pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Partner Customers') }],
                    localField: "account",
                    foreignField: "_id",
                    as: "accountData",
                },
            },
            { $unwind: { path: "$contactData", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$accountData", preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    contactName: { $concat: ['$contactData.firstName', ' ', '$contactData.lastName'] },
                    accountName: { $ifNull: ['$accountData.companyName', '$accountData.fullName'] }
                }
            },
            { $project: { contactData: 0, accountData: 0 } },

        ]);

        res.status(200).json({ result: result[0] ? { ...result[0], ...require('../../services/invoiceAmounts').invoiceDisplayAmounts(result[0]) } : null, quotesDetails });
    } catch (err) {
        console.log("Error:", err);
        res.status(400).json({ Error: err });
    }
};

const deleteData = async (req, res) => {
    try {
        const result = await Invoices.findByIdAndUpdate(req.params.id, {
            deleted: true,
        });
        res.status(200).json({ message: "done", result });
    } catch (err) {
        res.status(404).json({ message: "error", err });
    }
};

const deleteMany = async (req, res) => {
    try {
        const result = await Invoices.updateMany(
            { _id: { $in: req.body } },
            { $set: { deleted: true } }
        );

        if (result?.matchedCount > 0 && result?.modifiedCount > 0) {
            return res
                .status(200)
                .json({ message: "Invoices Removed successfully", result });
        } else {
            return res
                .status(404)
                .json({ success: false, message: "Failed to remove Invoices" });
        }
    } catch (err) {
        return res.status(404).json({ success: false, message: "error", err });
    }
};

module.exports = { index, add, edit, addMany, view, deleteData, deleteMany };
