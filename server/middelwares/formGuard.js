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
    if (!module || ['Accounts', 'Account', 'Payments', 'Notification', 'Notifications', 'Images', 'EstateFile', 'RecordShare', 'RecordShares', 'AuthSession', 'AuthSessions', 'CustomField', 'FormDefinition', 'Validation'].includes(module.moduleName)) return res.status(404).json({ code: 'notFound' });
    const action = req.method === 'GET' ? 'view' : req.method === 'DELETE' || req.path.includes('delete') ? 'delete' : req.method === 'PUT' ? 'update' : 'create';
    // Account mutations must use the user controller's role and password safeguards.
    if (['User', 'Users'].includes(module.moduleName) && action !== 'view') return res.status(403).json({ code: 'forbidden' });
    req.readModuleName = require('../services/moduleVisibility').canonicalModule(module.moduleName);
    if (!(action === 'view' ? require('../services/moduleVisibility').canRead(req.actor, module.moduleName) : can(req.actor, module.moduleName, action))) return res.status(403).json({ code: 'forbidden' });
    // Task mutations share assignment authorization and recipient notifications.
    if (module.moduleName === 'Tasks' && ['create', 'update', 'view'].includes(action)) {
      const task = require('../controllers/task/task');
      const originalJson = res.json.bind(res);
      res.json = data => originalJson(res.statusCode < 300 ? { data } : data);
      if (action === 'create') {
        return require('./dynamicValues')('Tasks')(req, res, () => task.add(req, res));
      }
      if (action === 'view') return req.params.id ? task.view(req, res) : task.index(req, res);
      return task.edit(req, res);
    }
    if (module.moduleName === 'Properties' && ['create', 'update'].includes(action)) {
      req.url = `/Properties${action === 'update' ? `/${req.params.id}` : ''}`;
      req.method = action === 'update' ? 'PUT' : 'POST';
      const originalJson = res.json.bind(res);
      res.json = data => { if (res.statusCode < 300) { res.status(200); return originalJson({ data }); } return originalJson(data); };
      return require('../controllers/estate/_routes')(req, res, next);
    }
    const model = require('../controllers/form/form').getModel(module);
    const shared = ['Users', 'User', 'Leads', 'Contacts', 'Properties', 'Partner Customers', 'PartnerCustomers', 'Residences'];
    const known = require('../services/recordAccess').personalFields;
    req.formAccessScope = scope(req, module.moduleName);
    if (req.method !== 'GET' && req.actor.role === 'user' && module.moduleName !== 'Tasks' && !shared.includes(module.moduleName) && !known[module.moduleName]) req.formAccessScope = { createBy: req.actor._id };
    if (!shared.includes(module.moduleName) && !model.schema.path('createBy')) model.schema.add({ createBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, deleted: { type: Boolean, default: false } });
    if (req.params.id) {
      if (!objectId(req.params.id)) return res.status(400).json({ code: 'invalid', field: 'id' });
      if (model && !await model.exists({ _id: req.params.id, deleted: { $ne: true }, ...req.formAccessScope })) return res.status(404).json({ code: 'notFound' });
    }
    if (['create', 'update'].includes(action)) {
      const definition = await getDefinition(module.moduleName);
      const previous = action === 'update' && model ? await model.findById(req.params.id).lean() : {};
      const values = validateFields(definition, req.body, previous || {});
      for (const field of (definition?.fields || []).filter(field => field.type === 'file')) {
        for (const file of values.customFields?.[field.name] || []) {
          if (!await mongoose.model('EstateFile').exists({ _id: file.id, ...scope(req, 'Documents') })) return res.status(400).json({ code: 'relationNotFound', field: field.name });
        }
      }
      // Existing relationship widgets use fields outside the form metadata.
      const extras = {};
      for (const key of ['assignUser', 'associatedListing', 'contact', 'partnerCustomer', 'relatedOpportunities']) {
        if (req.body[key] !== undefined) extras[key] = req.body[key];
      }
      req.body = { ...values, ...extras, moduleId, ...(action === 'create' ? { createBy: req.actor._id } : {}) };
    }
    if (action === 'delete' && !req.params.id && (!Array.isArray(req.body?.ids) || req.body.ids.length > 100)) return res.status(400).json({ code: 'invalid', field: 'ids' });
    if (Array.isArray(req.body?.ids) && model) {
      if (req.body.ids.some(id => !objectId(id))) return res.status(400).json({ code: 'invalid', field: 'ids' });
      const count = await model.countDocuments({ _id: { $in: req.body.ids }, deleted: { $ne: true }, ...req.formAccessScope });
      if (count !== new Set(req.body.ids).size) return res.status(403).json({ code: 'forbidden' });
    }
    next();
  } catch (error) { res.status(400).json({ code: error.code || 'invalid', field: error.field }); }
};
