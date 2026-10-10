const express = require('express');
const auth = require('../middelwares/auth');
const { adminOnly } = require('../middelwares/permissions');
const User = require('../model/schema/user');
const Share = require('../model/schema/recordShare');
const { shareableModules, modelFor } = require('../services/recordSharing');
const { createNotification, notificationLink } = require('../services/notifications');
const router = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
router.use(auth, adminOnly);
router.get('/users', asyncRoute(async (req, res) => {
  res.json(await User.find({ role: 'user', deleted: { $ne: true } }).select('_id firstName lastName username').sort({ firstName: 1, lastName: 1 }).lean());
}));
const existingRecord = async (module, recordId) => {
  if (!shareableModules.includes(module) || !validId(recordId)) return null;
  const query = module === 'Documents'
    ? { deleted: { $ne: true }, file: { $elemMatch: { _id: recordId, deleted: { $ne: true } } } }
    : { _id: recordId, deleted: { $ne: true } };
  const record = await modelFor(module).findOne(query).lean();
  return module === 'Documents' ? record?.file.find(file => String(file._id) === recordId) : record;
};
router.get('/:module/:recordId', asyncRoute(async (req, res) => {
  if (!await existingRecord(req.params.module, req.params.recordId)) return res.status(404).json({ code: 'notFound' });
  const shares = await Share.find({ module: req.params.module, recordId: req.params.recordId }).populate('recipient', 'firstName lastName username role deleted').lean();
  res.json(shares.filter(share => share.recipient?.role === 'user' && !share.recipient.deleted).map(share => ({ user: share.recipient, sharedAt: share.createdAt })));
}));
router.post('/', asyncRoute(async (req, res) => {
  const { module, recordId, recipientId } = req.body || {};
  if (!shareableModules.includes(module) || !validId(recordId) || !validId(recipientId)) return res.status(400).json({ code: 'invalid' });
  const [record, recipient] = await Promise.all([existingRecord(module, recordId), User.exists({ _id: recipientId, role: 'user', deleted: { $ne: true } })]);
  if (!record || !recipient) return res.status(404).json({ code: 'notFound' });
  const filter = { module, recordId, recipient: recipientId };
  let created = false;
  try {
    const result = await Share.updateOne(filter, { $setOnInsert: { ...filter, sharedBy: req.actor._id } }, { upsert: true, runValidators: true });
    created = !!result.upsertedId;
  } catch (error) { if (error.code !== 11000) throw error; }
  if (created) await createNotification({
    recipientId, actorId: req.actor._id, type: 'record_shared', module, entityId: recordId,
    message: String(record.title || record.leadName || record.opportunityName || record.fullName || record.companyName || record.subject || record.agenda || record.fileName || record.invoiceNumber || [record.firstName, record.lastName].filter(Boolean).join(' ') || module),
    link: module === 'Documents' ? '/documents?file=' + recordId : notificationLink(module, recordId),
  });
  res.status(created ? 201 : 200).json({ shared: true, created });
}));
router.delete('/:module/:recordId/:recipientId', asyncRoute(async (req, res) => {
  if (!shareableModules.includes(req.params.module) || !validId(req.params.recordId) || !validId(req.params.recipientId)) return res.status(400).json({ code: 'invalid' });
  await Share.deleteOne({ module: req.params.module, recordId: req.params.recordId, recipient: req.params.recipientId });
  res.json({ shared: false });
}));
module.exports = router;
