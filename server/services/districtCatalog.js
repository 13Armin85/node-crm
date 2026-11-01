const District = require('../model/schema/district');
const { normalize } = require('./districtNames');

// Preserve existing names and translated dropdown labels without changing records.
async function importLegacyDistricts() {
  const mongoose = require('mongoose');
  const definitions = await require('../model/schema/formDefinition').find({ 'fields.name': 'district' }).lean();
  const legacy = await require('../model/schema/customField').find({ deleted: false, 'fields.name': 'district' }).lean();
  const names = new Map();
  for (const definition of [...definitions, ...legacy]) {
    for (const option of definition.fields.find(field => field.name === 'district')?.options || []) {
      const name = String(option.value || '').trim();
      if (name && !names.has(normalize(name))) names.set(normalize(name), { name, label: option.label || { en: option.name || name, fa: option.name || name, tr: option.name || name } });
    }
  }
  for (const collection of ['Properties', 'Residences', 'PartnerCustomers']) {
    for (const name of await mongoose.connection.collection(collection).distinct('district', { deleted: { $ne: true } })) {
      if (typeof name === 'string' && name.trim() && !names.has(normalize(name))) names.set(normalize(name), { name: name.trim() });
    }
  }
  await District.init();
  for (const [normalizedName, value] of names) {
    // A deleted catalog entry is deliberately retained as deleted.
    if (!await District.exists({ normalizedName })) await District.create(value);
  }
  return names.size;
}
module.exports = { importLegacyDistricts };
