const fs = require('node:fs');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { withinRoot } = require('../services/secureFiles');
const lockSchema = new mongoose.Schema({ _id: String, nonce: String, expiresAt: Date });
lockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const UploadLock = mongoose.models.UploadLock || mongoose.model('UploadLock', lockSchema);
async function acquireLock(owner) {
  await UploadLock.init();
  const nonce = crypto.randomUUID();
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const lock = await UploadLock.findOneAndUpdate({ _id: String(owner), expiresAt: { $lte: new Date() } },
        { $set: { nonce, expiresAt: new Date(Date.now() + 600000) } }, { upsert: true, new: true });
      if (lock?.nonce === nonce) return () => UploadLock.deleteOne({ _id: String(owner), nonce }).catch(() => {});
    } catch (error) { if (error.code !== 11000) throw error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Object.assign(new Error('An upload is still in progress'), { status: 409, code: 'uploadBusy', field: 'files' });
}

const contentHash = filePath => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  stream.on('error', reject); stream.on('data', chunk => hash.update(chunk));
  stream.on('end', () => resolve(hash.digest('hex')));
});
module.exports = (kind, uploadRoot) => async (req, res, next) => {
  const cleanup = () => Promise.all((req.files || []).map(file => {
    const safe = withinRoot(uploadRoot, file.path);
    return safe ? fs.promises.unlink(safe).catch(() => {}) : Promise.resolve();
  }));
  res.once('finish', () => { if (res.statusCode >= 400) cleanup(); });
  try {
    const owner = req.actor?._id || req.user?.userId;
    // Hold the lease through the controller save and release it after the response.
    // Content hashes stay with the file itself, so folder moves need no special handling.
    if (kind === 'document') {
      const release = await acquireLock(owner);
      res.once('finish', release);
    }
    const seen = new Set();
    const Model = kind === 'estate' ? mongoose.model('EstateFile') : require('../model/schema/document');
    await Model.init();
    for (const file of req.files || []) {
      const safe = withinRoot(uploadRoot, file.path);
      if (!safe) return res.status(400).json({ code: 'invalid', field: 'files' });
      file.contentHash = await contentHash(safe);
      if (seen.has(file.contentHash)) return res.status(409).json({ code: 'duplicate', field: 'files' });
      seen.add(file.contentHash);
      const candidates = kind === 'estate'
        ? await Model.find({ createBy: owner, size: file.size }).lean()
        : (await Model.find({ createBy: owner, deleted: false, file: { $elemMatch: { size: file.size, deleted: { $ne: true } } } }).lean()).flatMap(folder => folder.file.filter(item => !item.deleted && item.size === file.size));
      for (const candidate of candidates) {
        let hash = candidate.contentHash;
        if (!hash) {
          const legacy = withinRoot(uploadRoot, kind === 'estate' ? require('node:path').join(uploadRoot, candidate.storageName || '') : candidate.path || '');
          if (legacy) { try { hash = await contentHash(legacy); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
        }
        if (hash === file.contentHash) return res.status(409).json({ code: 'duplicate', field: 'files' });
      }
    }
    next();
  } catch (error) { next(error); }
};
module.exports.contentHash = contentHash;
