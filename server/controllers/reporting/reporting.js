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

const getActor = (req) => User.findOne({ _id: req.user.userId, deleted: false });

const index = async (req, res) => {
    try {
        const actor = await getActor(req);
        if (!actor) return res.status(401).json({ message: 'Authentication failed' });
        const users = await User.find(actor.role === 'admin' ? { deleted: false } : { _id: actor._id, deleted: false })
            .select('_id firstName lastName username role').lean();
        const ids = users.map((user) => user._id);
        const [emails, calls, texts, tasks] = await Promise.all([
            Email.aggregate([{ $match: { sender: { $in: ids }, deleted: { $ne: true } } }, { $group: { _id: '$sender', count: { $sum: 1 } } }]),
            Call.aggregate([{ $match: { sender: { $in: ids }, deleted: { $ne: true } } }, { $group: { _id: '$sender', count: { $sum: 1 } } }]),
            TextMsg.aggregate([{ $match: { sender: { $in: ids } } }, { $group: { _id: '$sender', count: { $sum: 1 } } }]),
            Task.aggregate([{ $match: { assignedToUser: { $in: ids }, deleted: false } }, { $group: { _id: '$assignedToUser', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } }]),
        ]);
        const countFor = (rows, id, key = 'count') => rows.find((row) => String(row._id) === String(id))?.[key] || 0;
        res.status(200).json(users.map((user) => ({
            ...user,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username,
            emailsent: countFor(emails, user._id),
            outboundcall: countFor(calls, user._id),
            textsent: countFor(texts, user._id),
            tasks: countFor(tasks, user._id, 'total'),
            completedTasks: countFor(tasks, user._id, 'completed'),
        })));
    } catch (error) {
        res.status(500).json({ message: 'Failed to load report', error: error.message });
    }
};

const lineChart = async (req, res) => {
    try {
        const actor = await getActor(req);
        if (!actor) return res.status(401).json({ message: 'Authentication failed' });
        const own = actor.role === 'admin' ? {} : { createBy: actor._id };
        const taskScope = actor.role === 'admin' ? {} : { assignedToUser: actor._id };
        const [leads, contacts, properties, opportunities, partners, tasks, completed] = await Promise.all([
            Lead.countDocuments({ ...own, deleted: false }),
            Contact.countDocuments({ ...own, deleted: false }),
            Property.countDocuments({ ...own, deleted: false }),
            Opportunity.countDocuments({ ...own, deleted: false }),
            PartnerCustomer.countDocuments({ ...own, deleted: false }),
            Task.countDocuments({ ...taskScope, deleted: false }),
            Task.countDocuments({ ...taskScope, deleted: false, status: 'completed' }),
        ]);
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
        res.status(500).json({ message: 'Failed to load analytics', error: error.message });
    }
};

const startOfWeek = (date) => {
    const result = new Date(date);
    const day = result.getUTCDay() || 7;
    result.setUTCDate(result.getUTCDate() - day + 1);
    result.setUTCHours(0, 0, 0, 0);
    return result;
};

const dateKey = (value, weekly) => {
    const date = weekly ? startOfWeek(value) : new Date(value);
    return date.toISOString().slice(0, 10);
};

const buildBuckets = (start, end, weekly) => {
    const buckets = [];
    const cursor = weekly ? startOfWeek(start) : new Date(start);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor <= end) {
        buckets.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + (weekly ? 7 : 1));
    }
    return buckets;
};

const countTimeline = (rows, buckets, weekly) => {
    const counts = Object.fromEntries(buckets.map((key) => [key, 0]));
    rows.forEach((row) => {
        const key = dateKey(row.timestamp, weekly);
        if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
    });
    return counts;
};

const data = async (req, res) => {
    try {
        const actor = await getActor(req);
        if (!actor) return res.status(401).json({ message: 'Authentication failed' });
        const start = new Date(`${req.body.startDate}T00:00:00.000Z`);
        const end = new Date(`${req.body.endDate}T23:59:59.999Z`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
            return res.status(400).json({ message: 'Invalid date range' });
        }
        const requestedSender = actor.role === 'admin' && mongoose.Types.ObjectId.isValid(req.query.sender)
            ? new mongoose.Types.ObjectId(req.query.sender)
            : actor.role === 'admin' ? null : actor._id;
        const match = { timestamp: { $gte: start, $lte: end }, deleted: { $ne: true } };
        if (requestedSender) match.sender = requestedSender;
        const textMatch = { timestamp: match.timestamp };
        if (requestedSender) textMatch.sender = requestedSender;
        const [emails, calls, texts] = await Promise.all([
            Email.find(match).select('timestamp').lean(),
            Call.find(match).select('timestamp').lean(),
            TextMsg.find(textMatch).select('timestamp').lean(),
        ]);
        const weekly = req.body.filter === 'week';
        const buckets = buildBuckets(start, end, weekly);
        const emailCounts = countTimeline(emails, buckets, weekly);
        const callCounts = countTimeline(calls, buckets, weekly);
        const textCounts = countTimeline(texts, buckets, weekly);
        res.status(200).json({
            Email: [{ totalEmails: emails.length, Emails: buckets.map((date) => ({ date, Emailcount: emailCounts[date] })) }],
            Call: [{ totalCall: calls.length, Calls: buckets.map((date) => ({ date, Callcount: callCounts[date] })) }],
            Text: [{ totalTextSent: texts.length, TextMessages: buckets.map((date) => ({ date, TextSentCount: textCounts[date] })) }],
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to build chart', error: error.message });
    }
};

module.exports = { index, lineChart, data };
