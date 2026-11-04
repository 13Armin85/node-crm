const { readScope } = require('../../services/recordAccess');
const mongoose = require('mongoose');
const { Lead } = require('../../model/schema/lead');
const { Contact } = require('../../model/schema/contact');
const Email = require('../../model/schema/email');
const User = require('../../model/schema/user');
const Call = require('../../model/schema/phoneCall');
const { Property } = require('../../model/schema/property');
const TextMsg = require('../../model/schema/textMsg');
const Task = require('../../model/schema/task');
const PartnerCustomer = require('../../model/schema/partnerCustomer');
const Opportunity = require('../../model/schema/opprtunity');
const { dateRange, buildBuckets, aggregateTimeline } = require('../../services/reportTimeline');
const { reportTimeoutMS } = require('../../config/runtime');
const { databaseUnavailable, errorHandler } = require('../../middelwares/securityHeaders');

const getActor = (req) => req.actor || User.findOne({ _id: req.user.userId, deleted: false });

const index = async (req, res) => {
    try {
        const actor = await getActor(req);
        if (!actor) return res.status(401).json({ message: 'Authentication failed' });
        const users = await User.find({ deleted: false, ...(req.dataSubject ? { _id: req.dataSubject } : readScope(req, actor, 'Users')) })
            .select('_id firstName lastName username role').lean();
        const ids = users.map((user) => user._id);
        const [emails, calls, texts, tasks] = await Promise.all([
            Email.aggregate([{ $match: readScope(req, actor, 'Emails', { sender: { $in: ids }, deleted: { $ne: true } }) }, { $group: { _id: '$sender', count: { $sum: 1 } } }]),
            Call.aggregate([{ $match: readScope(req, actor, 'Calls', { sender: { $in: ids }, deleted: { $ne: true } }) }, { $group: { _id: '$sender', count: { $sum: 1 } } }]),
            TextMsg.aggregate([{ $match: readScope(req, actor, 'Texts', { sender: { $in: ids } }) }, { $group: { _id: '$sender', count: { $sum: 1 } } }]),
            Task.aggregate([{ $match: readScope(req, actor, 'Tasks', { deleted: false }) }, { $group: { _id: { $ifNull: ['$assignedToUser', '$createBy'] }, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } }]),
        ].map(query => query.option({ maxTimeMS: reportTimeoutMS })));
        const counts = [emails, calls, texts, tasks].map(rows => new Map(rows.map(row => [String(row._id), row])));
        const countFor = (index, id, key = 'count') => counts[index].get(String(id))?.[key] || 0;
        res.status(200).json(users.map((user) => ({
            ...user,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username,
            emailsent: countFor(0, user._id),
            outboundcall: countFor(1, user._id),
            textsent: countFor(2, user._id),
            tasks: countFor(3, user._id, 'total'),
            completedTasks: countFor(3, user._id, 'completed'),
        })));
    } catch (error) {
        if (databaseUnavailable(error)) return errorHandler(error, req, res, () => {});
        res.status(500).json({ message: 'Failed to load report', error: error.message });
    }
};

const lineChart = async (req, res) => {
    try {
        const actor = await getActor(req);
        if (!actor) return res.status(401).json({ message: 'Authentication failed' });
        const [leads, contacts, properties, opportunities, partners, tasks, completed] = await Promise.all([
            Lead.countDocuments(readScope(req, actor, 'Leads', { deleted: false })),
            Contact.countDocuments(readScope(req, actor, 'Contacts', { deleted: false })),
            Property.countDocuments(readScope(req, actor, 'Properties', { deleted: false })),
            Opportunity.countDocuments(readScope(req, actor, 'Opportunities', { deleted: false })),
            PartnerCustomer.countDocuments(readScope(req, actor, 'Partner Customers', { deleted: false })),
            Task.countDocuments(readScope(req, actor, 'Tasks', { deleted: false })),
            Task.countDocuments(readScope(req, actor, 'Tasks', { deleted: false, status: 'completed' })),
        ].map(query => query.maxTimeMS(reportTimeoutMS)));
        res.status(200).json([
            { name: 'Leads', length: leads, color: 'orange' },
            { name: 'Contacts', length: contacts, color: 'blue' },
            { name: 'Properties', length: properties, color: 'green' },
            { name: 'Opportunities', length: opportunities, color: 'purple' },
            { name: 'Partner Customers', length: partners, color: 'teal' },
            { name: 'Tasks', length: tasks, color: 'pink' },
            { name: 'Completed Tasks', length: completed, color: 'green' },
        ]);
    } catch (error) {
        if (databaseUnavailable(error)) return errorHandler(error, req, res, () => {});
        res.status(500).json({ message: 'Failed to load analytics', error: error.message });
    }
};

const data = async (req, res) => {
    try {
        const actor = await getActor(req);
        if (!actor) return res.status(401).json({ message: 'Authentication failed' });
        const range = dateRange(req.body);
        if (!range) {
            return res.status(400).json({ message: 'Invalid date range' });
        }
        const { start, end } = range;
        const weekly = req.body.filter === 'week';
        if (req.query.sender !== undefined && !/^[a-f\d]{24}$/i.test(String(req.query.sender))) return res.status(400).json({ code: 'invalid', field: 'sender' });
        const requestedSender = req.dataSubject || (mongoose.Types.ObjectId.isValid(req.query.sender)
            ? new mongoose.Types.ObjectId(req.query.sender) : null);
        const match = { timestamp: { $gte: start, $lte: end }, deleted: { $ne: true } };
        if (requestedSender) match.sender = requestedSender;
        const textMatch = { timestamp: match.timestamp };
        if (requestedSender) textMatch.sender = requestedSender;
        const [emails, calls, texts] = await Promise.all([
            aggregateTimeline(Email, readScope(req, actor, 'Emails', match), weekly),
            aggregateTimeline(Call, readScope(req, actor, 'Calls', match), weekly),
            aggregateTimeline(TextMsg, readScope(req, actor, 'Texts', textMatch), weekly),
        ]);
        const buckets = buildBuckets(start, end, weekly);
        res.status(200).json({
            Email: [{ totalEmails: emails.total, Emails: buckets.map((date) => ({ date, Emailcount: emails.counts.get(date) || 0 })) }],
            Call: [{ totalCall: calls.total, Calls: buckets.map((date) => ({ date, Callcount: calls.counts.get(date) || 0 })) }],
            Text: [{ totalTextSent: texts.total, TextMessages: buckets.map((date) => ({ date, TextSentCount: texts.counts.get(date) || 0 })) }],
        });
    } catch (error) {
        if (databaseUnavailable(error)) return errorHandler(error, req, res, () => {});
        res.status(500).json({ message: 'Failed to build chart', error: error.message });
    }
};

module.exports = { index, lineChart, data };
