const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const User = require('../model/schema/user');
const { createUpload, validateUploads, withinRoot, fileResponseHeaders } = require('../services/secureFiles');
const { loadUser } = require('../middelwares/permissions');
const { objectId } = require('../services/estateValidation');
const root = path.resolve(__dirname, '../uploads/profile');
const upload = createUpload({ directory: root, kind: 'image', maxFiles: 1 });
const publicFields = '_id firstName lastName username jobTitle department bio website avatarVersion';
const run = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
router.use(require('../middelwares/auth'), loadUser);
router.get('/me', (req, res) => {
  const user = req.actor.toObject(); delete user.password; delete user.authVersion; delete user.moduleVisibility; delete user.avatarFilename;
  res.json(user);
});
router.put('/me', run(async (req, res) => {
  const values = {};
  for (const [key, max] of Object.entries({ firstName: 120, lastName: 120, bio: 2000, jobTitle: 120, department: 120, website: 500 })) {
    if (req.body[key] === undefined) continue;
    if (typeof req.body[key] !== 'string' || req.body[key].length > max) return res.status(400).json({ code: 'invalid', field: key });
    values[key] = req.body[key].trim();
  }
  if (values.website) { try { if (!['https:', 'http:'].includes(new URL(values.website).protocol)) throw new Error(); } catch { return res.status(400).json({ code: 'invalid', field: 'website' }); } }
  if (req.body.phoneNumber !== undefined) {
    const phone = String(req.body.phoneNumber).trim();
    if (phone && !/^[+\d\s().-]{3,30}$/.test(phone)) return res.status(400).json({ code: 'invalid', field: 'phoneNumber' });
    values.phoneNumber = phone ? Number(phone.replace(/[^\d]/g, '')) : null;
  }
  const user = await User.findByIdAndUpdate(req.actor._id, { $set: { ...values, updatedDate: new Date() } }, { new: true, runValidators: true }).select('-avatarFilename').lean();
  res.json(user);
}));
router.post('/me/avatar', upload.single('avatar'), validateUploads(root), run(async (req, res) => {
  if (!req.file || req.file.size > 2 * 1024 * 1024) return res.status(400).json({ code: 'invalidFile' });
  const version = require('crypto').randomUUID();
  await User.updateOne({ _id: req.actor._id }, { $set: { avatarFilename: req.file.filename, avatarVersion: version, updatedDate: new Date() } });
  res.json({ _id: req.actor._id, avatarVersion: version });
}));
router.get('/:id/avatar', run(async (req, res) => {
  if (!objectId(req.params.id)) return res.status(400).json({ code: 'invalid' });
  const user = await User.findOne({ _id: req.params.id, deleted: false }).select('avatarFilename').lean();
  const filename = user?.avatarFilename && withinRoot(root, path.join(root, user.avatarFilename));
  if (!filename || !fs.existsSync(filename)) return res.status(404).json({ code: 'notFound' });
  fileResponseHeaders(res, filename, true); res.sendFile(filename);
}));
router.get('/:id', run(async (req, res) => {
  if (!objectId(req.params.id)) return res.status(400).json({ code: 'invalid' });
  const user = await User.findOne({ _id: req.params.id, deleted: false }).select(publicFields).lean();
  if (!user) return res.status(404).json({ code: 'notFound' });
  res.json(user);
}));
router.use((err, req, res, next) => res.status(err.status || (err.name === 'MulterError' ? 400 : 500)).json({ code: err.name === 'MulterError' ? 'invalidFile' : err.code || 'serverError' }));
module.exports = router;
