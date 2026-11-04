const router = require('express').Router();
const { loadUser } = require('../middelwares/permissions');
const { loadRecord, error } = require('../services/recordWorkspace');
const Note = require('../model/schema/recordNote');
const { objectId } = require('../services/estateValidation');
router.use(require('../middelwares/auth'), loadUser);
const run = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
router.use(async (req, res, next) => {
  try { req.recordShares ||= await require('../services/recordSharing').loadShares(req.actor); next(); } catch (err) { next(err); }
});
router.get('/:module/:id', run(async (req, res) => {
  const { moduleName, record, editable } = await loadRecord(req, req.params.module, req.params.id);
  if (moduleName === 'Users') for (const key of ['password', 'authVersion', 'moduleVisibility', 'avatarFilename']) delete record[key];
  const definition = await require('../services/formDefinitions').getDefinition(moduleName);
  const { get, set } = require('../services/estateValidation');
  for (const field of definition?.fields || []) {
    if (!['date', 'datetime'].includes(field.type)) continue;
    const path = field.kind === 'CUSTOM_FIELD' ? 'customFields.' + field.name : field.name;
    const value = get(record, path);
    const date = value instanceof Date ? value : /^\d{10,13}$/.test(String(value)) ? new Date(Number(value)) : null;
    if (date && Number.isFinite(date.getTime())) set(record, path, date.toISOString());
  }
  const metadata = await require('../model/schema/customField').findOne({ moduleName, deleted: false }).select('_id').lean();
  res.json({ record, definition, editable, legacyModuleId: metadata?._id });
}));
// These activity pages historically had no update endpoint. Editing an existing
// activity changes its stored details and never re-sends an email or makes a call.
router.put('/:module/:id', run(async (req, res) => {
  if (!['Calls', 'Emails'].includes(req.params.module)) throw error('notFound', 404);
  const { record, editable, moduleName } = await loadRecord(req, req.params.module, req.params.id);
  if (!editable) throw error('forbidden', 403);
  const definition = await require('../services/formDefinitions').getDefinition(moduleName);
  const { get, set, validateFields } = require('../services/estateValidation');
  const body = { ...record, ...req.body, customFields: { ...record.customFields, ...req.body.customFields } };
  for (const field of definition.fields) {
    const path = field.kind === 'CUSTOM_FIELD' ? 'customFields.' + field.name : field.name;
    let value = get(body, path);
    if (value == null || value === '') continue;
    if (field.relation) value = Array.isArray(value) ? value.map(String) : String(value);
    else if (['number', 'currency'].includes(field.type)) value = Number(value);
    else if (value instanceof Date) value = value.toISOString();
    else if (['date', 'datetime'].includes(field.type) && /^\d{10,13}$/.test(String(value))) value = new Date(Number(value)).toISOString();
    set(body, path, value);
  }
  const values = validateFields(definition, body, record);
  for (const key of ['_id', 'createBy', 'deleted', 'createdDate', 'conversion']) delete values[key];
  const Model = require('../services/recordSharing').modelFor(moduleName);
  const updated = await Model.findByIdAndUpdate(record._id, { $set: values }, { new: true, runValidators: true });
  await require('../services/notifications').notifyRecordActivity({ module: moduleName, record: updated, previous: record, actorId: req.actor._id });
  res.json(updated);
}));
const accessNotes = async req => {
  if (!['Contacts', 'Opportunities'].includes(req.params.module)) throw error('notFound', 404);
  return loadRecord(req, req.params.module, req.params.id);
};
router.get('/:module/:id/notes', run(async (req, res) => {
  await accessNotes(req);
  if (req.query.before && !objectId(req.query.before)) throw error('invalid');
  const match = { module: req.params.module, record: req.params.id };
  if (req.query.before) {
    const cursor = await Note.findOne({ ...match, _id: req.query.before }).select('createdAt').lean();
    if (!cursor) throw error('invalid');
    match.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }];
  }
  const notes = await Note.find(match).sort({ createdAt: -1, _id: -1 }).limit(51)
    .populate('author', 'firstName lastName username jobTitle department avatarVersion').lean();
  const more = notes.length > 50; const items = notes.slice(0, 50).reverse();
  res.json({ items, before: more ? String(items[0]._id) : null });
}));
router.post('/:module/:id/notes', run(async (req, res) => {
  await accessNotes(req);
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
  const clientId = req.body.clientId;
  if (!text || text.length > 10000 || typeof clientId !== 'string' || !/^[\w-]{1,100}$/.test(clientId)) throw error('invalid');
  const key = { module: req.params.module, record: req.params.id, author: req.actor._id, clientId };
  let note;
  const authorName = [req.actor.firstName, req.actor.lastName].filter(Boolean).join(' ') || req.actor.username;
  try { note = await Note.findOneAndUpdate(key, { $setOnInsert: { ...key, text, authorName } }, { upsert: true, new: true, runValidators: true }); }
  catch (err) { if (err.code !== 11000) throw err; note = await Note.findOne(key); }
  await note.populate('author', 'firstName lastName username jobTitle department avatarVersion');
  res.status(201).json(note);
}));
router.use((err, req, res, next) => res.status(err.status || 500).json({ code: err.code || 'serverError' }));
module.exports = router;
