import { entityExportColumns, exportColumns, exportValue, loadAllExportRows, selectedExportRows } from './exportRecords';
import { spreadsheetRows } from './spreadsheet';
const t = value => ({ Yes: 'بله', No: 'خیر', Name: 'نام', 'Created Date': 'تاریخ ایجاد' }[value] || value);
test('exports only selected rows that remain in the filtered results', () => {
  const rows = [{ _id: 'first', name: 'علی' }, { _id: 'second', name: 'İpek' }];
  expect(selectedExportRows(rows, ['first', 'hidden'])).toEqual([rows[0]]);
  expect(selectedExportRows(rows, 'second')).toEqual([rows[1]]);
  expect(selectedExportRows(rows)).toEqual(rows);
});
test('exports nested custom values and human names, excluding actions and internal IDs', () => {
  const columns = exportColumns([{ Header: '#', accessor: '_id' }, { Header: 'Name', accessor: 'person' }, { Header: 'Amount', accessor: 'price.amount' }, { Header: 'Custom', accessor: 'customFields.note' }, { Header: 'Action' }], t);
  const rows = spreadsheetRows([{ person: { firstName: 'İpek', lastName: 'Yılmaz' }, price: { amount: 1234.5 }, customFields: { note: 'فارسی' } }], columns);
  expect(rows).toEqual([['نام', 'Amount', 'Custom'], ['İpek Yılmaz', 1234.5, 'فارسی']]);
  expect(exportValue([{ name: 'file.pdf' }, { name: 'عکس.png' }])).toBe('file.pdf، عکس.png');
});
test('entity exports localize enum labels and include enabled custom fields', () => {
  const definition = { fields: [
    { name: 'status', label: { fa: 'وضعیت' }, options: [{ value: 'ACTIVE', label: { fa: 'فعال' } }] },
    { name: 'amount', type: 'currency', label: { fa: 'مبلغ' } },
    { name: 'private', enabled: false, label: 'private' },
    { name: 'note', kind: 'CUSTOM_FIELD', label: { fa: 'یادداشت' } },
  ] };
  const columns = entityExportColumns(definition, 'fa', t);
  expect(columns.some(column => column.accessor === 'private')).toBe(false);
  expect(columns.find(column => column.accessor === 'amount').numFmt).toBe('#,##0.00');
  expect(spreadsheetRows([{ status: 'ACTIVE', amount: 12, customFields: { note: 'ترکی' } }], columns)[1]).toEqual(['فعال', 12, 'ترکی', '']);
});
test('fetches every matching page and preserves filters and sort without changing scope', async () => {
  const records = Array.from({ length: 205 }, (_, i) => ({ _id: String(i), title: 'Property ' + i }));
  const getApi = jest.fn(async path => {
    const params = new URLSearchParams(path.split('?')[1]);
    expect(params.get('q')).toBe('علی İpek');
    expect(params.get('district')).toBe('Kadıköy');
    expect(params.get('sort')).toBe('price.amount');
    expect(params.get('order')).toBe('asc');
    expect(params.get('limit')).toBe('100');
    const page = Number(params.get('page'));
    return { status: 200, data: { items: records.slice((page - 1) * 100, page * 100), total: records.length } };
  });
  expect(await loadAllExportRows(getApi, 'api/estate/Properties', { q: 'علی İpek', district: 'Kadıköy', sort: 'price.amount', order: 'asc' })).toEqual(records);
  expect(getApi).toHaveBeenCalledTimes(3);
});
test('rejects permission failures and incomplete pages instead of downloading partial data', async () => {
  await expect(loadAllExportRows(async () => ({ status: 403 }), 'api/estate/Properties')).rejects.toThrow();
  const getApi = jest.fn().mockResolvedValueOnce({ status: 200, data: { items: [{ _id: 'first' }], total: 2 } }).mockResolvedValue({ status: 200, data: { items: [], total: 2 } });
  await expect(loadAllExportRows(getApi, 'api/estate/Properties')).rejects.toThrow('Incomplete');
});
test('rejects overlapping pages caused by changing data', async () => {
  await expect(loadAllExportRows(async () => ({ status: 200, data: { items: [{ _id: 'duplicate' }], total: 2 } }), 'api/estate/Properties')).rejects.toThrow('changed');
});
