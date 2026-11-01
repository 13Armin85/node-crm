const { test } = require('node:test');
const assert = require('node:assert/strict');
const { enableLeadProperty } = require('../scripts/enable-lead-property');

test('the property selector migration enables the saved picker and preserves administrator metadata', () => {
  const other = { name: 'leadName', kind: 'SYSTEM_FIELD', type: 'text', enabled: true, label: { en: 'Customer' } };
  const property = { name: 'associatedListing', kind: 'SYSTEM_FIELD', type: 'select', enabled: false, external: true,
    relation: 'Properties', label: { fa: 'ملک مرتبط' }, order: 7 };
  const definition = { fields: [other, property], removedFields: ['otherField'] };
  const result = enableLeadProperty(definition);
  assert.equal(result.changed, true); assert.deepEqual(result.fields[0], other);
  assert.equal(result.fields[1].enabled, true); assert.equal(result.fields[1].external, false);
  assert.deepEqual(result.fields[1].label, property.label); assert.equal(result.fields[1].order, 7);
  assert.deepEqual(result.removedFields, ['otherField']); assert.equal(definition.fields[1].enabled, false);
  assert.equal(enableLeadProperty(result).changed, false);
});

test('the property selector migration restores the requested field when it was removed', () => {
  const result = enableLeadProperty({ fields: [], removedFields: ['associatedListing', 'anotherField'] });
  assert.equal(result.changed, true); assert.equal(result.fields[0].name, 'associatedListing');
  assert.equal(result.fields[0].relation, 'Properties'); assert.equal(result.fields[0].enabled, true);
  assert.deepEqual(result.removedFields, ['anotherField']); assert.equal(enableLeadProperty(result).changed, false);
});
