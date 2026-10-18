const normalize = value => String(value ?? '').normalize('NFKD').toLowerCase()
  .replace(/\u0131/g, 'i').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9')
  .replace(/[\u0640\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '')
  .replace(/[\u06f0-\u06f9]/g, digit => String(digit.charCodeAt(0) - 1776))
  .replace(/[\u0660-\u0669]/g, digit => String(digit.charCodeAt(0) - 1632)).trim();
const variants = { i: '[iIİı]', c: '[cCçÇ]', g: '[gGğĞ]', o: '[oOöÖ]', s: '[sSşŞ]', u: '[uUüÜ]',
  '\u06cc': '[\u06cc\u064a\u0649]', '\u06a9': '[\u06a9\u0643]' };
const escape = value => value.replace(/[.*+?^\$\{\}()|[\]\\]/g, '\\$&');
const ignored = '[\u0300-\u036f\u064b-\u065f\u0670\u06d6-\u06ed\u0640\u200b-\u200f\u202a-\u202e\u2066-\u2069]*';
function searchCondition(fields, query, numericFields = []) {
  const terms = normalize(String(query || '').slice(0, 100)).split(/\s+/).filter(Boolean).slice(0, 12);
  if (!terms.length) return {};
  return { $and: terms.map(term => {
    const pattern = [...term].map(char => variants[char] || (/\d/.test(char)
      ? `[${char}${String.fromCharCode(1776 + Number(char))}${String.fromCharCode(1632 + Number(char))}]` : escape(char))).join(ignored);
    return { $or: fields.map(field => numericFields.includes(field)
      ? { $expr: { $regexMatch: { input: { $convert: { input: '$' + field, to: 'string', onError: '', onNull: '' } }, regex: pattern, options: 'i' } } }
      : { [field]: { $regex: pattern, $options: 'i' } }) };
  }) };
}
const optionLabel = item => item.title || item.name || item.companyName || item.fullName ||
  [item.firstName, item.lastName].filter(Boolean).join(' ') || item.username || item.email ||
  item.leadName || item.folderName || item.propertyType || String(item._id);
module.exports = { searchCondition, optionLabel };
