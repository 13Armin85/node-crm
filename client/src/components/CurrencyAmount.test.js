/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- These tests use ReactDOM directly. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import CurrencyAmount, { currencyTotals } from './CurrencyAmount';
import { getApi } from 'services/api';

jest.mock('services/api', () => ({ getApi: jest.fn() }));

const rate = { tryPerUsd: 40, tryPerEur: 50 };
const values = [{ currency: 'TRY', amount: 4000 }, { currency: 'USD', amount: 100 }, { currency: 'EUR', amount: 10 }];

test('mixed currencies are converted and added into one lira total and one dollar total', () => {
  expect(currencyTotals(values, rate)).toEqual({ tryAmount: 8500, usdAmount: 212.5 });
  expect(currencyTotals([{ currency: '$', amount: 100 }, { currency: 'usd', amount: 200 }], rate))
    .toEqual({ tryAmount: 12000, usdAmount: 300 });
});

test('missing exchange rates never produce a partial or misleading total', () => {
  expect(currencyTotals(values, null)).toEqual({ tryAmount: null, usdAmount: null });
  expect(currencyTotals(values, { tryPerUsd: 40 })).toEqual({ tryAmount: null, usdAmount: null });
  expect(currencyTotals([{ currency: 'TRY', amount: 4000 }], null)).toEqual({ tryAmount: 4000, usdAmount: null });
  expect(currencyTotals([{ currency: 'USD', amount: 100 }], null)).toEqual({ tryAmount: null, usdAmount: 100 });
  expect(currencyTotals(values, { tryPerUsd: 0, tryPerEur: 50 })).toEqual({ tryAmount: null, usdAmount: null });
});

test('empty totals are zero and malformed buckets are not silently dropped', () => {
  expect(currencyTotals([], rate)).toEqual({ tryAmount: 0, usdAmount: 0 });
  expect(currencyTotals([...values, { currency: 'GBP', amount: 10 }], rate)).toEqual({ tryAmount: null, usdAmount: null });
  expect(currencyTotals([{ currency: 'TRY', amount: 'bad' }], rate)).toEqual({ tryAmount: null, usdAmount: null });
});

test('a dashboard total renders each currency once after loading its exchange rate', async () => {
  getApi.mockResolvedValue({ status: 200, data: rate });
  const container = document.createElement('div');
  try {
    await act(async () => { ReactDOM.render(<CurrencyAmount values={values} compact />, container); });
    expect(container.querySelectorAll('.crm-currency').length).toBe(1);
    expect(container.querySelectorAll('.crm-currency__primary').length).toBe(1);
    expect(container.querySelectorAll('.crm-currency__usd').length).toBe(1);
    expect(container.querySelector('.crm-currency__primary').textContent).toContain('8,500.00');
    expect(container.querySelector('.crm-currency__usd').textContent).toContain('212.50');
    expect(getApi).toHaveBeenCalledWith('api/estate/dashboard/exchange-rate');
    await act(async () => { ReactDOM.render(<CurrencyAmount amount={100} currency="USD" compact />, container); });
    expect(container.querySelector('.crm-currency__primary').textContent).toContain('4,000.00');
    expect(container.querySelector('.crm-currency__usd').textContent).toContain('100.00');
  } finally {
    act(() => { ReactDOM.unmountComponentAtNode(container); });
  }
});
