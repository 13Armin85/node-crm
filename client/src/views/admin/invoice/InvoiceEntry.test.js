/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Verify row edits, preview and the actual submitted totals. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { LanguageProvider } from 'i18n';
import AddEdit from './AddEdit';
import { getApi, postApi, putApi } from 'services/api';
jest.mock('@chakra-ui/react', () => {
  const original = jest.requireActual('@chakra-ui/react');
  const Box = ({ children }) => <div>{children}</div>;
  return { ...original, Drawer: ({ isOpen, children }) => isOpen ? <div>{children}</div> : null,
    DrawerContent: Box, DrawerBody: Box, DrawerHeader: Box, DrawerFooter: Box, DrawerOverlay: () => null };
});
jest.mock('services/api', () => ({ getApi: jest.fn(), postApi: jest.fn(), putApi: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
let container;
const button = text => [...container.querySelectorAll('button')].find(item => item.textContent.trim() === text);
const change = (selector, value) => act(async () => {
  const node = container.querySelector(selector);
  Simulate.change(node, { target: { name: node.name, value } });
});
const render = props => act(async () => ReactDOM.render(<ChakraProvider><LanguageProvider><AddEdit isOpen type="add"
  onClose={jest.fn()} setAction={jest.fn()} {...props} /></LanguageProvider></ChakraProvider>, container));
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container);
  localStorage.setItem('user', JSON.stringify({ _id: 'admin', role: 'admin' }));
  getApi.mockImplementation(async path => ({ status: 200, data: path.includes('/definitions/') ? { moduleName: 'Invoices', fields: [] } : [] }));
  postApi.mockReset(); postApi.mockResolvedValue({ status: 200 }); putApi.mockReset(); putApi.mockResolvedValue({ status: 200 });
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); });
test('discount, delivery and KDV agree across form, preview, submission and removal', async () => {
  await render();
  await change('input[name="title"]', 'Invoice');
  await act(async () => Simulate.click(button('Add')));
  await change('input[name="items[0].qty"]', '2');
  await change('input[name="items[0].rate"]', '100');
  await change('select[aria-label="Discount Type 1"]', 'percent');
  await change('input[name="items[0].discount"]', '10');
  await change('input[name="shipping"]', '10');
  expect(container.querySelector('input[name="total"]').value).toBe('200.00');
  expect(container.querySelector('input[name="subtotal"]').value).toBe('180.00');
  expect(container.querySelector('input[name="grandTotal"]').value).toBe('228.00');
  expect(container.querySelector('input[name="grandTotal"]').readOnly).toBe(true);
  await act(async () => Simulate.click(button('Preview')));
  expect(container.querySelector('.totals').textContent).toContain('228,00');
  await act(async () => Simulate.click(button('Hide')));
  await act(async () => Simulate.click(button('Save')));
  expect(postApi).toHaveBeenCalledWith('api/invoices/add', expect.objectContaining({ total: 200, discount: 20, subtotal: 180, shippingTax: 190, tax: 38, grandTotal: 228 }));
  await render();
  await act(async () => Simulate.click(button('Add')));
  await change('input[name="items[0].qty"]', '1');
  await change('input[name="items[0].rate"]', '100');
  await act(async () => Simulate.click(container.querySelector('button[aria-label="Delete 1"]')));
  expect(container.querySelector('input[name="subtotal"]').value).toBe('0.00');
  expect(container.querySelector('input[name="grandTotal"]').value).toBe('0.00');
});
test('editing recalculates stored rows and uses five-digit Turkish postal codes', async () => {
  const invoice = { title: 'Saved', invoiceNumber: '9', billingPostalCode: '34000', currency: 'TRY',
    items: [{ qty: '2', rate: '100', discount: '10', discountType: 'percent', amount: 999 }], grandTotal: '9999', ptax: '20' };
  getApi.mockImplementation(async path => ({ status: 200, data: path.includes('/definitions/') ? { moduleName: 'Invoices', fields: [] } : { result: invoice } }));
  await render({ type: 'edit', selectedId: '9' });
  expect(container.querySelector('input[name="grandTotal"]').value).toBe('216.00');
  await act(async () => Simulate.click(button('Save')));
  expect(putApi).toHaveBeenCalledWith('api/invoices/edit/9', expect.objectContaining({ grandTotal: 216, billingPostalCode: '34000' }));
});
