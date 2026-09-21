import { formLabel, formValue } from './formValue';

test('extracts primitive values from populated form relations and statuses', () => {
  expect(formValue({ _id: 'partner-1', companyName: 'Example' })).toBe('partner-1');
  expect(formValue({ value: 'Paid', label: { en: 'Paid' } })).toBe('Paid');
  expect(formValue({ label: 'Pending' })).toBe('Pending');
  expect(formValue(undefined)).toBe('');
  expect(formValue({ unknown: true })).toBe('');
});

test('uses a human-readable label instead of undefined or an object', () => {
  expect(formLabel({ companyName: 'Example Company' })).toBe('Example Company');
  expect(formLabel({ fullName: 'Example Person' })).toBe('Example Person');
  expect(formLabel({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
  expect(formLabel({ username: 'ada' })).toBe('ada');
  expect(formLabel(undefined, 'fallback')).toBe('fallback');
  expect(formLabel('undefined', 'fallback')).toBe('fallback');
  expect(formLabel('Ada undefined')).toBe('Ada');
  expect(formLabel('undefined [object Object]', 'fallback')).toBe('fallback');
  expect(formLabel({ unknown: true }, 'fallback')).toBe('fallback');
});
