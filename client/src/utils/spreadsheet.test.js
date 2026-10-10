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

test('XLSX preserves Persian and Turkish text, nested amounts, localized labels and RTL worksheets', async () => {
  await exportSpreadsheet({
    extension: 'xlsx', fileName: 'گزارش', rightToLeft: true,
    sheets: [
      { name: 'املاک', jsonArray: [{ title: 'ملک علی', price: { amount: 1234.5 }, person: { firstName: 'İpek', lastName: 'Yılmaz' } }], csvColumns: [{ Header: 'عنوان', accessor: 'title' }, { Header: 'مبلغ', accessor: 'price.amount', numFmt: '#,##0.00' }, { Header: 'مسئول', accessor: 'person' }] },
      { name: 'آمار', jsonArray: [{ count: 2, name: '=1+1' }], csvColumns: [{ Header: 'تعداد', accessor: 'count' }, { Header: 'نام', accessor: 'name' }] },
    ],
  });
  const [blob, filename] = saveAs.mock.calls[0];
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await readBlob(blob));
  expect(filename).toBe('گزارش.xlsx');
  expect(workbook.worksheets).toHaveLength(2);
  expect(workbook.getWorksheet(1).getCell('A2').value).toBe('ملک علی');
  expect(workbook.getWorksheet(1).getCell('B2').value).toBe(1234.5);
  expect(workbook.getWorksheet(1).getCell('C2').value).toBe('İpek Yılmaz');
  expect(workbook.getWorksheet(1).views[0].rightToLeft).toBe(true);
  expect(workbook.getWorksheet(1).views[0].ySplit).toBe(1);
  expect(workbook.getWorksheet(2).getCell('A2').value).toBe(2);
  expect(workbook.getWorksheet(2).getCell('B2').value).toBe("'=1+1");
});
