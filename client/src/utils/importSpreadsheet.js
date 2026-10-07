import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { Inflate } from 'fflate';

const MAX_FILE = 15 * 1024 * 1024;
const MAX_EXPANDED = 50 * 1024 * 1024;
const MAX_ROWS = 100;
const MAX_COLUMNS = 200;
const invalid = () => new Error('Invalid or oversized import file');
const headerName = value => {
  if (typeof value !== 'string' || value.length > 200) throw invalid();
  const name = value.trim();
  if (!name || name.includes('$') || name.split('.').some(part => ['__proto__', 'constructor', 'prototype'].includes(part))) throw invalid();
  return name;
};

// Inspect the ZIP directory before handing XLSX data to ExcelJS's XML parser.
export const validateXlsxArchive = buffer => {
  if (!buffer || buffer.byteLength > MAX_FILE || buffer.byteLength < 22) throw invalid();
  const view = new DataView(buffer);
  let end = -1;
  for (let offset = buffer.byteLength - 22; offset >= Math.max(0, buffer.byteLength - 65557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === buffer.byteLength) { end = offset; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw invalid();
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);
  const directoryEnd = offset + directorySize;
  if (!count || count > 2000 || directoryEnd > end) throw invalid();
  let expanded = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > directoryEnd || view.getUint32(offset, true) !== 0x02014b50) throw invalid();
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    if ((flags & 1) || ![0, 8].includes(method) || size === 0xffffffff || compressedSize === 0xffffffff || size > Math.max(compressedSize, 1) * 1000) throw invalid();
    expanded += size;
    if (expanded > MAX_EXPANDED) throw invalid();
    const localOffset = view.getUint32(offset + 42, true);
    if (localOffset + 30 > directoryEnd || view.getUint32(localOffset, true) !== 0x04034b50 || view.getUint16(localOffset + 8, true) !== method) throw invalid();
    const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    if (start + compressedSize > directoryEnd) throw invalid();
    if (method === 0) { if (compressedSize !== size) throw invalid(); }
    else {
      let actualSize = 0;
      const inflater = new Inflate(chunk => { actualSize += chunk.length; if (actualSize > size) throw invalid(); });
      const compressed = new Uint8Array(buffer, start, compressedSize);
      for (let position = 0; position < compressedSize; position += 4096) inflater.push(compressed.subarray(position, position + 4096), position + 4096 >= compressedSize);
      if (actualSize !== size) throw invalid();
    }
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  if (offset !== directoryEnd) throw invalid();
};

export const parseImportSpreadsheet = async file => {
  if (!file || !file.size || file.size > MAX_FILE) throw invalid();
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'csv') {
    const parsed = Papa.parse(await file.text(), { header: true, skipEmptyLines: 'greedy', preview: MAX_ROWS + 1, transformHeader: headerName });
    if (parsed.errors.length || !parsed.data.length || parsed.data.length > MAX_ROWS || parsed.meta.fields.length > MAX_COLUMNS) throw invalid();
    return parsed.data;
  }
  if (extension !== 'xlsx') throw invalid();
  const buffer = await file.arrayBuffer();
  validateXlsxArchive(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet(1);
  if (!sheet || sheet.rowCount < 2 || sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > MAX_COLUMNS) throw invalid();
  const headers = [];
  sheet.getRow(1).eachCell((cell, column) => { headers[column - 1] = headerName(cell.value); });
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw invalid();
  const rows = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const values = Object.create(null);
    row.eachCell((cell, column) => {
      if (!headers[column - 1]) throw invalid();
      const value = cell.value;
      values[headers[column - 1]] = value && typeof value === 'object' && 'formula' in value ? value.result ?? '' : value;
    });
    rows.push(values);
  });
  if (!rows.length) throw invalid();
  return rows;
};
