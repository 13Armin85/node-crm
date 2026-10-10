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
