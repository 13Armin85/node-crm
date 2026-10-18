const crypto = require('node:crypto');
const normalize = value => String(value ?? '').normalize('NFKC')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9')
  .replace(/[\u200c\u200d]/g, ' ').replace(/[\u06f0-\u06f9]/g, c => String(c.charCodeAt(0) - 0x6f0))
  .replace(/[\u0660-\u0669]/g, c => String(c.charCodeAt(0) - 0x660))
  .toLocaleLowerCase('en-US').trim().replace(/\s+/g, ' ');
const phone = value => normalize(value).replace(/[^\d]/g, '').replace(/^00/, '');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const token = (field, value) => value ? `${field}:${digest(value)}` : null;
const fieldsFor = moduleName => ({
  Contacts: ['email', 'phoneNumber', 'mobileNumber', 'fullName', 'firstName', 'lastName'],
  Leads: ['leadEmail', 'leadPhoneNumber', 'leadMobile', 'leadName'],
  PartnerCustomers: ['email', 'phone', 'whatsapp', 'taxNumber', 'fullName', 'companyName'],
  Residences: ['name', 'city', 'district', 'neighborhood', 'address'],
  Properties: ['title', 'name', 'propertyAddress', 'district', 'neighborhood', 'residence'],
})[moduleName] || [];
function identityTokens(moduleName, record) {
  if (record.deleted) return [];
  let entries = [];
  if (['Contacts', 'Leads', 'PartnerCustomers'].includes(moduleName)) {
    const emailField = moduleName === 'Leads' ? 'leadEmail' : 'email';
    const phoneFields = moduleName === 'Contacts' ? ['phoneNumber', 'mobileNumber'] : moduleName === 'Leads' ? ['leadPhoneNumber', 'leadMobile'] : ['phone', 'whatsapp'];
    entries.push(token(emailField, normalize(record[emailField])));
    entries.push(...phoneFields.map(field => token('phone', phone(record[field]))));
    if (moduleName === 'PartnerCustomers') entries.push(token('taxNumber', normalize(record.taxNumber)));
    { // A matching name remains a duplicate even when contact details differ.
      const nameField = moduleName === 'Contacts' ? 'fullName' : moduleName === 'Leads' ? 'leadName' : record.customerType === 'COMPANY' ? 'companyName' : 'fullName';
      const name = normalize(record[nameField] || (moduleName === 'Contacts' ? [record.firstName, record.lastName].filter(Boolean).join(' ') : ''));
      entries.push(token(nameField, name));
    }
  } else if (moduleName === 'Residences') {
    if (normalize(record.name)) entries.push(token('name', JSON.stringify(['name', 'city', 'district', 'neighborhood', 'address'].map(field => normalize(record[field])))));
  } else if (moduleName === 'Properties') {
    const name = normalize(record.title || record.name);
    if (name) entries.push(token('title', JSON.stringify([name, ...['propertyAddress', 'district', 'neighborhood', 'residence'].map(field => normalize(record[field]))])));
  }
  return [...new Set(entries.filter(Boolean))];
}
const duplicateError = field => Object.assign(new Error('This record already exists'), { code: 'duplicate', status: 409, field });
const fieldFor = (key, moduleName, record) => key.split(':')[0] !== 'phone' ? key.split(':')[0]
  : (moduleName === 'Contacts' ? record.phoneNumber ? 'phoneNumber' : 'mobileNumber' : moduleName === 'Leads' ? record.leadPhoneNumber ? 'leadPhoneNumber' : 'leadMobile' : record.phone ? 'phone' : 'whatsapp');
// The expression is evaluated by MongoDB so legacy number/string fields behave alike.
// Only likely legacy candidates are loaded; final comparison uses the same normalization as the index.
function legacyCandidates(moduleName, record) {
  if (moduleName === 'Contacts' && !normalize(record.fullName)) record = { ...record, fullName: [record.firstName, record.lastName].filter(Boolean).join(' ') };
  const names = fieldsFor(moduleName);
  const candidates = names.filter(field => record[field] != null && normalize(record[field])).map(field => {
    const isPhone = /phone|mobile|whatsapp/i.test(field);
    const normalized = isPhone ? phone(record[field]) : normalize(record[field]);
    const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const text = [...normalized].map(character => {
      if (character === ' ') return '[\\s\u200c\u200d]+';
      if (character === '\u06cc') return '[\u06cc\u064a\u0649]';
      if (character === '\u06a9') return '[\u06a9\u0643]';
      if (/\d/.test(character)) return `[${character}${String.fromCharCode(0x6f0 + Number(character))}${String.fromCharCode(0x660 + Number(character))}]`;
      return escape(character);
    }).join(isPhone ? '[^0-9\u06f0-\u06f9\u0660-\u0669]*' : '');
    const targets = isPhone ? names.filter(name => /phone|mobile|whatsapp/i.test(name)) : [field];
    return { $or: targets.map(target => ({ $expr: { $regexMatch: { input: { $convert: { input: '$' + target, to: 'string', onError: '', onNull: '' } }, regex: '^\\s*' + (isPhone ? '(?:\\+|00)?' : '') + text + '\\s*$', options: 'i' } } })) };
  });
  if (moduleName === 'Contacts' && record.fullName) candidates.push({ $expr: { $eq: [{ $toLower: { $trim: { input: { $concat: [{ $ifNull: ['$firstName', ''] }, ' ', { $ifNull: ['$lastName', ''] }] } } } }, normalize(record.fullName)] } });
  return candidates;
}
async function assertUnique(model, record, excludeId) {
  const keys = identityTokens(model.modelName, record);
  if (!keys.length) return keys;
  const query = { deleted: { $ne: true }, ...(excludeId ? { _id: { $ne: excludeId } } : {}), $or: [
    { _duplicateKeys: { $in: keys } }, ...legacyCandidates(model.modelName, record),
  ] };
  const candidates = await model.find(query).select([...fieldsFor(model.modelName), 'customerType', '_duplicateKeys', 'deleted'].join(' ')).lean();
  for (const candidate of candidates) {
    const collision = identityTokens(model.modelName, candidate).find(key => keys.includes(key));
    if (collision) throw duplicateError(fieldFor(collision, model.modelName, record));
  }
  return keys;
}
function duplicateRecords(schema, { moduleName }) {
  const identityFields = fieldsFor(moduleName);
  schema.add({ _duplicateKeys: { type: [String], default: undefined, select: false } });
  // Unique multikey index serializes conflicting writes, including simultaneous imports.
  // Existing rows are checked above without rewriting or deleting user data.
  schema.index({ _duplicateKeys: 1 }, { unique: true, partialFilterExpression: { deleted: false, _duplicateKeys: { $type: 'string' } } });
  schema.pre('save', async function () {
    if (!this.isNew && !this.isModified('deleted') && !identityFields.some(field => this.isModified(field))) return;
    await this.constructor.init();
    const keys = await assertUnique(this.constructor, this.toObject(), this._id);
    this.set('_duplicateKeys', keys.length ? keys : undefined);
  });
  schema.pre('insertMany', function (next, rows) {
    (async () => {
      await this.init();
      const seen = new Set();
      for (const row of rows) {
        const keys = await assertUnique(this, row, row._id);
        for (const key of keys) {
          if (seen.has(key)) throw duplicateError(fieldFor(key, moduleName, row));
          seen.add(key);
        }
        row._duplicateKeys = keys.length ? keys : undefined;
      }
    })().then(() => next(), next);
  });
  for (const operation of ['findOneAndUpdate', 'updateOne']) schema.pre(operation, async function () {
    const update = this.getUpdate() || {};
    const changes = { ...update, ...update.$set, ...update.$setOnInsert };
    if (!('deleted' in changes) && !identityFields.some(field => field in changes || field in (update.$unset || {}))) return;
    const previous = await this.model.findOne(this.getFilter()).lean();
    if (!previous && !this.getOptions().upsert) return;
    const record = { ...previous, ...changes };
    for (const field of Object.keys(update.$unset || {})) delete record[field];
    await this.model.init();
    const keys = await assertUnique(this.model, record, previous?._id);
    const next = Object.keys(update).some(key => key.startsWith('$')) ? { ...update, $set: { ...update.$set } } : { $set: { ...update } };
    if (keys.length) next.$set._duplicateKeys = keys;
    else { next.$unset = { ...next.$unset, _duplicateKeys: 1 }; delete next.$set._duplicateKeys; }
    this.setUpdate(next);
  });
  const clean = (doc, result) => { if (result) delete result._duplicateKeys; return result; };
  schema.set('toJSON', { ...schema.get('toJSON'), transform: clean });
}
module.exports = { normalize, phone, identityTokens, assertUnique, duplicateError, duplicateRecords };
