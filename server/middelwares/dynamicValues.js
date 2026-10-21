const mongoose = require('mongoose');
const { getDefinition, defaults } = require('../services/formDefinitions');
const { validateFields, validateRequiredFields, normalizeProperty, objectId } = require('../services/estateValidation');
const { can, scope, isAdmin } = require('./permissions');
const { normalizeLeadRelations, isLeadRelationVisible, validateLeadSelection } = require('../services/leadRelations');
// Extend existing controllers without changing their response contracts.
module.exports = moduleName => async (req, res, next) => {
  try {
    if (req.body && !Array.isArray(req.body)) delete req.body._duplicateKeys;
    const action = req.method === 'POST' ? 'create' : 'update';
    const ownProfile = moduleName === 'Users' && action === 'update' && String(req.actor._id) === req.params.id;
    if (!ownProfile && !can(req.actor, moduleName, action)) return res.status(403).json({ code: 'forbidden' });
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ code: 'invalid' });
    if (moduleName === 'Users' && !isAdmin(req.actor) && req.body.role && req.body.role !== req.actor.role) return res.status(403).json({ code: 'forbidden' });
    if (action === 'create') req.body.createBy = req.actor._id;
    else delete req.body.createBy;
    for (const key of ['_id', '__v', 'deleted', 'roles', 'createdDate', 'updatedDate', 'authVersion', 'conversion', 'convertedLeads', 'leadCallFor', 'assignedBy']) delete req.body[key];
    if (moduleName !== 'Users' || !isAdmin(req.actor)) delete req.body.role;
    req.body.modifiedBy = req.actor._id;
    if (!isAdmin(req.actor) && ['Calls', 'Emails', 'Texts'].includes(moduleName)) {
      req.body.sender = req.actor._id;
      req.body.salesAgent = req.actor._id;
    }
    let definition = await getDefinition(moduleName);
    if (!definition) return next();
    const model = mongoose.models[({ Users: 'User', Documents: 'Document', 'Email Template': 'EmailTemps', OpportunityProject: 'OpportunityProjects', 'Opportunity Project': 'OpportunityProjects', 'Bank Details': 'BankDetails' })[moduleName] || moduleName];
    let previous = {};
    if (req.params.id && model) {
      if (!objectId(req.params.id)) return res.status(400).json({ code: 'invalid', field: 'id' });
      previous = await model.findOne({ _id: req.params.id, ...(moduleName === 'Users' ? {} : { deleted: false, ...scope(req) }) }).lean();
      if (!previous) return res.status(404).json({ code: 'notFound' });
    }
    if (moduleName === 'Leads') {
      req.body = await require('../services/leadWorkflow').normalizeLeadAssignment(req.body, previous, req.actor);
      req.body = normalizeLeadRelations(req.body, previous);
      validateLeadSelection(req.body);
      definition = { ...definition, fields: definition.fields.filter(field => isLeadRelationVisible(field, req.body)) };
    }
    if (typeof req.body.customFields === 'string') req.body.customFields = JSON.parse(req.body.customFields);
    // Existing controllers handle default core requirements, including partial edits.
    // Once an administrator saves a definition, its requirements take precedence here.
    const configuredFields = definition.fields.filter(field => field.kind === 'CUSTOM_FIELD'
      || moduleName === 'Meetings'
      || (moduleName !== 'Documents' && (definition._id
        || !(defaults[moduleName] || []).some(system => system.name === field.name && system.required))));
    validateRequiredFields({ ...definition, fields: configuredFields }, req.body, previous);
    if (moduleName === 'Invoices') await require('../services/invoiceProperty').validateInvoiceProperty(req, req.body, previous);
    const values = validateFields({ ...definition, fields: definition.fields.filter(f => f.kind === 'CUSTOM_FIELD') }, req.body, previous);
    for (const field of definition.fields.filter(f => f.kind === 'CUSTOM_FIELD' && f.type === 'file')) for (const file of values.customFields[field.name] || []) {
      if (!await mongoose.model('EstateFile').exists({ _id: file.id, ...scope(req) })) return res.status(400).json({ code: 'relationNotFound', field: field.name });
    }
    req.body.customFields = values.customFields;
    if (action === 'create') req.body.createBy = req.actor._id;
    else delete req.body.createBy;
    delete req.body.deleted;
    delete req.body.roles;
    if (moduleName !== 'Users' || !isAdmin(req.actor)) delete req.body.role;
    next();
  } catch (error) { res.status(error.status || 400).json({ code: error.code || 'invalid', field: error.field }); }
};
