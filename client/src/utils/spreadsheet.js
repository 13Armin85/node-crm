import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Export strings as literal text; spreadsheet programs must not execute cell content.
export const cellText = value => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
};
export async function exportSpreadsheet({ jsonArray = [], csvColumns = [], fileName = 'data', extension }) {
  if (!['csv', 'xlsx'].includes(extension)) throw new Error('Unsupported export format');
  const rows = [csvColumns.map(col => cellText(col.Header)), ...jsonArray.map(row => csvColumns.map(col => cellText(row[col.accessor])))];
  const filename = String(fileName).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') + '.' + extension;
  if (extension === 'csv') {
    const quote = value => '"' + String(value).replace(/"/g, '""') + '"';
    const text = '\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n');
    saveAs(new Blob([text], { type: 'text/csv;charset=utf-8' }), filename);
    return;
  }
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Sheet 1').addRows(rows);
  const bytes = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}
