// Pure calculations shared by invoice entry and the API. Amounts are rounded to kurus.
const invoiceNumber = value => {
  if (typeof value === 'number') return value;
  const raw = String(value ?? '').trim()
    .replace(/[\u06f0-\u06f9]/g, digit => String(digit.charCodeAt(0) - 1776))
    .replace(/[\u0660-\u0669]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[\s\u066c]/g, '').replace(/\u066b/g, '.');
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  return normalized === '' ? 0 : Number(normalized);
};
const roundMoney = value => {
  const [coefficient, exponent = 0] = String(value).split('e');
  return Number(`${Math.round(Number(`${coefficient}e${Number(exponent) + 2}`))}e-2`);
};
const nonnegative = value => {
  const number = invoiceNumber(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};
const normalizeDiscountType = value => ({ Percentage: 'percent', Fixed: 'flatAmount' })[value] || value || 'none';
function calculateInvoice(values = {}) {
  const items = (Array.isArray(values.items) ? values.items : []).map((item, index) => {
    const qty = nonnegative(item.qty), rate = nonnegative(item.rate);
    const gross = roundMoney(qty * rate);
    const discountType = normalizeDiscountType(item.discountType);
    const discount = nonnegative(item.discount);
    const totalDiscount = roundMoney(Math.min(gross, discountType === 'percent'
      ? gross * Math.min(100, discount) / 100 : discountType === 'flatAmount' ? discount : 0));
    return { ...item, id: index + 1, qty, rate, discountType, discount, totalDiscount, amount: roundMoney(gross - totalDiscount) };
  });
  const total = roundMoney(items.reduce((sum, item) => sum + roundMoney(item.qty * item.rate), 0));
  const discount = roundMoney(items.reduce((sum, item) => sum + item.totalDiscount, 0));
  const subtotal = roundMoney(total - discount);
  const shipping = roundMoney(nonnegative(values.shipping));
  // Legacy shippingTax holds the taxable base, including incidental delivery costs.
  const shippingTax = roundMoney(subtotal + shipping);
  const ptax = values.ptax == null || values.ptax === '' ? 20 : nonnegative(values.ptax);
  const tax = roundMoney(shippingTax * ptax / 100);
  return { items, total, discount, subtotal, shipping, shippingTax, ptax, tax, grandTotal: roundMoney(shippingTax + tax) };
}
module.exports = { invoiceNumber, roundMoney, normalizeDiscountType, calculateInvoice };
