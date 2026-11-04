const { isAdmin } = require('../../services/userRoles');
const Opprtunities = require('../../model/schema/opprtunity')
const User = require('../../model/schema/user')
const mongoose = require('mongoose');
const { syncOpportunity, unlinkOpportunity } = require('../../services/relationshipSync');

const metrics = require('../../services/opportunityMetrics');
const definition = () => require('../../services/formDefinitions').getDefinition('Opportunities');
const add = async (req, res) => {
    try {
        const result = new Opprtunities(metrics.normalizeOpportunity(req.body, {}, await definition(), true));
        await result.save();
        await syncOpportunity(result);
        res.status(200).json(result);
    } catch (err) {
        console.error('Failed to create :', err);
        res.status(400).json({ code: err.code || 'invalid', field: err.field });
    }
}
const addMany = async (req, res) => {
    try {
        const data = req.body.map((item) => ({
            ...item,
            account: item.account ? item.account : null
        }))
        const configured = await definition();
        const insertedOppotunity = await Opprtunities.insertMany(data.map(item => metrics.normalizeOpportunity(item, {}, configured, true)));

        res.status(200).json(insertedOppotunity);
    } catch (err) {
        console.error('Failed to create Opprtunities :', err);
        res.status(400).json({ code: err.code || 'invalid', field: err.field });
    }
};
const index = async (req, res) => {
    try {
        const query = req.query
        query.deleted = false;


        const result = await Opprtunities.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'User',
                    localField: 'createBy',
                    foreignField: '_id',
                    as: 'users'
                }
            },
            {
                $lookup: {
                    from: 'User',
                    localField: 'assignUser',
                    foreignField: '_id',
                    as: 'assignUsers'
                }
            },
            {
                $lookup: {
                    from: 'User',
                    localField: 'modifiedBy',
                    foreignField: '_id',
                    as: 'modifiedByUser'
                }
            },
            {
                $lookup: {
                    from: "PartnerCustomers", pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Partner Customers') }],
                    localField: 'accountName',
                    foreignField: '_id',
                    as: 'accountData'
                }
            },
            { $lookup: { from: 'Contacts', pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Contacts') }], localField: 'contact', foreignField: '_id', as: 'contactData' } },
            { $lookup: { from: 'Leads', pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Leads') }], localField: 'lead', foreignField: '_id', as: 'leadData' } },
            { $lookup: { from: 'Properties', pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Properties') }], localField: 'properties', foreignField: '_id', as: 'propertyData' } },
            { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$assignUsers', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$modifiedByUser', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$accountData', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$contactData', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$leadData', preserveNullAndEmptyArrays: true } },

            // { $match: { 'assignUsers.deleted': false } },

            {
                $addFields: {
                    createdByName: { $concat: ['$users.firstName', ' ', '$users.lastName'] },
                    // assignUserName: { $concat: ['$assignUsers.firstName', ' ', '$assignUsers.lastName'] },
                    assignUserName: {
                        $cond: {
                            if: '$assignUsers',
                            then: { $concat: ['$assignUsers.firstName', ' ', '$assignUsers.lastName'] },
                            else: { $concat: [''] }
                        }
                    },
                    modifiedUserName: { $concat: ['$modifiedByUser.firstName', ' ', '$modifiedByUser.lastName'] },
                    accountName2: { $ifNull: ['$accountData.companyName', '$accountData.fullName'] },
                    contactName: { $ifNull: ['$contactData.fullName', { $trim: { input: { $concat: [{ $ifNull: ['$contactData.firstName', ''] }, ' ', { $ifNull: ['$contactData.lastName', ''] }] } } }] },
                    leadName: '$leadData.leadName',
                    leadStage: { $ifNull: ['$leadStage', { $ifNull: ['$leadData.leadState', { $ifNull: ['$leadData.leadStatus', { $ifNull: [{ $arrayElemAt: ['$contactData.convertedLeads.values.leadState', 0] }, { $ifNull: [{ $arrayElemAt: ['$contactData.convertedLeads.values.leadStatus', 0] }, '$contactData.state'] }] }] }] }] },
                    propertyNames: '$propertyData.title'
                }
            },
            {
                $project: {
                    users: 0,
                    assignUsers: 0,
                    modifiedByUser: 0,
                    accountData: 0,
                    contactData: 0,
                    leadData: 0,
                    propertyData: 0,
                }
            },
        ]);

        const configured = await definition();
        res.status(200).json(result.map(record => metrics.decorateOpportunity(record, configured)));
    } catch (err) {
        console.error('Failed :', err);
        res.status(400).json({ err, error: 'Failed ' });
    }
}

const view = async (req, res) => {
    try {
        let result = await Opprtunities.findOne({ _id: req.params.id })
        if (!result) return res.status(404).json({ message: "no Data Found." })

        let response = await Opprtunities.aggregate([
            { $match: { _id: result._id } },
            {
                $lookup: {
                    from: 'User',
                    localField: 'createBy',
                    foreignField: '_id',
                    as: 'users'
                }
            },
            {
                $lookup: {
                    from: 'User',
                    localField: 'assignUser',
                    foreignField: '_id',
                    as: 'assignUsers'
                }
            },
            {
                $lookup: {
                    from: 'User',
                    localField: 'modifiedBy',
                    foreignField: '_id',
                    as: 'modifiedByUser'
                }
            },
            {
                $lookup: {
                    from: "PartnerCustomers", pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Partner Customers') }],
                    localField: 'accountName',
                    foreignField: '_id',
                    as: 'accountData'
                }
            },
            { $lookup: { from: 'Contacts', pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Contacts') }], localField: 'contact', foreignField: '_id', as: 'contactData' } },
            { $lookup: { from: 'Leads', pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Leads') }], localField: 'lead', foreignField: '_id', as: 'leadData' } },
            { $lookup: { from: 'Properties', pipeline: [{ $match: require('../../services/moduleVisibility').lookupScope(req, 'Properties') }], localField: 'properties', foreignField: '_id', as: 'propertyData' } },
            { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$assignUsers', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$modifiedByUser', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$accountData', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$contactData', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$leadData', preserveNullAndEmptyArrays: true } },


            // { $match: { 'assignUsers.deleted': false } },

            {
                $addFields: {
                    createdByName: { $concat: ['$users.firstName', ' ', '$users.lastName'] },
                    // assignUserName: { $concat: ['$assignUsers.firstName', ' ', '$assignUsers.lastName'] },
                    assignUserName: {
                        $cond: {
                            if: '$assignUsers',
                            then: { $concat: ['$assignUsers.firstName', ' ', '$assignUsers.lastName'] },
                            else: { $concat: [''] }
                        }
                    },
                    modifiedUserName: { $concat: ['$modifiedByUser.firstName', ' ', '$modifiedByUser.lastName'] },
                    accountName2: { $ifNull: ['$accountData.companyName', '$accountData.fullName'] },
                    contactName: { $ifNull: ['$contactData.fullName', { $trim: { input: { $concat: [{ $ifNull: ['$contactData.firstName', ''] }, ' ', { $ifNull: ['$contactData.lastName', ''] }] } } }] },
                    leadName: '$leadData.leadName',
                    leadStage: { $ifNull: ['$leadStage', { $ifNull: ['$leadData.leadState', { $ifNull: ['$leadData.leadStatus', { $ifNull: [{ $arrayElemAt: ['$contactData.convertedLeads.values.leadState', 0] }, { $ifNull: [{ $arrayElemAt: ['$contactData.convertedLeads.values.leadStatus', 0] }, '$contactData.state'] }] }] }] }] },
                    propertyNames: '$propertyData.title'
                }
            },
            {
                $project: {
                    users: 0,
                    assignUsers: 0,
                    modifiedByUser: 0,
                    accountData: 0,
                    contactData: 0,
                    leadData: 0,
                    propertyData: 0,
                }
            },
        ])

        res.status(200).json(metrics.decorateOpportunity(response[0], await definition()))
    } catch (err) {
        console.error('Failed :', err);
        res.status(400).json({ err, error: 'Failed ' });
    }
}
const edit = async (req, res) => {
    try {

        const previous = await Opprtunities.findById(req.params.id).lean();
        const payload = metrics.normalizeOpportunity(req.body, previous || {}, await definition());
        let result = await Opprtunities.findOneAndUpdate(
            { _id: req.params.id },
            { $set: payload },
            { new: true, runValidators: true }
        );
        if (result) await syncOpportunity(result);

        res.status(200).json(result);
    } catch (err) {
        console.error('Failed to create Opprtunities:', err);
        res.status(400).json({ code: err.code || 'invalid', field: err.field });
    }
}
const deleteData = async (req, res) => {
    try {
        const result = await Opprtunities.findByIdAndUpdate(req.params.id, { deleted: true });
        if (result) await unlinkOpportunity(result._id);
        res.status(200).json({ message: "done", result: result })
    } catch (err) {
        res.status(404).json({ message: "error", err })
    }
}

const deleteMany = async (req, res) => {
    try {
        const result = await Opprtunities.updateMany({ _id: { $in: req.body } }, { $set: { deleted: true } });
        await Promise.all((req.body || []).map(unlinkOpportunity));
        res.status(200).json({ message: "done", result })
    } catch (err) {
        res.status(404).json({ message: "error", err })
    }
}

const changeStage = async (req, res) => {
    try {
        const definition = await require('../../services/formDefinitions').getDefinition('Opportunities');
        const stages = definition.fields.find(field => field.name === 'salesStage')?.options || [];
        if (!stages.some(stage => stage.value === req.body.salesStage)) return res.status(400).json({ code: 'invalid', field: 'salesStage' });
        const previous = await Opprtunities.findById(req.params.id).lean();
        const changes = metrics.normalizeOpportunity({ salesStage: req.body.salesStage }, previous || {}, definition);
        const result = await Opprtunities.findByIdAndUpdate(req.params.id, { $set: {
            ...changes, modifiedBy: req.actor._id, modifiedDate: new Date(),
        } }, { new: true, runValidators: true });
        res.status(200).json(result);
    } catch (error) { res.status(400).json({ code: 'invalid', field: 'salesStage' }); }
};

module.exports = {
    changeStage, add, index, view, deleteData, edit, deleteMany, addMany }
