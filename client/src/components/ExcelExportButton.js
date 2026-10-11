import { useState } from 'react';
import { Button } from '@chakra-ui/react';
import { FiDownload, FiFileText } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useLanguage } from 'i18n';
import { exportSpreadsheet } from 'utils/spreadsheet';

export default function ExcelExportButton({ rows = [], columns = [], loadRows, getSheets, fileName = 'data', isDisabled, label = 'Export as Excel', className = '', ...props }) {
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
  return <Button className={`crm-excel-export ${className}`.trim()} size="sm" variant="solid" colorScheme="blue" leftIcon={<FiFileText size={18} />} rightIcon={<FiDownload size={16} />}
    {...props} isLoading={busy} isDisabled={isDisabled || (!loadRows && !getSheets && !rows.length)} onClick={download}>{t(label)}</Button>;
}
