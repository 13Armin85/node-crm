import { formLabel, formValue } from './formValue';

export const recordValue = (row, accessor) => {
  if (typeof accessor === 'function') return accessor(row);
  if (Object.prototype.hasOwnProperty.call(row || {}, accessor)) return row[accessor];
  return String(accessor || '').split('.').reduce((value, key) => value?.[key], row);
};

export const exportValue = value => {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(exportValue).join('، ');
  if (value instanceof Date || typeof value !== 'object') return value;
  return formLabel(value, String(formValue(value) || ''));
};

export const exportColumns = (columns, t = value => value) => columns
  .filter(column => column.accessor && column.accessor !== '_id' && column.export !== false)
  .map(column => ({
    ...column,
    Header: typeof column.Header === 'string' ? t(column.Header) : t(column.label || String(column.accessor)),
    format: column.exportValue || column.format || (
      /status|priority|category|stage/i.test(String(column.accessor))
        ? value => t(exportValue(value)) : exportValue
    ),
  }));

export const selectedExportRows = (rows, selected = []) => {
  const ids = Array.isArray(selected) ? selected : selected ? [selected] : [];
  return ids.length ? rows.filter(row => ids.includes(row._id)) : rows;
};

export const entityExportColumns = (definition, language, t) => [
  ...((definition?.fields || []).filter(field => field.enabled !== false && field.name !== "createdDate").map(field => ({
    Header: typeof field.label === 'object' ? field.label[language] || field.label.en || field.name : t(field.label || field.name),
    accessor: field.kind === 'CUSTOM_FIELD' ? 'customFields.' + field.name : field.name,
    format: value => {
      if (typeof value === 'boolean') return t(value ? 'Yes' : 'No');
      if (field.options?.length) {
        const option = field.options.find(option => String(formValue(option.value)) === String(formValue(value)));
        if (option) return typeof option.label === 'object' ? option.label[language] || option.label.en : t(option.label || option.value);
      }
      return exportValue(value);
    },
    numFmt: field.type === 'currency' ? '#,##0.00' : undefined,
  }))),
  { Header: t('Created Date'), accessor: 'createdDate' },
];

// Read every matching page through the ordinary permission-scoped API.
export async function loadAllExportRows(getApi, base, filters = {}) {
  const rows = [];
  const seen = new Set();
  for (let page = 1; page <= 10000; page += 1) {
    const params = new URLSearchParams({ ...filters, page, limit: 100 });
    const response = await getApi(base + '?' + params);
    const items = response?.data?.items;
    const total = response?.data?.total;
    if (response?.status !== 200 || !Array.isArray(items) || !Number.isSafeInteger(total) || total < 0) throw new Error('Failed to export data');
    for (const row of items) {
      if (row._id && seen.has(row._id)) throw new Error('Export data changed; try again');
      if (row._id) seen.add(row._id);
      rows.push(row);
    }
    if (rows.length >= total) return rows;
    if (!items.length) throw new Error('Incomplete export data');
  }
  throw new Error('Export data limit exceeded');
}
