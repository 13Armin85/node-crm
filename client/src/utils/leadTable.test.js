import { leadOwnerName, leadPropertyName, leadPhone, leadTransactionType, leadCreationDate } from './leadTable';

test('lead columns use assigned users, related property titles and stored request and phone fields', () => {
  const lead = { assignUser: { firstName: 'Assigned', lastName: 'Agent' }, createBy: { username: 'Creator' },
    associatedListing: { title: 'Related Property' }, listedFor: 'Buy', leadMobile: '+905551234567' };
  expect(leadOwnerName(lead)).toBe('Assigned Agent'); expect(leadPropertyName(lead)).toBe('Related Property');
  expect(leadTransactionType(lead)).toBe('SALE'); expect(leadPhone(lead)).toBe('+905551234567');
  expect(leadOwnerName({ createBy: lead.createBy })).toBe('Creator');
  expect(leadTransactionType({ listedFor: { value: 'Rent' } })).toBe('RENT');
  expect(leadTransactionType({ transactionType: 'SALE', listedFor: 'Rent' })).toBe('RENT');
  expect(leadTransactionType({ transactionType: 'RENT', listedFor: 'Buy' })).toBe('SALE');
  expect(leadPhone({ leadPhoneNumber: '+12345', leadMobile: '+67890' })).toBe('+12345');
});

test('optional and missing lead data render safely', () => {
  expect(leadOwnerName({})).toBe(''); expect(leadPropertyName({ associatedListing: null })).toBe('');
  expect(leadPropertyName({ associatedListing: 'unpopulated-id' })).toBe('');
  expect(leadPhone({})).toBe(''); expect(leadTransactionType({})).toBe('');
  expect(leadCreationDate(undefined)).toBe('-'); expect(leadCreationDate('bad date')).toBe('-');
  expect(leadCreationDate('2026-10-24T12:00:00Z')).not.toBe('-');
});
