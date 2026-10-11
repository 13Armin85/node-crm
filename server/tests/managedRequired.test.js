const { test } = require('node:test');
const assert = require('node:assert/strict');
const definitions = require('../services/formDefinitions');
test('legacy APIs enforce administrator-required system fields before reaching controllers', async t => {
  t.mock.method(definitions, 'getDefinition', async () => ({ fields: [
    { name: 'description', kind: 'SYSTEM_FIELD', type: 'textarea', required: true },
    { name: 'confirmation', kind: 'CUSTOM_FIELD', type: 'checkbox', required: true },
  ] }));
  const middleware = require('../middelwares/dynamicValues')('Invoices');
  const run = async body => {
    const req = { actor: { role: 'admin', _id: '64d33173fd7ff3fa0924a109' }, method: 'POST', params: {}, body };
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    let called = false; await middleware(req, res, () => { called = true; });
    return { called, res };
  };
  assert.deepEqual((await run({ description: ' ' })).res.body, { code: 'required', field: 'description' });
  assert.deepEqual((await run({ description: 'Filled', customFields: { confirmation: false } })).res.body, { code: 'required', field: 'customFields.confirmation' });
  assert.equal((await run({ description: 'Filled', customFields: { confirmation: true } })).called, true);
});
