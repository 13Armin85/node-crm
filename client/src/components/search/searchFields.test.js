import { normalizeSearchFields, matchesSelectValue } from './searchFields';

const propertyId = '64d33173fd7ff3fa0924a101';
const userId = '64d33173fd7ff3fa0924a102';
const fields = [
  { name: 'associatedListing', type: 'select', ref: 'Properties', options: [{ value: 'Project 2', name: 'Project 2' }] },
  { name: 'assignUser', type: 'select', ref: 'User', options: [{ value: 'From Project 1', name: 'From Project 1' }] },
  { name: 'leadStatus', type: 'select', options: [{ value: 'pending', name: 'Pending' }] },
];

test('advanced filters show the real property and user names, deduplicated by their stored IDs', () => {
  const row = { associatedListing: { _id: propertyId, title: 'Garden Villa' }, assignUser: { _id: userId, firstName: 'Assigned', lastName: 'Agent' } };
  const normalized = normalizeSearchFields(fields, [row, row]);
  expect(normalized[0].options).toEqual([{ value: propertyId, label: 'Garden Villa' }]);
  expect(normalized[1].options).toEqual([{ value: userId, label: 'Assigned Agent' }]);
  expect(normalized[2].options).toEqual(fields[2].options);
  expect(normalized.slice(-2).map(field => field.name)).toEqual(['createdDate', 'updatedDate']);
  expect(fields[0].options[0].name).toBe('Project 2');
});

test('missing and unresolved relationships never become sample projects or visible IDs', () => {
  const normalized = normalizeSearchFields(fields, [{ associatedListing: null }, { associatedListing: propertyId, assignUser: { _id: userId } }]);
  expect(normalized[0].options).toEqual([]);
  expect(normalized[1].options).toEqual([]);
});

test('selected IDs match both populated and unpopulated relationships without matching other records', () => {
  expect(matchesSelectValue({ _id: propertyId, title: 'Garden Villa' }, propertyId)).toBe(true);
  expect(matchesSelectValue(propertyId, propertyId)).toBe(true);
  expect(matchesSelectValue([{ _id: propertyId }], propertyId)).toBe(true);
  expect(matchesSelectValue({ _id: userId }, propertyId)).toBe(false);
  expect(matchesSelectValue(null, propertyId)).toBe(false);
  expect(matchesSelectValue(undefined, '')).toBe(true);
  expect(matchesSelectValue({ value: 'pending' }, 'pending')).toBe(true);
});
