const mongoose = require('mongoose');
const { modelFor } = require('./recordSharing');
const { canonicalModule } = require('./moduleVisibility');
const { readScope, recordScope } = require('./recordAccess');
const { can } = require('../middelwares/permissions');
const { canEditUser } = require('./userRoles');
const { objectId } = require('./estateValidation');
const models = {
  Users: () => require('../model/schema/user'), Properties: () => require('../model/schema/property').Property,
  Residences: () => require('../model/schema/residence'), Quotes: () => require('../model/schema/quotes'),
  'Email Template': () => require('../model/schema/emailTemplate'),
  'Bank Details': () => require('../model/schema/bankDetails'),
  'Opportunity Project': () => require('../model/schema/opportunityproject'),
};
const error = (code, status = 400) => Object.assign(new Error(code), { code, status });
async function loadRecord(req, moduleName, id, { includeConvertedLead = false } = {}) {
  moduleName = canonicalModule(moduleName);
  if (!objectId(id)) throw error('invalid');
  let Model = modelFor(moduleName) || models[moduleName]?.() || mongoose.models[moduleName];
  if (!Model) {
    const metadata = await require('../model/schema/customField').findOne({ moduleName, deleted: false });
    if (metadata) Model = require('../controllers/form/form').getModel(metadata);
  }
  if (!Model) throw error('notFound', 404);
  let record = await Model.findOne(readScope(req, req.actor, moduleName, { _id: id, deleted: { $ne: true } })).lean();
  let archived = false;
  // Converted sources remain available as read-only history. Keep the lead's
  // existing assignment scope, and never expose ordinary deleted records.
  if (!record && includeConvertedLead && moduleName === 'Leads') {
    record = await Model.findOne(readScope(req, req.actor, moduleName, {
      _id: id, deleted: true, 'conversion.completedAt': { $type: 'date' },
    })).lean();
    archived = Boolean(record);
  }
  if (!record) throw error('notFound', 404);
  const editable = moduleName === 'Users' ? canEditUser(req.actor, record)
    : can(req.actor, moduleName, 'update') && Boolean(await Model.exists(recordScope(req.actor, moduleName, { _id: id, deleted: { $ne: true } })));
  return { moduleName, record, editable, archived };
}
module.exports = { loadRecord, error };
