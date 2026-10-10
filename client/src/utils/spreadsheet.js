import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { exportValue, recordValue } from './exportRecords';

// Export strings as literal text; spreadsheet programs must not execute cell content.
export const cellText = value => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  const text = String(exportValue(value));
  return /^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
};

export const spreadsheetRows = (jsonArray, csvColumns) => [
  csvColumns.map(column => cellText(column.Header)),
  ...jsonArray.map(row => csvColumns.map(column => {
    const value = recordValue(row, column.accessor);
    return cellText(column.format ? column.format(value, row) : value);
  })),
];

export async function exportSpreadsheet({ jsonArray = [], csvColumns = [], fileName = 'data', extension, sheets, rightToLeft = false }) {
  if (!['csv', 'xlsx'].includes(extension)) throw new Error('Unsupported export format');
  const filename = String(fileName).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') + '.' + extension;
  if (extension === 'csv') {
    const quote = value => '"' + String(value).replace(/"/g, '""') + '"';
    const rows = spreadsheetRows(jsonArray, csvColumns);
    const text = '\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n');
    saveAs(new Blob([text], { type: 'text/csv;charset=utf-8' }), filename);
    return;
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Arad CRM';
  const usedNames = new Set();
  const worksheets = sheets || [{ name: 'Sheet 1', jsonArray, csvColumns }];
  for (const sheet of worksheets) {
    const columns = sheet.csvColumns || [];
    const rows = spreadsheetRows(sheet.jsonArray || [], columns);
    const base = String(sheet.name || 'Sheet').replace(/[\\/*?:[\]]/g, '_').slice(0, 27) || 'Sheet';
    let name = base, suffix = 1;
    while (usedNames.has(name.toLowerCase())) name = base + ' ' + suffix++;
    usedNames.add(name.toLowerCase());
    const worksheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, rightToLeft }] });
    worksheet.addRows(rows);
    if (columns.length) worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length, column: columns.length } };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    worksheet.columns.forEach((column, index) => {
      column.width = Math.min(45, Math.max(16, ...rows.slice(0, 100).map(row => String(row[index] ?? '').length + 2)));
      if (columns[index]?.numFmt) column.numFmt = columns[index].numFmt;
    });
  }
  const bytes = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}
