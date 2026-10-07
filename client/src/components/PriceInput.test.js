/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- These tests use ReactDOM directly. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import PriceInput from './PriceInput';
import { formatPriceInput, normalizePriceInput } from 'utils/price';

test('groups prices and accepts pasted Persian and Arabic amounts', () => {
  expect(formatPriceInput(1500000)).toBe('1,500,000');
  expect(formatPriceInput(0)).toBe('0');
  expect(formatPriceInput('1234567.50')).toBe('1,234,567.50');
  expect(normalizePriceInput('۱٬۲۳۴٬۵۶۷٫۵۰')).toBe('1234567.50');
  expect(normalizePriceInput('١,٢٣٤')).toBe('1234');
});

test('price input displays separators but sends a numeric value and supports clearing', () => {
  const container = document.createElement('div');
  const onValueChange = jest.fn();
  act(() => { ReactDOM.render(<PriceInput value={1500000} onValueChange={onValueChange} />, container); });
  const input = container.querySelector('input');
  expect(input.value).toBe('1,500,000');
  act(() => {
    input.value = '۲٬۵۰۰٬۰۰۰';
    Simulate.change(input);
  });
  expect(input.value).toBe('2,500,000');
  expect(onValueChange).toHaveBeenLastCalledWith(2500000);
  act(() => { ReactDOM.render(<PriceInput value={2500000} onValueChange={onValueChange} />, container); });
  act(() => { input.value = ''; Simulate.change(input); });
  expect(onValueChange).toHaveBeenLastCalledWith('');
  act(() => { ReactDOM.unmountComponentAtNode(container); });
});
