const mongoose = require('mongoose');
const { getDefinition } = require('../services/formDefinitions');
const { validateFields, normalizeProperty, objectId } = require('../services/estateValidation');
const { can, scope } = require('./permissions');
// Extend existing controllers without changing their response contracts.
module.exports = moduleName => async (req, res, next) => {
  try {
    const action = req.method === 'POST' ? 'create' : 'update';
    const ownProfile = moduleName === 'Users' && action === 'update' && String(req.actor._id) === req.params.id;
    if (!ownProfile && !can(req.actor, moduleName, action)) return res.status(403).json({ code: 'forbidden' });
    const definition = await getDefinition(moduleName);
    if (!definition) return next();
    const model = mongoose.models[({ Users: 'User', Documents: 'Document', 'Email Template': 'EmailTemps' })[moduleName] || moduleName];
    let previous = {};
    if (req.params.id && model) {
      if (!objectId(req.params.id)) return res.status(400).json({ code: 'invalid', field: 'id' });
      previous = await model.findOne({ _id: req.params.id, ...(moduleName === 'Users' ? {} : { deleted: false, ...scope(req) }) }).lean();
      if (!previous) return res.status(404).json({ code: 'notFound' });
    }
    if (typeof req.body.customFields === 'string') req.body.customFields = JSON.parse(req.body.customFields);
    const values = validateFields({ ...definition, fields: definition.fields.filter(f => f.kind === 'CUSTOM_FIELD') }, req.body, previous);
    for (const field of definition.fields.filter(f => f.kind === 'CUSTOM_FIELD' && f.type === 'file')) for (const file of values.customFields[field.name] || []) {
      if (!await mongoose.model('EstateFile').exists({ _id: file.id, ...scope(req) })) return res.status(400).json({ code: 'relationNotFound', field: field.name });
    }
    req.body.customFields = values.customFields;
    if (action === 'create') req.body.createBy = req.actor._id;
    else delete req.body.createBy;
    delete req.body.deleted;
    delete req.body.roles;
    if (moduleName !== 'Users' || req.actor.role !== 'admin') delete req.body.role;
    next();
  } catch (error) { res.status(400).json({ code: error.code || 'invalid', field: error.field }); }
};
