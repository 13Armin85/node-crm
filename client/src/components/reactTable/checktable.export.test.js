/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises the real shared table and controls. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import reducer from 'redux/slices/advanceSearchSlice';
import { exportSpreadsheet } from 'utils/spreadsheet';
import CommonCheckTable from './checktable';
jest.mock('utils/spreadsheet', () => ({ exportSpreadsheet: jest.fn() }));
jest.mock('components/search/advanceSearch', () => () => null);
jest.mock('components/countUpComponent/countUpComponent', () => ({ targetNumber }) => <span>{targetNumber}</span>);
let container;
beforeEach(() => { jest.clearAllMocks(); localStorage.setItem('crm-language', 'en'); container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); });
const data = [{ _id: 'one', name: 'Alpha', amount: 10 }, { _id: 'two', name: 'Beta', amount: 20 }, { _id: 'hidden', name: 'Other', amount: 30 }];
const columns = [{ Header: '#', accessor: '_id' }, { Header: 'Name', accessor: 'name' }, { Header: 'Amount', accessor: 'amount' }];
const excelMenu = async () => {
  expect(container.querySelector('.crm-excel-export')).toBeNull();
  await act(async () => { Simulate.click(container.querySelector('.crm-table-settings')); });
  return [...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent.includes('Excel'));
};
const render = props => act(() => {
  const store = configureStore({ reducer: { advanceSearchData: reducer } });
  ReactDOM.render(<Provider store={store}><ChakraProvider><CommonCheckTable pageHeader={false} title="Reports" allData={data} columnData={columns} tableCustomFields={[]} AdvanceSearch={false} addBtn={false} {...props} /></ChakraProvider></Provider>, container);
});
test('exports the filtered rows on pages without selection setters, including reports', async () => {
  render();
  act(() => { Simulate.change(container.querySelector('input[type="text"]'), { target: { value: 'Alpha' } }); });
  const item = await excelMenu();
  expect(item).toBeDefined();
  await act(async () => { Simulate.click(item); });
  expect(exportSpreadsheet).toHaveBeenCalledWith(expect.objectContaining({ jsonArray: [data[0]], extension: 'xlsx' }));
});
test('selection exports intersect with search results and never include filtered-out rows', async () => {
  render({ selectedValues: ['one', 'hidden'], setSelectedValues: jest.fn() });
  act(() => { Simulate.change(container.querySelector('input[type="text"]'), { target: { value: 'Alpha' } }); });
  const item = await excelMenu();
  expect(item).toBeDefined();
  await act(async () => { Simulate.click(item); });
  expect(exportSpreadsheet).toHaveBeenCalledWith(expect.objectContaining({ jsonArray: [data[0]] }));
});
test('hides Excel export when export permission is denied', async () => {
  render({ access: { view: true, export: false } });
  expect(await excelMenu()).toBeUndefined();
});

test('phone cards expose field labels and retain row selection and actions', () => {
  const select = jest.fn(), open = jest.fn();
  render({ selectedValues: [], setSelectedValues: select, columnData: [...columns, {
    Header: 'Action', accessor: 'action', isSortable: false,
    cell: ({ row }) => <button onClick={() => open(row.original)}>Open record</button>,
  }] });
  const row = container.querySelector('.crm-record-row');
  expect(row.querySelector('[data-mobile-role="primary"]').dataset.label).toBe('Name');
  expect(row.querySelector('[data-label="Amount"]').textContent).toBe('10');
  expect(row.querySelector('[data-mobile-role="actions"]').textContent).toContain('Open record');
  act(() => { Simulate.change(row.querySelector('input[type="checkbox"]'), { target: { checked: true } }); });
  expect(select).toHaveBeenCalled();
  expect(select.mock.calls[0][0]([])).toEqual(['one']);
  act(() => { Simulate.click(row.querySelector('[data-mobile-role="actions"] button')); });
  expect(open).toHaveBeenCalledWith(data[0]);
});

test('phone sorting changes record order and can restore the initial order', () => {
  render();
  const sort = container.querySelector('.crm-mobile-table-sort select');
  expect(sort.getAttribute('aria-label')).toBe('Sort by');
  act(() => { Simulate.change(sort, { target: { value: JSON.stringify(['amount', true]) } }); });
  expect([...container.querySelectorAll('[data-mobile-role="primary"]')].map(cell => cell.textContent)).toEqual(['Other', 'Beta', 'Alpha']);
  act(() => { Simulate.change(sort, { target: { value: '' } }); });
  expect([...container.querySelectorAll('[data-mobile-role="primary"]')].map(cell => cell.textContent)).toEqual(['Alpha', 'Beta', 'Other']);
});

test('card labels, sorting and column settings use the readable label of managed form fields', async () => {
  render({ columnData: columns.map(column => column.accessor === 'name' ? { ...column, Header: { en: 'Customer name', fa: 'Name FA', tr: 'Name TR' } } : column) });
  expect(container.querySelector('[data-mobile-role="primary"]').dataset.label).toBe('Customer name');
  expect(container.querySelector('.crm-mobile-table-sort select').textContent).toContain('Customer name');
  expect(container.querySelector('[data-mobile-role="primary"]').textContent).toBe('Alpha');
  await act(async () => { Simulate.click(container.querySelector('.crm-table-settings')); });
  const manage = [...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent.includes('Manage Columns'));
  await act(async () => { Simulate.click(manage); });
  expect(document.querySelector('.crm-columns-modal').textContent).toContain('Customer name');
});

test('record cards paginate five at a time and page-size changes reset to the first page', () => {
  const records = Array.from({ length: 13 }, (_, index) => ({ _id: String(index), name: `Record ${index + 1}`, amount: index }));
  render({ allData: records });
  expect(container.querySelectorAll('.crm-record-row')).toHaveLength(5);
  act(() => Simulate.click(container.querySelector('button[aria-label="Next Page"]')));
  expect(container.querySelector('[data-mobile-role="primary"]').textContent).toBe('Record 6');
  act(() => Simulate.change(container.querySelector('.crm-record-pagination select'), { target: { value: '10' } }));
  expect(container.querySelectorAll('.crm-record-row')).toHaveLength(10);
  expect(container.querySelector('[data-mobile-role="primary"]').textContent).toBe('Record 1');
  act(() => Simulate.click(container.querySelector('button[aria-label="Next Page"]')));
  expect(container.querySelectorAll('.crm-record-row')).toHaveLength(3);
  expect(container.querySelector('button[aria-label="Next Page"]').disabled).toBe(true);
});

test('preservePage keeps page two and its edited row after records refresh, and clamps after deletion', () => {
  const records = Array.from({ length: 13 }, (_, index) => ({ _id: String(index), name: `Record ${index + 1}`, amount: index }));
  render({ allData: records, preservePage: true });
  act(() => { Simulate.click(container.querySelector('button[aria-label="Next Page"]')); });
  expect(container.querySelector('[data-mobile-role="primary"]').textContent).toBe('Record 6');
  render({ allData: records.map(record => record._id === '5' ? { ...record, name: 'Edited user' } : record), preservePage: true });
  expect(container.querySelector('button[aria-current="page"]').textContent).toBe('2');
  expect(container.querySelector('[data-mobile-role="primary"]').textContent).toBe('Edited user');
  render({ allData: records.slice(0, 3), preservePage: true });
  expect(container.querySelector('button[aria-current="page"]').textContent).toBe('1');
  expect(container.querySelectorAll('.crm-record-row')).toHaveLength(3);
});
test('the optional Kanban body receives the same searched records as the table and export', () => {
  const body = jest.fn(records => <div data-testid="board">{records.map(record => record.name).join(',')}</div>);
  render({ renderRecords: body });
  expect(container.querySelector('[data-testid="board"]').textContent).toBe('Alpha,Beta,Other');
  act(() => { Simulate.change(container.querySelector('input[type="text"]'), { target: { value: 'Alpha' } }); });
  expect(container.querySelector('[data-testid="board"]').textContent).toBe('Alpha');
  expect(container.querySelector('.crm-data-table')).toBeNull();
});
