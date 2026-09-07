const { Property } = require('../model/schema/property');
const { scope, can } = require('./permissions');
const { objectId } = require('../services/estateValidation');
exports.add = async (req, res) => {
  if (!can(req.actor, 'Properties', 'create')) return res.status(403).json({ code: 'forbidden' });
  if (!Array.isArray(req.body) || req.body.length > 100) return res.status(400).json({ code: 'invalid' });
  try {
    const rows = [];
    for (const body of req.body) rows.push({ ...await require('../controllers/estate/_routes').buildPayload({ ...req, params: { module: 'Properties' }, body }), createBy: req.actor._id, createdDate: new Date(), updatedDate: new Date() });
    const data = await Property.insertMany(rows);
    res.json(data);
  } catch (error) { res.status(error.status || 400).json({ code: error.code || 'invalid', field: error.field }); }
};
exports.remove = async (req, res) => {
  if (!can(req.actor, 'Properties', 'delete')) return res.status(403).json({ code: 'forbidden' });
  const ids = Array.isArray(req.body) ? req.body : req.body.ids;
  if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => !objectId(id))) return res.status(400).json({ code: 'invalid' });
  try {
    const result = await Property.updateMany({ _id: { $in: ids }, ...scope(req) }, { $set: { deleted: true, updatedDate: new Date() } });
    res.json(result);
  } catch { res.status(400).json({ code: 'invalid' }); }
};
