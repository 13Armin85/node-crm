const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const auth = require('../../middelwares/auth');
const { loadUser, permit, adminOnly, scope, can } = require('../../middelwares/permissions');
const { Property } = require('../../model/schema/property');
const PartnerCustomer = require('../../model/schema/partnerCustomer');
const Residence = require('../../model/schema/residence');
const { Lead } = require('../../model/schema/lead');
const FormDefinition = require('../../model/schema/formDefinition');
const { defaults, legacyModules, getDefinition } = require('../../services/formDefinitions');
const { validateFields, normalizeProperty, validateDefinition, objectId, fail, InputError } = require('../../services/estateValidation');
const router = express.Router();
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const modules = {
  Properties: { model: Property, search: ['title', 'district', 'neighborhood', 'propertyType', 'propertyAddress'], sort: ['title', 'price.amount', 'createdDate'], filters: ['category', 'subtype', 'transactionType', 'district', 'neighborhood', 'residence', 'bedroom', 'buildingAge', 'occupancyStatus', 'floor', 'area.type', 'sale.status'] },
  'Partner Customers': { model: PartnerCustomer, search: ['fullName', 'companyName', 'phone', 'email'], sort: ['fullName', 'companyName', 'createdDate'], filters: ['customerType', 'status', 'district'] },
  Residences: { model: Residence, search: ['name', 'district', 'neighborhood'], sort: ['name', 'createdDate'], filters: ['district', 'neighborhood'] },
  Leads: { model: Lead, search: ['leadName', 'leadEmail', 'leadPhoneNumber'], sort: ['leadName', 'createdDate'], filters: [] },
};
const fileSchema = new mongoose.Schema({ name: String, storageName: String, mimeType: String, size: Number, uploadedAt: Date, createBy: mongoose.Schema.Types.ObjectId });
const File = mongoose.model('EstateFile', fileSchema);
const uploadRoot = path.resolve(__dirname, '../../uploads/estate');
const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) { fs.mkdir(uploadRoot, { recursive: true }, err => cb(err, uploadRoot)); },
    filename(req, file, cb) { cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()); },
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter(req, file, cb) {
    const types = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.txt': 'text/plain' };
    cb(types[path.extname(file.originalname).toLowerCase()] === file.mimetype ? null : new InputError('invalidFile', 'files'), Boolean(types[path.extname(file.originalname).toLowerCase()] === file.mimetype));
  },
});
router.use(auth, loadUser);
router.get('/definitions', asyncRoute(async (req, res) => {
  const legacy = await require('../../model/schema/customField').find({ deleted: false }).select('moduleName').lean();
  res.json([...new Set([...Object.keys(defaults), ...legacyModules, ...legacy.map(m => m.moduleName)])].filter(name => !['Account', 'Accounts', 'Payments'].includes(name)));
}));
router.get('/definitions/:module', asyncRoute(async (req, res) => {
  const definition = await getDefinition(req.params.module);
  if (!definition) return res.status(404).json({ code: 'notFound' });
  res.json(definition);
}));
router.put('/definitions/:module', adminOnly, asyncRoute(async (req, res) => {
  const current = await getDefinition(req.params.module);
  if (!current) return res.status(404).json({ code: 'notFound' });
  const baseline = { fields: defaults[req.params.module] || current.fields.filter(f => f.kind === 'SYSTEM_FIELD') };
  const fields = validateDefinition(req.body, current, baseline);
  if (req.body.revision !== current.revision) return res.status(409).json({ code: 'conflict' });
  let updated;
  if (!current._id) updated = await FormDefinition.create({ moduleName: req.params.module, fields, revision: 1, updatedBy: req.actor._id });
  else updated = await FormDefinition.findOneAndUpdate({ _id: current._id, revision: current.revision }, { $set: { fields, updatedBy: req.actor._id }, $inc: { revision: 1 } }, { new: true, runValidators: true });
  if (!updated) return res.status(409).json({ code: 'conflict' });
  res.json(updated);
}));
router.post('/files', (req, res, next) => {
  if (!['Properties', 'Partner Customers', 'Residences', ...legacyModules].some(m => can(req.actor, m, 'create') || can(req.actor, m, 'update'))) return res.status(403).json({ code: 'forbidden' });
  next();
}, upload.array('files', 10), asyncRoute(async (req, res) => {
  const results = [];
  try {
    for (const file of req.files || []) {
      const stored = await File.create({ name: path.basename(file.originalname), storageName: file.filename, mimeType: file.mimetype, size: file.size, uploadedAt: new Date(), createBy: req.actor._id });
      results.push({ id: String(stored._id), name: stored.name, mimeType: stored.mimeType, size: stored.size, uploadedAt: stored.uploadedAt });
    }
    res.status(201).json(results);
  } catch (error) { await Promise.all((req.files || []).map(f => fs.promises.unlink(f.path).catch(() => {}))); throw error; }
}));
router.get('/files/:id', asyncRoute(async (req, res) => {
  if (!objectId(req.params.id)) fail('id');
  const file = await File.findOne({ _id: req.params.id, ...scope(req) });
  if (!file) return res.status(404).json({ code: 'notFound' });
  res.set('X-Content-Type-Options', 'nosniff');
  res.download(path.join(uploadRoot, file.storageName), file.name);
}));
router.param('module', (req, res, next, moduleName) => {
  req.estateModule = modules[moduleName]; next();
});
const moduleRequired = (req, res, next) => req.estateModule ? next() : res.status(404).json({ code: 'notFound' });
const permission = action => (req, res, next) => permit(req.params.module, action)(req, res, next);
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
router.get('/:module/options', moduleRequired, permission('view'), asyncRoute(async (req, res) => {
  const q = String(req.query.q || '').slice(0, 100);
  const query = { deleted: false, ...scope(req) };
  if (q) query.$or = req.estateModule.search.map(key => ({ [key]: { $regex: escape(q), $options: 'i' } }));
  if (req.query.id) { if (!objectId(req.query.id)) fail('id'); query._id = req.query.id; }
  const items = await req.estateModule.model.find(query).select([...req.estateModule.search, 'name'].join(' ')).sort({ _id: 1 }).limit(25).lean();
  res.json(items.map(item => ({ value: String(item._id), label: item.title || item.name || item.fullName || item.companyName || item.leadName || item.propertyType || String(item._id) })));
}));
router.get('/:module', moduleRequired, permission('view'), asyncRoute(async (req, res) => {
  const { model, search, filters, sort } = req.estateModule;
  const query = { deleted: false, ...scope(req) };
  const q = String(req.query.q || '').slice(0, 100);
  if (q) query.$or = search.map(key => ({ [key]: { $regex: escape(q), $options: 'i' } }));
  for (const key of filters) if (typeof req.query[key] === 'string' && req.query[key]) query[key] = req.query[key];
  if (req.params.module === 'Properties' && (req.query.priceMin || req.query.priceMax)) {
    query['price.amount'] = {};
    for (const [key, operator] of [['priceMin', '$gte'], ['priceMax', '$lte']]) if (req.query[key]) {
      const value = Number(req.query[key]); if (!Number.isFinite(value) || value < 0) fail(key); query['price.amount'][operator] = value;
    }
  }
  const page = Math.max(1, Math.min(100000, parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
  const sortKey = sort.includes(req.query.sort) ? req.query.sort : 'createdDate';
  const [items, total] = await Promise.all([model.find(query).sort({ [sortKey]: req.query.order === 'asc' ? 1 : -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(), model.countDocuments(query)]);
  res.json({ items, total, page, limit });
}));
router.get('/:module/:id', moduleRequired, permission('view'), asyncRoute(async (req, res) => {
  if (!objectId(req.params.id)) fail('id');
  const record = await req.estateModule.model.findOne({ _id: req.params.id, deleted: false, ...scope(req) }).lean();
  if (!record) return res.status(404).json({ code: 'notFound' });
  res.json(record);
}));
async function related(req, moduleName, id, field) {
  if (!objectId(id)) fail(field);
  if (!can(req.actor, moduleName, 'view')) throw Object.assign(new InputError('forbidden', field), { status: 403 });
  if (!await modules[moduleName].model.exists({ _id: id, deleted: false, ...scope(req) })) fail(field, 'relationNotFound');
}
async function payload(req, previous = {}) {
  if (!['Properties', 'Partner Customers', 'Residences'].includes(req.params.module)) throw Object.assign(new Error('forbidden'), { status: 403, code: 'forbidden' });
  const definition = await getDefinition(req.params.module);
  // Merge nested objects for PATCH-like updates while validating the entire result.
  const body = { ...previous, ...req.body };
  for (const key of ['price', 'area', 'sale', 'customFields']) body[key] = { ...previous[key], ...req.body[key] };
  let values = validateFields(definition, body, previous);
  if (req.params.module === 'Properties') {
    values = normalizeProperty(values);
    values.name = values.title;
    values.status = values.sale.status === 'SOLD' ? 'Sold' : 'Available';
    if (values.residence) await related(req, 'Residences', values.residence, 'residence');
    if (values.sale.lead) await related(req, 'Leads', values.sale.lead, 'sale.lead');
    if (values.sale.partnerCustomer) await related(req, 'Partner Customers', values.sale.partnerCustomer, 'sale.partnerCustomer');
    if (req.body.files) {
      if (!Array.isArray(req.body.files) || req.body.files.length > 100) fail('files');
      values.files = [];
      for (const item of req.body.files) {
        const id = item.id || item._id;
        if (!objectId(id)) fail('files');
        const file = await File.findOne({ _id: id, ...scope(req) }).lean();
        if (!file) fail('files', 'relationNotFound');
        values.files.push({ _id: file._id, name: file.name, mimeType: file.mimeType, size: file.size, uploadedAt: file.uploadedAt, storageName: file.storageName, url: `api/estate/files/${file._id}` });
      }
    }
  }
  if (req.params.module === 'Partner Customers' && values.customerType !== 'COMPANY') { values.companyName = ''; values.contactPerson = ''; values.taxNumber = ''; }
  for (const field of definition.fields.filter(f => f.type === 'file')) {
    const value = require('../../services/estateValidation').get(values, field.kind === 'CUSTOM_FIELD' ? `customFields.${field.name}` : field.name);
    for (const item of value || []) if (!await File.exists({ _id: item.id || item._id, ...scope(req) })) fail(field.name, 'relationNotFound');
  }
  return values;
}
router.post('/:module', moduleRequired, permission('create'), asyncRoute(async (req, res) => {
  const values = await payload(req);
  const record = await req.estateModule.model.create({ ...values, createBy: req.actor._id, createdDate: new Date(), updatedDate: new Date() });
  res.status(201).json(record);
}));
router.put('/:module/:id', moduleRequired, permission('update'), asyncRoute(async (req, res) => {
  if (!objectId(req.params.id)) fail('id');
  const record = await req.estateModule.model.findOne({ _id: req.params.id, deleted: false, ...scope(req) });
  if (!record) return res.status(404).json({ code: 'notFound' });
  const previous = JSON.parse(JSON.stringify(record));
  const values = await payload(req, previous);
  record.set({ ...values, updatedDate: new Date() });
  await record.save(); res.json(record);
}));
router.delete('/:module/:id', moduleRequired, permission('delete'), asyncRoute(async (req, res) => {
  if (!objectId(req.params.id)) fail('id');
  const key = req.params.module === 'Residences' ? 'residence' : req.params.module === 'Partner Customers' ? 'sale.partnerCustomer' : req.params.module === 'Leads' ? 'sale.lead' : null;
  if (key && await Property.exists({ [key]: req.params.id, deleted: false })) return res.status(409).json({ code: 'inUse' });
  const record = await req.estateModule.model.findOneAndUpdate({ _id: req.params.id, deleted: false, ...scope(req) }, { $set: { deleted: true, updatedDate: new Date() } });
  if (!record) return res.status(404).json({ code: 'notFound' });
  res.json({ success: true });
}));
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.code === 11000 ? 409 : error.status || (error.name === 'ValidationError' || error.name === 'CastError' || error instanceof multer.MulterError ? 400 : 500);
  if (status === 500) console.error('Estate API:', error.message);
  res.status(status).json({ code: error.code === 11000 ? 'conflict' : (typeof error.code === 'string' ? error.code : status === 500 ? 'serverError' : 'invalid'), field: error.field });
});
module.exports = router;
module.exports.buildPayload = payload;
