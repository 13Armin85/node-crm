export function dashboardExportSheets({ summary = [], leads, tasks, sales }, t) {
  const countColumns = [{ Header: t('Status'), accessor: 'status' }, { Header: t('Count'), accessor: 'count' }];
  const moneyColumns = [{ Header: t('Status'), accessor: 'status' }, { Header: t('Currency'), accessor: 'currency' }, { Header: t('Amount'), accessor: 'amount', numFmt: '#,##0.00' }];
  const sheets = [{ name: t('Summary'), jsonArray: summary, csvColumns: [{ Header: t('Module'), accessor: 'name', format: value => t(value) }, { Header: t('Count'), accessor: 'length' }] }];
  if (leads) sheets.push({ name: t('Lead Statistics'), jsonArray: ['active', 'pending', 'sold'].map(status => ({ status: t(status), count: leads.filter(lead => lead.leadStatus === status).length })), csvColumns: countColumns });
  if (tasks) sheets.push({ name: t('Task Statistics'), jsonArray: ['todo', 'inProgress', 'pending', 'onHold', 'completed'].map(status => ({ status: t(status), count: tasks.filter(task => task.status === status).length })), csvColumns: countColumns });
  if (sales) {
    sheets.push({ name: t('Property Statistics'), jsonArray: ['sold', 'available'].map(key => ({ status: t(key === 'sold' ? 'Sold' : 'Available'), count: sales[key]?.count || 0 })), csvColumns: countColumns });
    sheets.push({ name: t('Property amounts'), jsonArray: ['sold', 'available'].flatMap(key => (sales[key]?.values || []).map(value => ({ status: t(key === 'sold' ? 'Sold' : 'Available'), ...value }))), csvColumns: moneyColumns });
    sheets.push({ name: t('dashboard.teamSales'), jsonArray: sales.bySeller || [], csvColumns: [{ Header: t('Name'), accessor: 'name' }, { Header: t('dashboard.soldCount'), accessor: 'soldCount' }] });
    sheets.push({ name: t('Sales amounts'), jsonArray: (sales.bySeller || []).flatMap(person => (person.values || []).map(value => ({ name: person.name || person.userId, ...value }))), csvColumns: [{ Header: t('Name'), accessor: 'name' }, ...moneyColumns.filter(column => column.accessor !== 'status')] });
  }
  return sheets;
}
