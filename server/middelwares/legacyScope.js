const { objectId } = require('../services/estateValidation');
const { scope } = require('./permissions');

const list = (req, res, next) => {
  Object.assign(req.query, scope(req));
  next();
};

const record = Model => async (req, res, next) => {
  try {
    if (!objectId(req.params.id)) return res.status(400).json({ code: 'invalid', field: 'id' });
    if (!await Model.exists({ _id: req.params.id, deleted: false, ...scope(req) })) return res.status(404).json({ code: 'notFound' });
    next();
  } catch (error) { next(error); }
};

const createMany = (req, res, next) => {
  if (!Array.isArray(req.body) || req.body.length > 100) return res.status(400).json({ code: 'invalid' });
  req.body = req.body.map(item => ({ ...item, _id: undefined, createBy: req.actor._id, deleted: false }));
  next();
};

const batch = Model => async (req, res, next) => {
  try {
    if (!Array.isArray(req.body) || req.body.length > 100 || req.body.some(id => !objectId(id))) return res.status(400).json({ code: 'invalid' });
    const records = await Model.find({ _id: { $in: req.body }, deleted: false, ...scope(req) }).select('_id').lean();
    req.body = records.map(item => item._id);
    next();
  } catch (error) { next(error); }
};

module.exports = { list, record, createMany, batch };
