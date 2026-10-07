import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { exportSpreadsheet } from './spreadsheet';
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
beforeEach(() => saveAs.mockClear());
const readBlob = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsArrayBuffer(blob);
});
test('CSV export quotes data and neutralizes user-controlled formulas', async () => {
  await exportSpreadsheet({ jsonArray: [{ name: '=HYPERLINK("https://evil.test","open")' }, { name: '+12345' }, { name: 'Hello, "team"' }], csvColumns: [{ Header: 'Name', accessor: 'name' }], fileName: 'contacts', extension: 'csv' });
  const [blob, filename] = saveAs.mock.calls[0];
  const bytes = new Uint8Array(await readBlob(blob));
  const content = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  expect(filename).toBe('contacts.csv');
  expect(content).toContain("'=HYPERLINK");
  expect(content).toContain("'+12345");
  expect(content).toContain('Hello, ""team""');
});
test('XLSX export roundtrips literal cells and preserves real numbers', async () => {
  await exportSpreadsheet({ jsonArray: [{ name: '=1+1', amount: -12.5 }], csvColumns: [{ Header: 'Name', accessor: 'name' }, { Header: 'Amount', accessor: 'amount' }], fileName: 'safe', extension: 'xlsx' });
  const [blob, filename] = saveAs.mock.calls[0];
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await readBlob(blob));
  expect(filename).toBe('safe.xlsx');
  expect(workbook.getWorksheet(1).getCell('A2').value).toBe("'=1+1");
  expect(workbook.getWorksheet(1).getCell('B2').value).toBe(-12.5);
});
