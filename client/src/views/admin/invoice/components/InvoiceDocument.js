import React from 'react';
import BrandLogo from 'components/BrandLogo';
import { tr } from 'i18n/runtime';
import { invoiceNumber, calculateInvoice } from 'utils/invoiceCalculations';

export const invoiceMoney = (amount, currency = 'TRY') => new Intl.NumberFormat('tr-TR', {
  style: 'currency', currency: ['TRY', 'USD', 'EUR'].includes(currency) ? currency : currency === '$' ? 'USD' : 'TRY',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(invoiceNumber(amount) || 0);

const date = value => value ? String(value).slice(0, 10).split('-').reverse().join('.') : '-';
const address = (invoice, prefix) => [
  invoice[prefix + 'Street'], [invoice[prefix + 'City'], invoice[prefix + 'State']].filter(Boolean).join(', '),
  [invoice[prefix + 'Country'], invoice[prefix + 'PostalCode']].filter(Boolean).join(' - '),
].filter(Boolean);

export default function InvoiceDocument({ invoice: saved = {} }) {
  const invoice = { ...saved, ...((saved.items || []).length ? calculateInvoice(saved) : {}) };
  const details = [['Invoice No.', invoice.invoiceNumber || '-'], ['Invoice Date', date(invoice.invoiceDate)],
    ['Name', invoice.title || '-'], ['Property', invoice.propertyName || '-'],
    ['Transaction Type', invoice.transactionType ? tr(invoice.transactionType === 'SALE' ? 'Purchased' : 'Rented') : '-'],
    ['Status', tr(invoice.status || 'Draft')]];
  const totals = [['Total', 'total'], ['Discount', 'discount'], ['Subtotal', 'subtotal'],
    ['Shipping', 'shipping'], ['KDV Matrahı', 'shippingTax'], [`KDV (%${invoice.ptax ?? 20})`, 'tax'], ['Grand Total', 'grandTotal']];
  return <div className="invoice-container crm-invoice-document" dir="ltr">
    <h1>{tr('Invoice')}</h1>
    <div className="invoice-header">
      <BrandLogo style={{ width: '84px', maxWidth: '100%', height: '84px', objectFit: 'contain' }} />
      <div className="invoice-details"><table><tbody>{details.map(([label, value]) =>
        <tr key={label}><th>{tr(label)}</th><td data-no-translate>{value}</td></tr>)}</tbody></table></div>
    </div>
    <div className="address-section">{['billing', 'shipping'].map(prefix =>
      <div className="address" key={prefix}><strong>{tr(prefix === 'billing' ? 'Billing Address' : 'Shipping Address')}</strong>
        {address(invoice, prefix).map((line, index) => <p key={index} data-no-translate>{line}</p>)}</div>)}</div>
    <div className="crm-invoice-table-scroll"><table className="invoice-table">
      <thead><tr>{['#', 'Item', 'Qty', 'Rate', 'Discount', 'Amount'].map(label => <th key={label}>{tr(label)}</th>)}</tr></thead>
      <tbody>{(invoice.items || []).map((item, index) => <tr key={index}>
        <td>{index + 1}</td><td data-no-translate>{item.productName}</td><td>{item.qty}</td>
        <td data-no-translate>{invoiceMoney(item.rate, invoice.currency)}</td>
        <td data-no-translate>{item.discountType === 'percent' || item.discountType === 'Percentage'
          ? `%${item.discount || 0}` : invoiceMoney(item.totalDiscount ?? (item.discountType === 'none' ? 0 : item.discount), invoice.currency)}</td>
        <td data-no-translate>{invoiceMoney(item.amount, invoice.currency)}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="totals"><table><tbody>{totals.map(([label, key]) =>
      <tr key={key}><th>{tr(label)}</th><td data-no-translate>{invoiceMoney(invoice[key], invoice.currency)}</td></tr>)}</tbody></table></div>
    {invoice.description && <div className="footer" data-no-translate>{invoice.description}</div>}
  </div>;
}
