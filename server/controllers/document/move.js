const Document = require('../../model/schema/document');
const { isAdmin } = require('../../services/userRoles');
const validId = require('../../services/estateValidation').objectId;

// Serialize moves in the application's single backend process, including cycle checks.
let pendingMove = Promise.resolve();
const serialize = handler => (req, res, next) => {
  const result = pendingMove.then(() => handler(req, res));
  pendingMove = result.catch(() => {});
  return result.catch(next);
};
const ownership = req => isAdmin(req.actor) ? {} : { createBy: req.actor._id };
const destinationId = req => req.body?.folderId == null || req.body.folderId === '' ? null : req.body.folderId;
const invalid = (res, code = 'invalid', field = 'folderId') => res.status(400).json({ code, field });

const moveFile = serialize(async (req, res) => {
  const folderId = destinationId(req);
  if (!validId(req.params.id) || (folderId !== null && !validId(folderId))) return invalid(res);
  const source = await Document.findOne({ ...ownership(req), deleted: false,
    file: { $elemMatch: { _id: req.params.id, deleted: { $ne: true } } } }).lean();
  if (!source) return res.status(404).json({ code: 'notFound' });
  const file = source.file.find(item => String(item._id) === req.params.id);
  let destination;
  if (folderId) {
    destination = await Document.findOne({ _id: folderId, createBy: source.createBy, isRoot: { $ne: true }, deleted: false }).lean();
    if (!destination) return res.status(404).json({ code: 'notFound', field: 'folderId' });
  } else {
    destination = await Document.findOne({ createBy: source.createBy, isRoot: true, deleted: false }).lean();
    if (!destination) destination = (await Document.create({ folderName: '__ROOT__', createBy: source.createBy, isRoot: true, file: [] })).toObject();
  }
  if (String(destination._id) === String(source._id)) return res.json({ moved: false, folderId: destination.isRoot ? null : destination._id });
  const target = { _id: destination._id, createBy: source.createBy, deleted: false };
  const copied = await Document.updateOne({ ...target, 'file._id': { $ne: file._id } }, { $push: { file }, $set: { updatedDate: new Date() } });
  if (!copied.modifiedCount) return res.status(409).json({ code: 'conflict' });
  let removed = false;
  try {
    // Match the complete snapshot so a concurrent edit cannot be discarded.
    const result = await Document.collection.updateOne({ _id: source._id, createBy: source.createBy, deleted: false, file },
      { $pull: { file: { _id: file._id } }, $set: { updatedDate: new Date() } });
    removed = result.modifiedCount === 1;
  } finally {
    if (!removed) await Document.updateOne(target, { $pull: { file: { _id: file._id } } });
  }
  if (!removed) return res.status(409).json({ code: 'conflict' });
  res.json({ moved: true, folderId: destination.isRoot ? null : destination._id });
});

const moveFolder = serialize(async (req, res) => {
  const folderId = destinationId(req);
  if (!validId(req.params.id) || (folderId !== null && !validId(folderId))) return invalid(res);
  const source = await Document.findOne({ _id: req.params.id, ...ownership(req), deleted: false, isRoot: { $ne: true } }).lean();
  if (!source) return res.status(404).json({ code: 'notFound' });
  const visited = new Set([String(source._id)]);
  let ancestor = folderId;
  while (ancestor) {
    if (visited.has(String(ancestor))) return invalid(res, 'documentFolderCycle');
    visited.add(String(ancestor));
    const folder = await Document.findOne({ _id: ancestor, createBy: source.createBy, deleted: false, isRoot: { $ne: true } }).select('parentFolder').lean();
    if (!folder) return res.status(404).json({ code: 'notFound', field: 'folderId' });
    ancestor = folder.parentFolder;
  }
  const result = await Document.updateOne({ _id: source._id, createBy: source.createBy, deleted: false, parentFolder: source.parentFolder },
    { $set: { parentFolder: folderId, updatedDate: new Date() } });
  if (!result.matchedCount) return res.status(409).json({ code: 'conflict' });
  res.json({ moved: true, folderId });
});

module.exports = { moveFile, moveFolder };
