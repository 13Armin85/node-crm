const mongoose = require('mongoose');
const { notifyRecordActivity, idOf } = require('../services/notifications');

const modelNames = { Documents: 'Document', 'Email Template': 'EmailTemps' };
const documentsIn = body => {
    if (Array.isArray(body)) return body.filter(item => idOf(item?._id));
    if (idOf(body?._id)) return [body];
    for (const key of ['data', 'result', 'folder', 'meeting']) {
        if (body?.[key]) return documentsIn(body[key]);
    }
    return [];
};

// Decorate only authenticated mutation handlers; preserve their response contracts.
// Notification metadata comes from persisted records, never the unvalidated request body.
module.exports = moduleName => (type, handler, { embeddedFile = false, createdStatus } = {}) => async (req, res, next) => {
    const Model = mongoose.models[modelNames[moduleName] || moduleName];
    let previous = [];
    const ids = Array.isArray(req.body) ? req.body : req.body?.ids;
    try {
        if (Model && idOf(req.params.id)) {
            const record = await Model.findOne(embeddedFile ? { 'file._id': req.params.id, deleted: false } : { _id: req.params.id, deleted: false }).lean();
            if (record) previous = [record];
        } else if (Model && Array.isArray(ids)) {
            previous = await Model.find({ _id: { $in: ids.filter(idOf) }, deleted: false }).lean();
        }
    } catch (error) {
        console.error('Notification snapshot failed:', error.message);
    }

    const originalJson = res.json;
    const originalSend = res.send;
    let captured;
    const capture = method => function (body) {
        captured = { method, body };
        return res;
    };
    res.json = capture('json');
    res.send = capture('send');
    try {
        await handler(req, res, next);
    } catch (error) {
        res.json = originalJson;
        res.send = originalSend;
        return next(error);
    }
    res.json = originalJson;
    res.send = originalSend;
    if (!captured || res.headersSent) return;
    const { body } = captured;
    if (res.statusCode >= 200 && res.statusCode < 300 && body !== null && body?.success !== false
        && !body?.error && (!createdStatus || res.statusCode === createdStatus)) {
        try {
            let records = documentsIn(body);
            if (type === 'record_deleted') {
                // Confirm which rows were actually deleted before notifying their owners.
                if (previous.length && Model && !embeddedFile) {
                    const remaining = await Model.find({ _id: { $in: previous.map(item => item._id) }, deleted: false }).select('_id').lean();
                    const activeIds = new Set(remaining.map(item => String(item._id)));
                    records = previous.filter(item => !activeIds.has(String(item._id)));
                } else if (embeddedFile) records = previous;
            } else if (Model && previous.length) {
                records = await Model.find({ _id: { $in: previous.map(item => item._id) } }).lean();
            }
            const byId = new Map(previous.map(item => [String(item._id), item]));
            // Ignore zero-match/no-op update responses.
            const result = body?.result || body;
            if (result?.matchedCount !== 0 && result?.modifiedCount !== 0) {
                await Promise.all(records.map(record => notifyRecordActivity({
                    module: moduleName, record, previous: byId.get(String(record._id)),
                    actorId: req.user?.userId, type,
                })));
            }
        } catch (error) {
            console.error('Activity notification failed:', error.message);
        }
    }
    return (captured.method === 'json' ? originalJson : originalSend).call(res, body);
};
