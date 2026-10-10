// Normalize keyboard and Unicode variants consistently across supported languages.
export const normalizeSearchText = value => String(value ?? '')
  .normalize('NFKD')
  .toLowerCase()
  .replace(/\u0131/g, 'i')
  .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
  .replace(/[\u064a\u0649]/g, '\u06cc')
  .replace(/\u0643/g, '\u06a9')
  .replace(/[\u0640\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export const matchesSearch = (values, query) => {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean);
  const haystacks = values.map(normalizeSearchText).map(value => value.replace(/\s/g, ''));
  return terms.every(term => haystacks.some(value => value.includes(term)));
};
