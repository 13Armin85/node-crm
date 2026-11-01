const mongoose = require('mongoose');
const FormDefinition = require('../model/schema/formDefinition');
const { defaults } = require('../services/formDefinitions');

function enableLeadProperty(definition) {
  const baseline = defaults.Leads.find(field => field.name === 'associatedListing');
  const previous = (definition.fields || []).find(field => field.name === baseline.name);
  const fields = previous ? definition.fields.map(field => field.name === baseline.name
    ? { ...field, kind: 'SYSTEM_FIELD', type: 'select', enabled: true, relation: 'Properties', external: false } : field)
    : [...(definition.fields || []), { ...baseline, external: false, order: (definition.fields || []).length }];
  const removedFields = (definition.removedFields || []).filter(name => name !== baseline.name);
  const changed = !previous || previous.enabled !== true || previous.external !== false
    || previous.relation !== 'Properties' || previous.type !== 'select' || previous.kind !== 'SYSTEM_FIELD'
    || removedFields.length !== (definition.removedFields || []).length;
  return { changed, fields, removedFields };
}

async function main() {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
  await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', {
    dbName: process.env.DB || 'Prolink', autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000,
  });
  try {
    const definition = await FormDefinition.findOne({ moduleName: 'Leads' }).lean();
    if (!definition) { console.log('No saved lead definition; the default property selector is active.'); return; }
    const result = enableLeadProperty(definition);
    if (!result.changed) { console.log('The saved lead property selector is already active.'); return; }
    if (!process.argv.includes('--apply')) { console.log('Preview: enable the related property selector; retain all other form fields and CRM records. Run with --apply to save.'); return; }
    const updated = await FormDefinition.updateOne({ _id: definition._id, revision: definition.revision ?? { $exists: false } }, {
      $set: { fields: result.fields, removedFields: result.removedFields }, $inc: { revision: 1 },
    }, { runValidators: true });
    if (updated.matchedCount !== 1) throw new Error('The form definition changed during publication. Reload and retry.');
    console.log('Enabled the related property selector in the saved lead form.');
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { enableLeadProperty };
