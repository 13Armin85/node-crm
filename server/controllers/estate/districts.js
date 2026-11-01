const express = require('express');
const District = require('../../model/schema/district');
const { normalize } = require('../../services/districtNames');
const { permit } = require('../../middelwares/permissions');
const { objectId, fail } = require('../../services/estateValidation');
const { searchCondition } = require('../../services/relationSearch');
const router = express.Router();
const run = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
router.get('/options', permit('Districts', 'view'), run(async (req, res) => {
  const match = { deleted: false, ...(req.query.id ? { normalizedName: normalize(req.query.id) } : searchCondition(['name', 'label.en', 'label.fa', 'label.tr'], req.query.q)) };
  const rows = await District.find(match).sort({ name: 1 }).limit(100).lean();
  res.json(rows.map(row => ({ value: row.name, label: { en: row.label?.en || row.name, fa: row.label?.fa || row.name, tr: row.label?.tr || row.name } })));
}));
router.get('/', permit('Districts', 'view'), run(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const match = { deleted: false, ...searchCondition(['name', 'label.en', 'label.fa', 'label.tr'], req.query.q) };
  const [items, total] = await Promise.all([District.find(match).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(), District.countDocuments(match)]);
  res.json({ items, total, page, limit });
}));
router.post('/', permit('Districts', 'create'), run(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) fail('name', 'required');
  if (name.length > 200 || objectId(name)) fail('name');
  const record = await District.create({ name, createBy: req.actor._id });
  res.status(201).json(record);
}));
router.delete('/:id', permit('Districts', 'delete'), run(async (req, res) => {
  if (!objectId(req.params.id)) fail('id');
  const record = await District.findOne({ _id: req.params.id, deleted: false });
  if (!record) return res.status(404).json({ code: 'notFound' });
  const mongoose = require('mongoose');
  for (const collection of ['Properties', 'Residences', 'PartnerCustomers']) {
    const used = await mongoose.connection.collection(collection).findOne({ deleted: { $ne: true }, district: { $regex: '^' + record.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' } });
    if (used) return res.status(409).json({ code: 'inUse' });
  }
  record.deleted = true; await record.save(); res.json({ success: true });
}));
module.exports = router;
