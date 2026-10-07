const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { assertSafeInput } = require('../middelwares/requestSecurity');
const imageTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.avif': 'image/avif' };
const documentExtensions = new Set([...Object.keys(imageTypes), '.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.rtf', '.zip', '.7z', '.rar', '.mp4', '.mp3', '.wav']);
const estateExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.mp4', '.txt']);
const invalidFile = () => Object.assign(new Error('Unsupported or invalid file'), { status: 400, code: 'invalidFile' });
const withinRoot = (root, candidate) => {
  if (typeof candidate !== 'string' || candidate.includes('\0')) return null;
  const resolved = path.resolve(candidate);
  const relative = path.relative(path.resolve(root), resolved);
  return relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative) ? resolved : null;
};
const createUpload = ({ directory, kind = 'document', maxFiles = 20 }) => multer({
  storage: multer.diskStorage({
    destination(req, file, cb) { fs.mkdir(directory, { recursive: true }, error => cb(error, directory)); },
    filename(req, file, cb) { cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()); },
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: maxFiles, fields: 100, fieldSize: 1024 * 1024, parts: maxFiles + 100 },
  fileFilter(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowed = kind === 'image' ? Boolean(imageTypes[extension]) : (kind === 'estate' ? estateExtensions : documentExtensions).has(extension);
    if (!allowed || (imageTypes[extension] && imageTypes[extension] !== file.mimetype && !(extension === '.ico' && file.mimetype === 'image/vnd.microsoft.icon'))) return cb(invalidFile());
    cb(null, true);
  },
});
async function hasImageSignature(file) {
  const handle = await fs.promises.open(file.path, 'r');
  const buffer = Buffer.alloc(32);
  try { await handle.read(buffer, 0, buffer.length, 0); } finally { await handle.close(); }
  const extension = path.extname(file.filename).toLowerCase();
  if (extension === '.png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (extension === '.jpg' || extension === '.jpeg') return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (extension === '.gif') return ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6));
  if (extension === '.webp') return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (extension === '.bmp') return buffer.toString('ascii', 0, 2) === 'BM';
  if (extension === '.ico') return buffer.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]));
  if (extension === '.avif') return buffer.toString('ascii', 4, 8) === 'ftyp' && ['avif', 'avis'].includes(buffer.toString('ascii', 8, 12));
  return true;
}
const validateUploads = directory => async (req, res, next) => {
  const files = req.file ? [req.file] : Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();
  const cleanup = () => Promise.all(files.map(file => {
    const safe = withinRoot(directory, file.path);
    return safe ? fs.promises.unlink(safe).catch(() => {}) : Promise.resolve();
  }));
  res.once('finish', () => { if (res.statusCode >= 400) cleanup(); });
  try {
    assertSafeInput(req.body);
    for (const file of files) if (!withinRoot(directory, file.path) || !await hasImageSignature(file)) throw invalidFile();
    next();
  } catch { await cleanup(); res.status(400).json({ code: 'invalidFile' }); }
};
const fileResponseHeaders = (res, filename, inline = false) => {
  const extension = path.extname(filename).toLowerCase();
  const type = imageTypes[extension] || (extension === '.pdf' ? 'application/pdf' : extension === '.txt' ? 'text/plain' : 'application/octet-stream');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', "default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; sandbox");
  if (inline && !imageTypes[extension] && extension !== '.pdf') res.attachment(path.basename(filename));
  res.type(type);
};
const publicImageHeaders = (req, res, next) => {
  const extension = path.extname(req.path).toLowerCase();
  if (!imageTypes[extension] && extension !== '.svg') return res.sendStatus(404);
  fileResponseHeaders(res, req.path, true);
  if (extension === '.svg') res.type('image/svg+xml');
  next();
};
module.exports = { createUpload, validateUploads, withinRoot, fileResponseHeaders, publicImageHeaders, imageTypes };
