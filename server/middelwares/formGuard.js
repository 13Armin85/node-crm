const mongoose = require('mongoose');
const CustomField = require('../model/schema/customField');
const { getDefinition } = require('../services/formDefinitions');
const { validateFields, objectId } = require('../services/estateValidation');
const { can, scope } = require('./permissions');
module.exports = async (req, res, next) => {
  try {
    const moduleId = req.body?.moduleId || req.query.moduleId;
    if (!objectId(moduleId)) return res.status(400).json({ code: 'invalid', field: 'moduleId' });
    const module = await CustomField.findById(moduleId).lean();
    if (!module || ['Accounts', 'Account', 'Payments'].includes(module.moduleName)) return res.status(404).json({ code: 'notFound' });
    const action = req.method === 'GET' ? 'view' : req.method === 'DELETE' || req.path.includes('delete') ? 'delete' : req.method === 'PUT' ? 'update' : 'create';
    if (!can(req.actor, module.moduleName, action)) return res.status(403).json({ code: 'forbidden' });
    if (module.moduleName === 'Properties' && ['create', 'update'].includes(action)) {
      req.url = `/Properties${action === 'update' ? `/${req.params.id}` : ''}`;
      req.method = action === 'update' ? 'PUT' : 'POST';
      const originalJson = res.json.bind(res);
      res.json = data => { if (res.statusCode < 300) { res.status(200); return originalJson({ data }); } return originalJson(data); };
      return require('../controllers/estate/_routes')(req, res, next);
    }
    const model = mongoose.models[module.moduleName];
    if (req.params.id) {
      if (!objectId(req.params.id)) return res.status(400).json({ code: 'invalid', field: 'id' });
      if (model && !await model.exists({ _id: req.params.id, ...scope(req) })) return res.status(404).json({ code: 'notFound' });
    }
    if (['create', 'update'].includes(action)) {
      const definition = await getDefinition(module.moduleName);
      const previous = action === 'update' && model ? await model.findById(req.params.id).lean() : {};
      const values = validateFields(definition, req.body, previous || {});
      // Existing relationship widgets use fields outside the form metadata.
      const extras = {};
      for (const key of ['assignUser', 'associatedListing']) if (req.body[key] !== undefined) extras[key] = req.body[key];
      req.body = { ...values, ...extras, moduleId, ...(action === 'create' ? { createBy: req.actor._id } : {}) };
    }
    if (Array.isArray(req.body?.ids) && model) {
      if (req.body.ids.some(id => !objectId(id))) return res.status(400).json({ code: 'invalid', field: 'ids' });
      const count = await model.countDocuments({ _id: { $in: req.body.ids }, ...scope(req) });
      if (count !== new Set(req.body.ids).size) return res.status(403).json({ code: 'forbidden' });
    }
    next();
  } catch (error) { res.status(400).json({ code: error.code || 'invalid', field: error.field }); }
};
