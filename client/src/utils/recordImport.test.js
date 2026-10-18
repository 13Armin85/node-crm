import { automaticMapping, importCell, importFields, prepareImport } from './recordImport';
const field = (name, type = 'text', extra = {}) => ({ name, type, label: { en: name, fa: name }, kind: 'SYSTEM_FIELD', enabled: true, ...extra });

test('mapping matches localized headings and preserves zero, decimals, false, Persian phones and dates', () => {
  const fields = [field('amount', 'number', { label: { en: 'Amount', fa: 'مبلغ' } }), field('active', 'checkbox'), field('phone', 'phone'), field('createdDate')];
  expect(automaticMapping(fields, ['مبلغ', 'active', 'phone']).amount).toBe('مبلغ');
  expect(importFields({ fields }).map(field => field.name)).not.toContain('createdDate');
  expect(importCell('۰', fields[0])).toBe(0);
  expect(importCell('1.234,56', fields[0])).toBe(1234.56);
  expect(importCell(false, fields[1])).toBe(false);
  expect(importCell('خیر', fields[1])).toBe(false);
  expect(importCell('۰۹۱۲۳۴۵۶۷۸۹', fields[2])).toBe('09123456789');
  expect(importCell(new Date('2026-10-18T00:00:00Z'), field('date', 'date'))).toBe('2026-10-18T00:00:00.000Z');
  expect(() => importCell('wrong', fields[0])).toThrow();
});

test('localized choices and structured rows convert without object strings', () => {
  const select = field('status', 'select', { options: [{ value: 'ACTIVE', label: { en: 'Active', fa: 'فعال' } }] });
  expect(importCell('فعال', select)).toBe('ACTIVE');
  expect(() => importCell('Unknown', select)).toThrow();
  expect(importCell('[{"qty":2,"rate":0}]', field('items', 'textarea'))).toEqual([{ qty: 2, rate: 0 }]);
});

test('required errors include source row numbers; custom values remain nested', () => {
  const definition = { fields: [field('name', 'text', { required: true }), { ...field('score', 'number'), kind: 'CUSTOM_FIELD' }] };
  const result = prepareImport([{ Name: 'One', Score: 0 }, { Name: '', Score: 'wrong' }], definition, { name: 'Name', 'customFields.score': 'Score' });
  expect(result.records[0]).toEqual({ name: 'One', customFields: { score: 0 } });
  expect(result.errors).toEqual(expect.arrayContaining([{ row: 3, field: 'name', code: 'required' }, { row: 3, field: 'customFields.score', code: 'invalid' }]));
});

test('a default related contact applies to every imported lead and missing selection is rejected', () => {
  const definition = { fields: [field('leadName', 'text', { required: true }), field('contact', 'select', { relation: 'Contacts' })] };
  const rows = [{ Name: 'A' }, { Name: 'B' }];
  expect(prepareImport(rows, definition, { leadName: 'Name' }, {}, 'Leads').errors[0].field).toBe('leadRelations');
  const result = prepareImport(rows, definition, { leadName: 'Name' }, { contact: '100000000000000000000001' }, 'Leads');
  expect(result.errors).toEqual([]);
  expect(result.records.map(row => row.contact)).toEqual(['100000000000000000000001', '100000000000000000000001']);
});
