import { useState } from 'react';
import { Button } from '@chakra-ui/react';
import { FiDownload } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useLanguage } from 'i18n';
import { exportSpreadsheet } from 'utils/spreadsheet';

export default function ExcelExportButton({ rows = [], columns = [], loadRows, getSheets, fileName = 'data', isDisabled, label = 'Export as Excel', ...props }) {
  const { t, language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const sheets = getSheets ? await getSheets() : undefined;
      const data = loadRows ? await loadRows() : rows;
      await exportSpreadsheet({ jsonArray: data, csvColumns: columns, sheets, fileName, extension: 'xlsx', rightToLeft: language === 'fa' });
    } catch {
      toast.error(t('Failed to export data'));
    } finally {
      setBusy(false);
    }
  };
  return <Button className="crm-excel-export" size="sm" variant="outline" colorScheme="green" leftIcon={<FiDownload />}
    {...props} isLoading={busy} isDisabled={isDisabled || (!loadRows && !getSheets && !rows.length)} onClick={download}>{t(label)}</Button>;
}
