const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Email = require('../model/schema/email');
const User = require('../model/schema/user');
const { Contact } = require('../model/schema/contact');
const { Lead } = require('../model/schema/lead');
const mail = require('../middelwares/mail');
const controller = require('../controllers/emailHistory/email');

const actorId = '64d33173fd7ff3fa0924a101';
const contactId = '64d33173fd7ff3fa0924a102';
const leadId = '64d33173fd7ff3fa0924a103';
const otherUser = '64d33173fd7ff3fa0924a104';
function setup(t, body = {}) {
  const saved = [];
  const save = t.mock.method(Email.prototype, 'save', async function () {
    await this.validate();
    saved.push(this.toObject());
    return this;
  });
  const contact = t.mock.method(Contact, 'findOne', () => ({ select: () => ({ lean: async () => ({ email: 'contact@example.test' }) }) }));
  const lead = t.mock.method(Lead, 'findOne', () => ({ select: () => ({ lean: async () => ({ leadEmail: 'lead@example.test' }) }) }));
  t.mock.method(User, 'exists', async () => ({ _id: otherUser }));
  const counter = t.mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }));
  const send = t.mock.method(mail, 'sendEmail', async () => {
    assert.equal(saved[saved.length - 1].deliveryStatus, 'PENDING');
    return '250 Accepted';
  });
  t.mock.method(console, 'error', () => {});
  const req = { actor: { _id: new mongoose.Types.ObjectId(actorId), role: 'admin' }, method: 'POST', params: {},
    body: { recipient: 'direct@example.test', subject: 'Subject', message: 'Written message', type: 'message', ...body } };
  const res = { statusCode: undefined, body: undefined, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  return { req, res, saved, save, send, counter, contact, lead };
}

test('sending to a selected contact uses its saved address and authenticated sender, then counts the successful email', async t => {
  const s = setup(t, { createByContact: contactId, recipient: 'stale@example.test', sender: otherUser, createBy: otherUser, salesAgent: otherUser, property: '' });
  await controller.add(s.req, s.res);
  assert.equal(s.res.statusCode, 200);
  assert.deepEqual(s.send.mock.calls[0].arguments, ['contact@example.test', 'Subject', 'Written message', undefined]);
  assert.equal(s.contact.mock.calls[0].arguments[0].deleted, false);
  assert.equal(String(s.res.body.result.sender), actorId);
  assert.equal(String(s.res.body.result.createBy), actorId);
  assert.deepEqual(s.saved.map(row => row.deliveryStatus), ['PENDING', 'SENT']);
  assert(s.res.body.result.sentAt instanceof Date);
  assert.equal(s.counter.mock.callCount(), 1);
  assert.deepEqual(s.counter.mock.calls[0].arguments[1], { $inc: { emailsent: 1 } });
});

test('a selected lead receives the chosen HTML template without the stale text body', async t => {
  const s = setup(t, { createByLead: leadId, type: 'template', html: '<p>Template body</p>' });
  await controller.add(s.req, s.res);
  assert.equal(s.res.statusCode, 200);
  assert.deepEqual(s.send.mock.calls[0].arguments, ['lead@example.test', 'Subject', undefined, '<p>Template body</p>']);
  assert.equal(s.res.body.result.message, '');
  assert.equal(s.res.body.result.salesAgent, undefined);
});

test('plain messages ignore previously selected HTML templates', async t => {
  const s = setup(t, { html: '<p>Old template</p>' });
  await controller.add(s.req, s.res);
  assert.deepEqual(s.send.mock.calls[0].arguments, ['direct@example.test', 'Subject', 'Written message', undefined]);
  assert.equal(s.res.body.result.html, '');
});

test('SMTP failure records a failed attempt and never reports success or increases sent count', async t => {
  const s = setup(t);
  s.send.mock.mockImplementation(async () => { throw Object.assign(new Error('private SMTP details'), { code: 'EAUTH' }); });
  await controller.add(s.req, s.res);
  assert.equal(s.res.statusCode, 502);
  assert.deepEqual(s.res.body, { code: 'emailSendFailed', field: undefined });
  assert.deepEqual(s.saved.map(row => row.deliveryStatus), ['PENDING', 'FAILED']);
  assert.equal(s.counter.mock.callCount(), 0);
  assert(!JSON.stringify(s.res.body).includes('private SMTP details'));
});

test('missing SMTP configuration is an explicit failure instead of a successful history entry', async t => {
  const s = setup(t);
  s.send.mock.mockImplementation(async () => null);
  await controller.add(s.req, s.res);
  assert.equal(s.res.statusCode, 503);
  assert.equal(s.res.body.code, 'emailNotConfigured');
  assert.equal(s.saved[1].deliveryStatus, 'FAILED');
  assert.equal(s.counter.mock.callCount(), 0);
});

test('invalid or inaccessible recipients and empty content are rejected before saving or sending', async t => {
  const s = setup(t);
  const cases = [
    [{ recipient: 'one@example.test,two@example.test' }, 'recipient'],
    [{ subject: ' ' }, 'subject'], [{ message: ' ' }, 'message'],
    [{ type: 'template', html: '' }, 'html'],
    [{ createByContact: 'bad-id' }, 'createByContact'],
    [{ createByContact: contactId, createByLead: leadId }, 'recipient'],
    [{ property: ['bad-id'] }, 'property'],
  ];
  for (const [changes, field] of cases) {
    const req = { ...s.req, body: { ...s.req.body, ...changes } };
    await controller.add(req, s.res);
    assert.equal(s.res.statusCode, 400);
    assert.equal(s.res.body.field, field);
  }
  s.contact.mock.mockImplementation(() => ({ select: () => ({ lean: async () => null }) }));
  await controller.add({ ...s.req, body: { ...s.req.body, createByContact: contactId } }, s.res);
  assert.equal(s.res.body.code, 'relationNotFound');
  assert.equal(s.save.mock.callCount(), 0);
  assert.equal(s.send.mock.callCount(), 0);
});

test('a database failure before SMTP cannot send an email', async t => {
  const s = setup(t);
  s.save.mock.mockImplementation(async () => { throw new Error('Database unavailable'); });
  await controller.add(s.req, s.res);
  assert.equal(s.res.statusCode, 500);
  assert.equal(s.send.mock.callCount(), 0);
});

test('SMTP success remains successful when the sent counter cannot be updated', async t => {
  const s = setup(t);
  s.counter.mock.mockImplementation(async () => { throw new Error('Count failed'); });
  await controller.add(s.req, s.res);
  assert.equal(s.res.statusCode, 200);
  assert.equal(s.send.mock.callCount(), 1);
  assert.equal(s.res.body.result.deliveryStatus, 'SENT');
});

test('email addresses added by dynamic contact fields are read from the plain record', async t => {
  const s = setup(t, { createByContact: contactId });
  Contact.schema.add({ email: String });
  const hydrated = Contact.hydrate({ _id: contactId, email: 'dynamic@example.test' });
  assert.equal(hydrated.email, undefined);
  assert.equal(hydrated.get('email'), 'dynamic@example.test');
  s.contact.mock.mockImplementation(() => ({ select: () => ({ lean: async () => hydrated.toObject() }) }));
  await controller.add(s.req, s.res);
  assert.equal(s.res.statusCode, 200);
  assert.equal(s.send.mock.calls[0].arguments[0], 'dynamic@example.test');
  assert.equal(s.res.body.result.deliveryStatus, 'SENT');
});
