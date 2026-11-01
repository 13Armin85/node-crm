const Email = require('../../model/schema/email');
const mongoose = require('mongoose');
const { createAndSendEmail } = require('../../services/emailDelivery');

const add = async (req, res) => {
    try {
        const result = await createAndSendEmail(req);
        return res.status(200).json({ result });
    } catch (error) {
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return res.status(400).json({ code: 'invalid', field: error.path || Object.keys(error.errors || {})[0] });
        }
        const status = error.status || 500;
        if (status >= 500) console.error('Email submission failed:', error.code || error.name);
        return res.status(status).json({ code: error.code && error.status ? error.code : 'serverError', field: error.field });
    }
};
const index = async (req, res) => {
    try {
        const query = req.query;
        if (query.sender) {
            query.sender = new mongoose.Types.ObjectId(query.sender);
        }

        query.deleted = false;

        let result = await Email.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'Leads', pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Leads') }], // Assuming this is the collection name for 'leads'
                    localField: 'createByLead',
                    foreignField: '_id',
                    as: 'createByrefLead'
                }
            },
            {
                $lookup: {
                    from: 'Contacts', pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Contacts') }], // Assuming this is the collection name for 'contacts'
                    localField: 'createByContact',
                    foreignField: '_id',
                    as: 'createByRef'
                }
            },
            {
                $lookup: {
                    from: 'User',
                    localField: 'sender',
                    foreignField: '_id',
                    as: 'users'
                }
            },
            { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$createByRef', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$createByrefLead', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    senderName: { $concat: ['$users.firstName', ' ', '$users.lastName'] },
                    deleted: {
                        $cond: [
                            { $eq: ['$createByRef.deleted', false] },
                            '$createByRef.deleted',
                            { $ifNull: ['$createByrefLead.deleted', false] }
                        ]
                    },
                    createByName: {
                        $cond: {
                            if: '$createByRef',
                            then: { $concat: ['$createByRef.title', ' ', '$createByRef.firstName', ' ', '$createByRef.lastName'] },
                            else: { $concat: ['$createByrefLead.leadName'] }
                        }
                    },
                }
            },
            {
                $project: {
                    createByRef: 0,
                    createByrefLead: 0,
                    users: 0
                }
            },
        ]);

        res.status(200).json(result);
    } catch (err) {
        console.error('Failed :', err);
        res.status(400).json({ err, error: 'Failed ' });
    }
}

const view = async (req, res) => {
    try {
        let result = await Email.findOne({ _id: req.params.id })

        if (!result) return res.status(404).json({ message: "no Data Found." })

        let response = await Email.aggregate([
            { $match: { _id: result._id } },
            {
                $lookup: {
                    from: 'Leads', pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Leads') }], // Assuming this is the collection name for 'leads'
                    localField: 'createByLead',
                    foreignField: '_id',
                    as: 'createByrefLead'
                }
            },
            {
                $lookup: {
                    from: 'Contacts', pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Contacts') }], // Assuming this is the collection name for 'contacts'
                    localField: 'createByContact',
                    foreignField: '_id',
                    as: 'createByRef'
                }
            },
            {
                $lookup: {
                    from: 'User',
                    localField: 'sender',
                    foreignField: '_id',
                    as: 'users'
                }
            },
            {
                $lookup: {
                    from: 'User',
                    localField: 'salesAgent',
                    foreignField: '_id',
                    as: 'salesAgent'
                }
            },
            {
                $lookup: {
                    from: 'Properties', pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Properties') }],
                    localField: 'property',
                    foreignField: '_id',
                    as: 'properties'
                }
            },
            { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$createByRef', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$createByrefLead', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$salesAgent', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    senderEmail: '$users.username',
                    deleted: {
                        $cond: [
                            { $eq: ['$createByRef.deleted', false] },
                            '$createByRef.deleted',
                            { $ifNull: ['$createByrefLead.deleted', false] }
                        ]
                    },
                    createByName: {
                        $cond: {
                            if: '$createByRef',
                            then: { $concat: ['$createByRef.title', ' ', '$createByRef.firstName', ' ', '$createByRef.lastName'] },
                            else: { $concat: ['$createByrefLead.leadName'] }
                        }
                    },
                    salesAgentName: {
                        $cond: {
                            if: '$salesAgent',
                            then: { $concat: ['$salesAgent.firstName', ' ', '$salesAgent.lastName'] },
                            else: ''
                        }
                    },
                }
            },
            {
                $project: {
                    createByRef: 0,
                    createByrefLead: 0,
                    users: 0,
                    salesAgent: 0
                }
            },
        ])

        res.status(200).json(response[0])
    } catch (err) {
        console.error('Failed :', err);
        res.status(400).json({ err, error: 'Failed ' });
    }
}

const deleteData = async (req, res) => {
    const { objectId } = require('../../services/estateValidation');
    if (!objectId(req.params.id)) return res.status(400).json({ code: 'invalid', field: 'id' });
    try {
        const result = await Email.findOneAndUpdate({ _id: req.params.id, deleted: false,
            ...require('../../middelwares/permissions').scope(req, 'Emails') },
            { $set: { deleted: true } }, { new: true });
        if (!result) return res.status(404).json({ code: 'notFound' });
        return res.status(200).json({ result });
    } catch (_) { return res.status(500).json({ code: 'serverError' }); }
};

const deleteMany = async (req, res) => {
    const { objectId } = require('../../services/estateValidation');
    if (!Array.isArray(req.body) || !req.body.length || req.body.length > 100
        || req.body.some(id => !objectId(String(id)))) return res.status(400).json({ code: 'invalid' });
    try {
        const result = await Email.updateMany({ _id: { $in: req.body }, deleted: false,
            ...require('../../middelwares/permissions').scope(req, 'Emails') }, { $set: { deleted: true } });
        return res.status(200).json({ deletedCount: result.modifiedCount });
    } catch (_) { return res.status(500).json({ code: 'serverError' }); }
};

module.exports = { add, index, view, deleteData, deleteMany }
