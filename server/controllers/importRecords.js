const express = require('express');
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const auth = require('../middelwares/auth');
const { loadUser, can } = require('../middelwares/permissions');
const { getDefinition, legacyModules } = require('../services/formDefinitions');
const { validateFields, get, objectId } = require('../services/estateValidation');
const { identityTokens, assertUnique } = require('../services/duplicateRecords');
const { normalizeLeadRelations, validateLeadSelection, isLeadRelationVisible } = require('../services/leadRelations');
const { readScope } = require('../services/recordAccess');
const { canonicalModule } = require('../services/moduleVisibility');
const router = express.Router();
const targets = Object.assign(Object.create(null), {
  Contacts: () => require('../model/schema/contact').Contact,
  Leads: () => require('../model/schema/lead').Lead,
  Properties: () => require('../model/schema/property').Property,
  Residences: () => require('../model/schema/residence'),
  'Partner Customers': () => require('../model/schema/partnerCustomer'),
  Opportunities: () => require('../model/schema/opprtunity'),
  Invoices: () => require('../model/schema/invoices'),
  Quotes: () => require('../model/schema/quotes'),
  'Opportunity Project': () => require('../model/schema/opportunityproject'),
});
const denied = new Set(['User', 'Users', 'Accounts', 'Account', 'Documents', 'Document', 'Payments', 'Notification', 'Notifications', 'Images', 'EstateFile', 'RecordShare', 'RecordShares', 'AuthSession', 'AuthSessions', 'AuditLog', 'AuditLogs', 'CustomField', 'FormDefinition', 'Validation', 'ModuleActiveDeactive', 'uploadlocks']);
const aliases = { Users: 'User', 'Partner Customers': 'PartnerCustomers', Documents: 'Document', 'Opportunity Project': 'OpportunityProjects', OpportunityProject: 'OpportunityProjects', 'Bank Details': 'BankDetails', 'Email Template': 'EmailTemps' };
const fieldOf = error => error.field || Object.keys(error.errors || {})[0];
const cleanError = (error, row) => ({ row, field: fieldOf(error), code: error.code === 11000 || error.code === 'duplicate' ? 'duplicate' : error.code || (error.errors?.[fieldOf(error)]?.kind === 'required' ? 'required' : 'invalid') });

async function targetFor(name) {
  if (targets[name]) return targets[name]();
  if (denied.has(name) || legacyModules.includes(name)) return null;
  const metadata = await require('../model/schema/customField').findOne({ moduleName: name, deleted: false }).lean();
  if (!metadata) return null;
  return require('./form/form').getModel(metadata);
}
async function checkRelations(req, definition, values) {
  for (const field of definition.fields.filter(field => field.relation)) {
    const path = field.kind === 'CUSTOM_FIELD' ? `customFields.${field.name}` : field.name;
    const value = get(values, path);
    if (value == null || value === '') continue;
    const relation = canonicalModule(field.relation);
    const Model = mongoose.models[aliases[relation] || relation];
    if (!Model) throw Object.assign(new Error('relationNotFound'), { code: 'relationNotFound', field: path });
    for (const id of Array.isArray(value) ? value : [value]) {
      if (!objectId(String(id)) || !await Model.exists(readScope(req, req.actor, relation, { _id: id, deleted: { $ne: true } }))) {
        throw Object.assign(new Error('relationNotFound'), { code: 'relationNotFound', field: path });
      }
    }
  }
  for (const field of definition.fields.filter(field => field.type === 'file')) {
    const value = get(values, field.kind === 'CUSTOM_FIELD' ? `customFields.${field.name}` : field.name);
    for (const item of value || []) if (!await mongoose.model('EstateFile').exists(readScope(req, req.actor, 'Documents', { _id: item.id || item._id }))) {
      throw Object.assign(new Error('relationNotFound'), { code: 'relationNotFound', field: field.name });
    }
  }
}
async function afterInsert(moduleName, docs, actorId) {
  const { syncLead, syncOpportunity } = require('../services/relationshipSync');
  for (const doc of docs) {
    try {
      if (moduleName === 'Leads') await syncLead(doc);
      if (moduleName === 'Opportunities') await syncOpportunity(doc);
      await require('../services/notifications').notifyRecordActivity({ module: moduleName, record: doc, actorId, type: 'record_created' });
    } catch (error) { console.error('Imported record follow-up failed:', error.message); }
  }
}

router.post('/:module', auth, loadUser, async (req, res, next) => {
  try {
    const name = req.params.module;
    if (denied.has(name) || (!targets[name] && legacyModules.includes(name))) return res.status(404).json({ code: 'notFound' });
    if (!can(req.actor, name, 'create')) return res.status(403).json({ code: 'forbidden' });
    const Model = await targetFor(name);
    if (!Model) return res.status(404).json({ code: 'notFound' });
    const rows = req.body?.rows, sourceRows = req.body?.sourceRows || (Array.isArray(rows) ? rows.map((_, index) => index + 2) : null);
    if (!Array.isArray(rows) || !rows.length || rows.length > 100 || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row)) || !Array.isArray(sourceRows) || sourceRows.length !== rows.length || sourceRows.some(row => !Number.isInteger(row) || row < 2 || row > 101) || new Set(sourceRows).size !== rows.length) return res.status(400).json({ code: 'invalid' });
    const definition = await getDefinition(name);
    if (!definition) return res.status(404).json({ code: 'notFound' });
    const prepared = [], errors = [], seen = new Set();
    const latestInvoice = name === 'Invoices' ? await Model.aggregate([{ $project: { number: { $convert: { input: '$invoiceNumber', to: 'int', onError: 0, onNull: 0 } } } }, { $sort: { number: -1 } }, { $limit: 1 }]) : [];
    let invoiceNumber = (latestInvoice[0]?.number || 0) + 1;
    for (let index = 0; index < rows.length; index++) {
      try {
        let body = rows[index], currentDefinition = definition, values;
        if (name === 'Leads') {
          body = normalizeLeadRelations(body); validateLeadSelection(body);
          currentDefinition = { ...definition, fields: definition.fields.filter(field => isLeadRelationVisible(field, body)) };
        }
        if (['Properties', 'Residences', 'Partner Customers'].includes(name)) {
          values = await require('./estate/_routes').buildPayload({ ...req, params: { module: name }, body });
          if (values.sale) values.sale.soldBy = values.sale.status === 'SOLD' ? req.actor._id : null;
        } else {
          // The model validators own structured invoice and installment values.
          const scalarDefinition = { ...currentDefinition, fields: currentDefinition.fields.filter(field => !['items', 'installments'].includes(field.name)) };
          values = validateFields(scalarDefinition, body);
          for (const field of ['items', 'installments']) if (body[field] !== undefined && Model.schema.path(field)) {
            if (!Array.isArray(body[field])) throw Object.assign(new Error('invalid'), { code: 'invalid', field });
            values[field] = body[field];
          }
          await checkRelations(req, currentDefinition, values);
          if (name === 'Invoices') {
            await require('../services/invoiceProperty').validateInvoiceProperty(req, values);
            values = require('../services/invoiceAmounts').normalizeInvoiceAmounts(values);
            values.invoiceNumber ||= String(invoiceNumber++);
            const invoiceKey = 'invoice:' + values.invoiceNumber;
            if (seen.has(invoiceKey)) throw Object.assign(new Error('duplicate'), { code: 'duplicate', field: 'invoiceNumber' });
            seen.add(invoiceKey);
            if (await Model.exists({ invoiceNumber: values.invoiceNumber, deleted: { $ne: true } })) throw Object.assign(new Error('duplicate'), { code: 'duplicate', field: 'invoiceNumber' });
          }
        }
        const fingerprint = crypto.createHash('sha256').update(JSON.stringify(values)).digest('hex');
        if (seen.has(fingerprint)) throw Object.assign(new Error('duplicate'), { code: 'duplicate' });
        seen.add(fingerprint);
        const keys = identityTokens(Model.modelName, values);
        for (const key of keys) {
          if (seen.has(key)) throw Object.assign(new Error('duplicate'), { code: 'duplicate', field: key.split(':')[0] });
          seen.add(key);
        }
        await assertUnique(Model, values);
        if (name === 'Leads') values = await require('../services/leadWorkflow').normalizeLeadAssignment(values, {}, req.actor);
        const doc = new Model({ ...values, createBy: req.actor._id, modifiedBy: req.actor._id, createdDate: new Date(), updatedDate: new Date(), deleted: false });
        await doc.validate();
        prepared.push(doc);
      } catch (error) { errors.push(cleanError(error, sourceRows[index])); }
    }
    if (errors.length) return res.status(400).json({ code: 'importInvalid', errors, importedRows: [] });
    try {
      const docs = await Model.insertMany(prepared);
      await afterInsert(name, docs, req.actor._id);
      return res.status(201).json({ imported: docs.length, importedRows: sourceRows });
    } catch (error) {
      // A conflicting concurrent write can produce a partial ordered bulk insert.
      // Report exact completed source rows so retrying never re-inserts them.
      const stored = await Model.find({ _id: { $in: prepared.map(doc => doc._id) } }).select('_id').lean();
      const ids = new Set(stored.map(doc => String(doc._id)));
      const importedRows = sourceRows.filter((_, index) => ids.has(String(prepared[index]._id)));
      await afterInsert(name, prepared.filter(doc => ids.has(String(doc._id))), req.actor._id);
      return res.status(error.code === 11000 || error.code === 'duplicate' ? 409 : 400).json({ code: error.code === 11000 || error.code === 'duplicate' ? 'duplicate' : 'invalid', errors: [cleanError(error, sourceRows[error.writeErrors?.[0]?.index ?? importedRows.length])], importedRows, imported: importedRows.length });
    }
  } catch (error) { next(error); }
});
module.exports = router;
