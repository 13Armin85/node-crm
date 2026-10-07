export const normalizePriceInput = value => String(value ?? '')
  .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
  .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
  .replace(/[,٬\s]/g, '')
  .replace(/٫/g, '.');

export const formatPriceInput = value => {
  const raw = normalizePriceInput(value);
  if (!raw) return '';
  const [integer, fraction] = raw.split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction !== undefined ? `.${fraction}` : '');
};
