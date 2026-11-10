const mongoose = require('mongoose');
const moduleNames = ['Contacts', 'Leads', 'Opportunities'];
const pending = new Map();
const models = () => ({
  Contacts: require('../model/schema/contact').Contact,
  Leads: require('../model/schema/lead').Lead,
  Opportunities: require('../model/schema/opprtunity'),
});
const validId = value => /^[a-f\d]{24}$/i.test(String(value || ''));

// Follow explicit customer/conversion links only. A shared property, agent,
// partner company or similar name does not make two customers the same person.
async function customerHistory(moduleName, recordId, req) {
  const ids = Object.fromEntries(moduleNames.map(name => [name, new Set()]));
  const records = Object.fromEntries(moduleNames.map(name => [name, new Map()]));
  const add = (name, id) => { if (validId(id)) ids[name].add(String(id)); };
  add(moduleName, recordId);
  let previousSize = -1;
  while (previousSize !== moduleNames.reduce((sum, name) => sum + ids[name].size, 0)) {
    previousSize = moduleNames.reduce((sum, name) => sum + ids[name].size, 0);
    const oid = name => [...ids[name]].map(id => new mongoose.Types.ObjectId(id));
    const clauses = {
      Contacts: [{ _id: { $in: oid('Contacts') } }, { 'convertedLeads.leadId': { $in: [...ids.Leads] } }],
      Leads: [{ _id: { $in: oid('Leads') } }, { contact: { $in: oid('Contacts') } },
        { lead: { $in: oid('Leads') } }, { 'conversion.contactId': { $in: oid('Contacts') } },
        { 'conversion.opportunityId': { $in: oid('Opportunities') } }],
      Opportunities: [{ _id: { $in: oid('Opportunities') } }, { contact: { $in: oid('Contacts') } },
        { sourceContact: { $in: oid('Contacts') } }, { lead: { $in: oid('Leads') } },
        { 'convertedLeads.leadId': { $in: [...ids.Leads] } },
        { 'convertedContacts.contactId': { $in: [...ids.Contacts] } }],
    };
    const found = await Promise.all(moduleNames.map(async name => {
      let query = { $and: [{ $or: clauses[name] }, name === 'Leads'
        ? { $or: [{ deleted: { $ne: true } }, { 'conversion.completedAt': { $type: 'date' } }] }
        : { deleted: { $ne: true } }] };
      if (req) query = require('./recordAccess').readScope(req, req.actor, name, query);
      return [name, await models()[name].find(query).select('contact lead sourceContact conversion listedFor convertedLeads.leadId convertedLeads.values.listedFor convertedContacts.contactId deleted').lean()];
    }));
    for (const [name, items] of found) for (const item of items) {
      records[name].set(String(item._id), item); add(name, item._id);
      if (name === 'Leads') {
        add('Leads', item.lead); add('Contacts', item.contact);
        add('Contacts', item.conversion?.contactId); add('Opportunities', item.conversion?.opportunityId);
      }
      if (name === 'Opportunities') {
        add('Contacts', item.contact); add('Contacts', item.sourceContact); add('Leads', item.lead);
        for (const source of item.convertedContacts || []) add('Contacts', source.contactId);
      }
      for (const source of item.convertedLeads || []) add('Leads', source.leadId);
    }
  }
  return records;
}

async function syncRequestType(moduleName, record, explicit = false) {
  const history = await customerHistory(moduleName, record._id);
  const own = record.toObject ? record.toObject() : record;
  const all = moduleNames.flatMap(name => [...history[name].values()]);
  const value = explicit ? own.listedFor ?? '' : own.listedFor
    || all.find(item => item.listedFor)?.listedFor
    || all.flatMap(item => item.convertedLeads || []).find(item => item.values?.listedFor)?.values.listedFor;
  if (value === undefined) return;
  const key = moduleNames.flatMap(name => [...history[name].keys()].map(id => name + ':' + id)).sort()[0];
  const work = (pending.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
    for (const name of moduleNames) {
      const recordIds = [...history[name].keys()].map(id => new mongoose.Types.ObjectId(id));
      // Bypass hooks to avoid recursive propagation. Never rewrite source snapshots.
      if (recordIds.length) await models()[name].collection.updateMany({ _id: { $in: recordIds } }, { $set: { listedFor: value } });
    }
    record.listedFor = value;
  });
  pending.set(key, work);
  try { await work; } finally { if (pending.get(key) === work) pending.delete(key); }
}

function sharedRequestType(schema, { moduleName }) {
  schema.add({ listedFor: String });
  const relationKeys = ['contact', 'lead', 'sourceContact', 'convertedLeads', 'convertedContacts', 'conversion.completedAt'];
  schema.pre('save', function () {
    this.$locals.syncRequestType = this.isNew || this.isModified('listedFor') || relationKeys.some(key => this.isModified(key));
    this.$locals.explicitRequestType = this.isModified('listedFor') && (!this.isNew || Boolean(this.listedFor));
  });
  schema.post('save', async function (record) {
    if (this.$locals.syncRequestType) await syncRequestType(moduleName, record, this.$locals.explicitRequestType);
  });
  schema.post('insertMany', async function (records) {
    for (const record of records) await syncRequestType(moduleName, record, Boolean(record.listedFor));
  });
  for (const operation of ['findOneAndUpdate', 'updateOne']) {
    schema.post(operation, async function (result) {
      const update = this.getUpdate() || {};
      const changed = { ...update, ...update.$set, ...update.$setOnInsert };
      const explicit = Object.hasOwn(changed, 'listedFor') || Object.hasOwn(update.$unset || {}, 'listedFor');
      if (!explicit && !relationKeys.some(key => Object.hasOwn(changed, key))) return;
      const record = await this.model.findOne(this.getFilter()).lean();
      if (record) {
        if (explicit) record.listedFor = changed.listedFor ?? '';
        await syncRequestType(moduleName, record, explicit);
        if (operation === 'findOneAndUpdate' && result) result.listedFor = record.listedFor;
      }
    });
  }
}

module.exports = { customerHistory, syncRequestType, sharedRequestType };
