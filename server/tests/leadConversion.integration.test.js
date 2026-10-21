const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

test('lead conversion preserves data, moves history, enforces ownership and resumes failed transfers', { skip: process.env.LEAD_CONVERSION_INTEGRATION !== '1' }, async t => {
  const dbName = 'lead_conversion_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  mongoose.set('strictQuery', false);
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    assert(dbName.startsWith('lead_conversion_test_'));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const User = require('../model/schema/user');
  const { Lead } = require('../model/schema/lead');
  const { Contact } = require('../model/schema/contact');
  const Opportunity = require('../model/schema/opprtunity');
  const Document = require('../model/schema/document');
  const Task = require('../model/schema/task');
  const Meeting = require('../model/schema/meeting');
  const Email = require('../model/schema/email');
  const Call = require('../model/schema/phoneCall');
  const Quote = require('../model/schema/quotes');
  Lead.schema.add({ leadName: String, leadEmail: String, leadMobile: String, leadPhoneNumber: String, leadCampaign: String, leadState: String, leadMessage: String, communicationTool: String, listedFor: String, leadStatus: mongoose.Schema.Types.Mixed });
  Contact.schema.add({ fullName: String, email: String, phoneNumber: String, mobileNumber: String, campaign: String, state: String, message: String, communicationTool: String, listedFor: String });
  // Exercise legacy numeric configuration: initialization must preserve phone text.
  const CustomField = require('../model/schema/customField');
  await CustomField.create({ moduleName: 'Contacts', fields: [{ name: 'phoneNumber', backendType: 'Number' }] });
  await require('../model/schema/contact').initializeContactSchema();
  assert.equal(Contact.schema.path('phoneNumber').instance, 'String');
  const actor = await User.create({ username: 'admin@example.test', password: 'unused', role: 'admin' });
  const other = await User.create({ username: 'other@example.test', password: 'unused', role: 'user' });
  const leadModule = await CustomField.create({ moduleName: 'Leads', fields: require('../db/leadFields').leadFields });
  const app = express(); app.use(express.json()); app.use('/api/lead', require('../controllers/lead/_routes'));
  app.use('/api/form', require('../controllers/form/_routes'));
  app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const api = async (id, mode, user = actor) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/lead/convert/' + id, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '5m' }) },
      body: JSON.stringify({ mode }),
    });
    return { status: response.status, data: await response.json() };
  };
  let sequence = 0;
  const makeLead = async extra => (await Lead.create({ leadName: 'Lead ' + ++sequence, leadEmail: 'lead' + sequence + '@example.test',
    leadMobile: '+90 0555 000 ' + sequence, leadCampaign: 'Online', leadState: 'Open', leadMessage: 'All original notes',
    leadStatus: { value: 'qualified', label: 'Qualified' }, communicationTool: 'WhatsApp', listedFor: 'Buy',
    customFields: { budget: 500000, active: false, preferences: ['garden', 'pool'] }, createBy: actor._id, ...extra })).toObject();

  await t.test('users create leads without selections or required fields and can convert them by either action', async () => {
    for (const mode of ['contact', 'contactAndOpportunity']) {
      const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/form/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: jwt.sign({ userId: other._id }, jwtSecret, { expiresIn: '5m' }) },
        body: JSON.stringify({ moduleId: String(leadModule._id) }),
      });
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.equal(body.data.createBy, String(other._id));
      const converted = await api(body.data._id, mode, other);
      assert.equal(converted.status, 200, JSON.stringify(converted));
      assert.equal((await Lead.findById(body.data._id)).deleted, true);
      assert(await Contact.exists({ _id: converted.data.contactId }));
      if (mode === 'contactAndOpportunity') assert(await Opportunity.exists({ _id: converted.data.opportunityId }));
    }
  });

  await t.test('contacts only and complete history transfer', async () => {
    const lead = await makeLead();
    const task = await Task.create({ title: 'Follow up', assignToLead: lead._id, category: 'Lead', createBy: actor._id });
    const meeting = await Meeting.create({ agenda: 'Visit', attendesLead: [lead._id], related: 'Lead', createBy: actor._id });
    const email = await Email.create({ createByLead: lead._id, sender: actor._id });
    const call = await Call.create({ createByLead: lead._id, sender: actor._id });
    const quote = await Quote.create({ lead: lead._id, createBy: actor._id });
    const folder = await Document.create({ folderName: 'Lead docs', createBy: actor._id,
      file: [{ fileName: 'plan.pdf', path: '/test/plan.pdf', linkLead: lead._id, entityType: 'Lead', entityId: lead._id }] });
    const result = await api(lead._id, 'contact');
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.data.opportunityId, null);
    const contact = await Contact.findById(result.data.contactId).lean();
    assert.equal(contact.fullName, lead.leadName); assert.equal(contact.email, lead.leadEmail);
    assert.equal(contact.phoneNumber, lead.leadMobile); assert.equal(contact.campaign, lead.leadCampaign);
    assert.deepEqual(contact.convertedLeads[0].values.customFields, lead.customFields);
    assert.deepEqual(contact.convertedLeads[0].values.leadStatus, lead.leadStatus);
    assert.equal((await Lead.findById(lead._id)).deleted, true);
    assert.equal(await Opportunity.countDocuments({ contact: contact._id }), 0);
    assert.equal(String((await Task.findById(task._id)).assignTo), String(contact._id));
    assert.equal((await Task.findById(task._id)).category, 'Contact');
    assert.equal(String((await Meeting.findById(meeting._id)).attendes[0]), String(contact._id));
    assert.equal((await Meeting.findById(meeting._id)).attendesLead.length, 0);
    for (const [Model, record] of [[Email, email], [Call, call]]) {
      assert.equal(String((await Model.findById(record._id)).createByContact), String(contact._id));
      assert.equal((await Model.findById(record._id)).createByLead, undefined);
    }
    assert.equal(String((await Quote.findById(quote._id)).contact), String(contact._id));
    const file = (await Document.findById(folder._id)).file[0];
    assert.equal(String(file.linkContact), String(contact._id)); assert.equal(file.linkLead, undefined);
    assert.equal(file.entityType, 'Contact');
    assert.equal((await api(lead._id, 'contact')).status, 404);
  });
  await t.test('combined transfer creates connected opportunity with original data', async () => {
    const lead = await makeLead();
    const result = await api(lead._id, 'contactAndOpportunity');
    assert.equal(result.status, 200, JSON.stringify(result));
    const opportunity = await Opportunity.findById(result.data.opportunityId).lean();
    assert.equal(String(opportunity.contact), result.data.contactId);
    assert.equal(opportunity.opportunityName, lead.leadName); assert.equal(opportunity.salesStage, 'Prospecting');
    assert.equal(opportunity.description, lead.leadMessage);
    assert.equal(opportunity.convertedLeads[0].values.leadEmail, lead.leadEmail);
    assert.deepEqual(opportunity.convertedLeads[0].values.customFields, lead.customFields);
    assert((await Contact.findById(result.data.contactId)).relatedOpportunities.some(id => String(id) === result.data.opportunityId));
    assert.equal((await Lead.findById(lead._id)).deleted, true);
  });
  await t.test('linked contact is enriched without overwriting its own data', async () => {
    const existing = await Contact.create({ fullName: 'Existing Contact', createBy: actor._id });
    const lead = await makeLead({ contact: existing._id });
    const result = await api(lead._id, 'contact');
    assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(result.data.contactId, String(existing._id));
    const updated = await Contact.findById(existing._id);
    assert.equal(updated.get('fullName'), 'Existing Contact'); assert.equal(updated.get('email'), lead.leadEmail);
    assert.equal(updated.convertedLeads[0].values.leadName, lead.leadName);
  });
  await t.test('invalid modes, ownership and duplicate contact failures preserve source', async () => {
    const lead = await makeLead();
    assert.equal((await api(lead._id, 'invalid')).status, 400);
    assert.equal((await api(lead._id, 'contact', other)).status, 404);
    await Contact.create({ fullName: 'Different', email: lead.leadEmail, createBy: actor._id });
    assert.equal((await api(lead._id, 'contact')).status, 409);
    const source = await Lead.findById(lead._id);
    assert.equal(source.deleted, false); assert.equal(source.conversion.lock, undefined);
  });
  await t.test('retry after a persistence error reuses destinations and finishes', async () => {
    const lead = await makeLead();
    const original = Document.updateMany;
    Document.updateMany = async () => { throw new Error('Simulated storage error'); };
    let failed;
    try { failed = await api(lead._id, 'contactAndOpportunity'); } finally { Document.updateMany = original; }
    assert.equal(failed.status, 400);
    let source = await Lead.findById(lead._id);
    assert.equal(source.deleted, false); assert.equal(source.conversion.lock, undefined);
    const contactId = String(source.conversion.contactId);
    const opportunityId = String(source.conversion.opportunityId);
    assert.equal((await api(lead._id, 'contact')).status, 409);
    const retry = await api(lead._id, 'contactAndOpportunity');
    assert.equal(retry.status, 200, JSON.stringify(retry));
    assert.equal(retry.data.contactId, contactId); assert.equal(retry.data.opportunityId, opportunityId);
    assert.equal((await Contact.findById(contactId)).convertedLeads.length, 1);
    assert.equal(await Opportunity.countDocuments({ contact: contactId }), 1);
    assert.equal((await Lead.findById(lead._id)).deleted, true);
  });
  await t.test('concurrent requests create only one contact and opportunity', async () => {
    const lead = await makeLead();
    const results = await Promise.all([api(lead._id, 'contactAndOpportunity'), api(lead._id, 'contactAndOpportunity')]);
    assert.equal(results.filter(result => result.status === 200).length, 1, JSON.stringify(results));
    assert.equal(await Contact.countDocuments({ email: lead.leadEmail }), 1);
    assert.equal(await Opportunity.countDocuments({ opportunityName: lead.leadName }), 1);
  });
});
