import ExcelJS from 'exceljs';
import { parseImportSpreadsheet, validateXlsxArchive } from './importSpreadsheet';

const file = (name, content) => ({ name, size: content.length, text: async () => content });
test('CSV imports reject prototype paths and excessive batches', async () => {
  await expect(parseImportSpreadsheet(file('safe.csv', 'Name,Email\nAda,ada@example.test'))).resolves.toEqual([{ Name: 'Ada', Email: 'ada@example.test' }]);
  for (const key of ['__proto__', 'constructor.prototype', '$where']) await expect(parseImportSpreadsheet(file('bad.csv', key + '\nvalue'))).rejects.toThrow();
  await expect(parseImportSpreadsheet(file('big.csv', 'Name\n' + Array(101).fill('Ada').join('\n')))).rejects.toThrow();
});
test('XLSX archives are checked before parsing and normal exports remain readable', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Records');
  sheet.addRow(['Name']); sheet.addRow(['Ada']);
  const data = await workbook.xlsx.writeBuffer();
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  expect(() => validateXlsxArchive(buffer)).not.toThrow();
  await expect(parseImportSpreadsheet({ name: 'safe.xlsx', size: buffer.byteLength, arrayBuffer: async () => buffer })).resolves.toEqual([{ Name: 'Ada' }]);
  expect(() => validateXlsxArchive(new ArrayBuffer(22))).toThrow();
  const malicious = buffer.slice(0);
  const view = new DataView(malicious);
  for (let offset = 0; offset < malicious.byteLength - 46; offset++) if (view.getUint32(offset, true) === 0x02014b50) { view.setUint32(offset + 24, 100 * 1024 * 1024, true); break; }
  expect(() => validateXlsxArchive(malicious)).toThrow();
  const dishonest = buffer.slice(0);
  const dishonestView = new DataView(dishonest);
  for (let offset = 0; offset < dishonest.byteLength - 46; offset++) if (dishonestView.getUint32(offset, true) === 0x02014b50 && dishonestView.getUint32(offset + 24, true) > 0) { dishonestView.setUint32(offset + 24, 1, true); break; }
  expect(() => validateXlsxArchive(dishonest)).toThrow();
});
