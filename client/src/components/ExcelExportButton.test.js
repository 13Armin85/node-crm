/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises native controls with ReactDOM. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { toast } from 'react-toastify';
import { exportSpreadsheet } from 'utils/spreadsheet';
import ExcelExportButton from './ExcelExportButton';
jest.mock('i18n', () => ({ useLanguage: () => ({ language: 'fa', t: value => value }) }));
jest.mock('utils/spreadsheet', () => ({ exportSpreadsheet: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { error: jest.fn() } }));
let container;
beforeEach(() => { jest.clearAllMocks(); container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); });
const render = props => act(() => { ReactDOM.render(<ChakraProvider><ExcelExportButton {...props} /></ChakraProvider>, container); });
test('awaits all paginated records and creates a Persian workbook', async () => {
  const rows = [{ name: 'علی' }, { name: 'İpek' }];
  const loadRows = jest.fn().mockResolvedValue(rows);
  render({ loadRows, fileName: 'Contacts', columns: [{ Header: 'Name', accessor: 'name' }] });
  await act(async () => { Simulate.click(container.querySelector('button')); });
  expect(loadRows).toHaveBeenCalledTimes(1);
  expect(exportSpreadsheet).toHaveBeenCalledWith(expect.objectContaining({ jsonArray: rows, extension: 'xlsx', rightToLeft: true }));
});
test('a failed page download never produces a partial workbook and lets the user retry', async () => {
  render({ loadRows: () => Promise.reject(new Error('Forbidden')) });
  await act(async () => { Simulate.click(container.querySelector('button')); });
  expect(exportSpreadsheet).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith('Failed to export data');
  expect(container.querySelector('button').disabled).toBe(false);
});
test('disables export for empty data or denied access', () => {
  render({ rows: [] });
  expect(container.querySelector('button').disabled).toBe(true);
  render({ rows: [{ name: 'allowed' }], isDisabled: true });
  expect(container.querySelector('button').disabled).toBe(true);
});
