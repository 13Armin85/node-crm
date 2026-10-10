import { dashboardExportSheets } from './dashboardExport';
const t = value => value;
test('keeps counts separate from multiple currencies and uses the correct lead statuses', () => {
  const sheets = dashboardExportSheets({
    summary: [{ name: 'Tasks', length: 2 }],
    leads: [{ leadStatus: 'active' }, { leadStatus: 'active' }, { leadStatus: 'sold' }],
    tasks: [{ status: 'todo' }, { status: 'completed' }],
    sales: { sold: { count: 2, values: [{ currency: 'TRY', amount: 500 }, { currency: 'USD', amount: 25 }] }, available: { count: 0, values: [] }, bySeller: [{ name: 'İpek', soldCount: 2, values: [{ currency: 'TRY', amount: 500 }, { currency: 'USD', amount: 25 }] }] },
  }, t);
  expect(sheets.find(sheet => sheet.name === 'Lead Statistics').jsonArray[0].count).toBe(2);
  expect(sheets.find(sheet => sheet.name === 'Property Statistics').jsonArray).toEqual([{ status: 'Sold', count: 2 }, { status: 'Available', count: 0 }]);
  expect(sheets.find(sheet => sheet.name === 'dashboard.teamSales').jsonArray).toHaveLength(1);
  expect(sheets.find(sheet => sheet.name === 'Sales amounts').jsonArray).toHaveLength(2);
});
test('omits data sheets for hidden modules', () => {
  const sheets = dashboardExportSheets({ summary: [{ name: 'Contacts', length: 3 }] }, t);
  expect(sheets).toHaveLength(1);
  expect(sheets[0].jsonArray).toEqual([{ name: 'Contacts', length: 3 }]);
});
