const { invoiceNumber, normalizeDiscountType, roundMoney, calculateInvoice } = require('../../client/src/utils/invoiceCalculations');
const { fail } = require('./estateValidation');

function normalizeInvoiceAmounts(body, previous = {}) {
  const values = { ...previous, ...body };
  const numeric = (value, field) => {
    const number = invoiceNumber(value);
    if (!Number.isFinite(number) || number < 0 || number > Number.MAX_SAFE_INTEGER / 100) fail(field);
    return number;
  };
  if (values.isCheck) for (const key of ['Street', 'City', 'State', 'PostalCode', 'Country']) values['shipping' + key] = values['billing' + key] || '';
  for (const field of ['billingPostalCode', 'shippingPostalCode']) {
    if (values[field] && !/^\d{5}$/.test(String(values[field]).trim())) fail(field);
  }
  const ptax = values.ptax == null || values.ptax === '' ? 20 : numeric(values.ptax, 'ptax');
  const historical = ['8', '18'].includes(String(ptax)) &&
    (String(previous.ptax) === String(ptax) || (values.invoiceDate && new Date(values.invoiceDate) < new Date('2023-07-10')));
  if (![0, 1, 10, 20].includes(ptax) && !historical) fail('ptax');
  const currency = values.currency === '$' ? 'USD' : values.currency || 'TRY';
  if (!['TRY', 'USD', 'EUR'].includes(currency)) fail('currency');
  if (!Array.isArray(values.items || [])) fail('items');
  const items = (values.items || []).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`items[${index}]`);
    const qty = numeric(item.qty, `items[${index}].qty`);
    const rate = numeric(item.rate, `items[${index}].rate`);
    const discount = numeric(item.discount, `items[${index}].discount`);
    const discountType = normalizeDiscountType(item.discountType);
    if (!['none', 'percent', 'flatAmount'].includes(discountType)) fail(`items[${index}].discountType`);
    if ((discountType === 'percent' && discount > 100) || (discountType === 'flatAmount' && discount > roundMoney(qty * rate))) fail(`items[${index}].discount`);
    numeric(qty * rate, `items[${index}].amount`);
    return { ...item, qty, rate, discount, discountType };
  });
  const amounts = calculateInvoice({ ...values, items, shipping: numeric(values.shipping, 'shipping'), ptax });
  numeric(amounts.grandTotal, 'grandTotal');
  const address = {};
  for (const prefix of ['billing', 'shipping']) for (const key of ['Street', 'City', 'State', 'PostalCode', 'Country']) {
    const field = prefix + key;
    if (values[field] !== undefined) address[field] = key === 'PostalCode' ? String(values[field] || '').trim() : values[field];
  }
  const relations = Object.fromEntries(['property', 'account', 'contact', 'assignedTo', 'quotesId'].filter(key => body[key] === '').map(key => [key, null]));
  return { ...body, ...relations, ...address, ...amounts, currency };
}
// Preserve summary-only legacy invoices until their rows are explicitly edited.
const invoiceDisplayAmounts = invoice => Array.isArray(invoice.items) && invoice.items.length ? calculateInvoice(invoice) : {};
module.exports = { normalizeInvoiceAmounts, invoiceDisplayAmounts };
