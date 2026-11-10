/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Verify dashboard totals and the currency data rendered for each card. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from 'i18n';
import { getApi } from 'services/api';
import Dashboard from '../index';
import CommissionPerformance from './CommissionPerformance';
jest.mock('services/api', () => ({ getApi: jest.fn() }));
jest.mock('react-redux', () => ({ useSelector: selector => selector({ modules: { data: [] } }) }));
jest.mock('../../reports/components/reportChart', () => () => <div data-testid="communication-chart" />);
jest.mock('components/CurrencyAmount', () => ({ values }) => <span data-values={JSON.stringify(values)}>TRY / USD</span>);
let container;
const data = Object.fromEntries(['soldProperties', 'successfulIncome', 'lostIncome', 'unsoldProperties'].map((key, index) => [key, { count: 1, values: [{ currency: 'USD', amount: index + 1 }, { currency: 'TRY', amount: 100 }] }]));
const ranking = { bySeller: [{ userId: 'seller-1', rank: 1, name: 'Seller One', soldCount: 2, salesValues: [{ currency: 'TRY', amount: 10000 }], values: [{ currency: 'TRY', amount: 500 }] }] };
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); getApi.mockReset();
  localStorage.setItem('crm-language', 'en'); localStorage.setItem('user', JSON.stringify({ role: 'admin', firstName: 'User' }));
  getApi.mockImplementation(async url => ({ status: 200, data: url.includes('/sales-summary?') ? ranking : url === 'api/status/' ? { data: { leadData: [], taskData: [] } } : url === 'api/reporting/line-chart' ? ['Tasks', 'Contacts', 'Leads', 'Properties'].map(name => ({ name, length: 1, color: 'blue' })) : data }));
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); });
const render = (Component = CommissionPerformance) => act(async () => { ReactDOM.render(<ChakraProvider><LanguageProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Component /></MemoryRouter></LanguageProvider></ChakraProvider>, container); });
test('financial section shows the four requested values and preserves the team ranking', async () => {
  await render();
  expect(getApi).toHaveBeenCalledWith('api/estate/dashboard/finance');
  expect(container.querySelectorAll('[data-finance-bucket]')).toHaveLength(4);
  for (const key of Object.keys(data)) expect(JSON.parse(container.querySelector(`[data-finance-bucket="${key}"] [data-values]`).dataset.values)).toEqual(data[key].values);
  expect(container.textContent).toContain('Total value of sold properties');
  expect(container.textContent).toContain('Successful income');
  expect(container.textContent).toContain('Lost income');
  expect(container.textContent).toContain('Value of unsold properties');
  expect(container.querySelector('.crm-team-sales-table').textContent).toContain('Seller One');
});
test('failed financial summaries display an error without presenting false zero totals', async () => {
  getApi.mockImplementation(async url => url.includes('/sales-summary?') ? { status: 200, data: ranking } : { status: 500 }); await render();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelectorAll('[data-finance-bucket]')).toHaveLength(0);
  expect(container.querySelector('.crm-team-sales-table').textContent).toContain('Seller One');
});
test('previous dashboard counters, reports, charts and status sections remain alongside the financial cards', async () => {
  await render(Dashboard);
  expect(container.querySelector('.crm-dashboard-hero')).not.toBeNull();
  expect(container.textContent).toContain('Browse properties'); expect(container.textContent).toContain('Open tasks');
  expect(container.querySelectorAll('.crm-dashboard-stats .crm-stat-card')).toHaveLength(4);
  expect(container.querySelectorAll('.crm-dashboard-charts .crm-dashboard-panel')).toHaveLength(2);
  expect(container.querySelector('[data-testid="communication-chart"]')).not.toBeNull();
  expect(container.querySelector('.crm-bar-chart')).not.toBeNull();
  expect(container.querySelectorAll('.crm-dashboard-statistic')).toHaveLength(4);
  expect(container.querySelector('.crm-lead-chart .crm-radial-chart')).not.toBeNull();
  expect(container.textContent).toContain('Lead Statistics'); expect(container.textContent).toContain('Task Statistics');
  expect(container.querySelectorAll('.crm-dashboard-task-status')).toHaveLength(5);
  expect(container.querySelectorAll('[data-finance-bucket]')).toHaveLength(4);
  expect(container.querySelector('.crm-team-sales-table').textContent).toContain('Seller One');
});
test('income period filters commissions while ranking controls make independent requests', async () => {
  await render();
  await act(async () => Simulate.change(container.querySelector('select[aria-label="Income period"]'), { target: { value: 'month' } }));
  expect(getApi).toHaveBeenCalledWith('api/estate/dashboard/finance?period=month');
  await act(async () => Simulate.change(container.querySelector('select[aria-label="Ranking period"]'), { target: { value: '6' } }));
  await act(async () => Simulate.change(container.querySelector('select[aria-label="Currency"]'), { target: { value: 'USD' } }));
  expect(getApi).toHaveBeenCalledWith('api/estate/dashboard/sales-summary?period=year&teamMonths=6&currency=USD');
  expect(container.querySelectorAll('[data-finance-bucket]')).toHaveLength(4);
});
