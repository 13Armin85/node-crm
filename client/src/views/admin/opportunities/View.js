import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button } from '@chakra-ui/react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiEdit3, FiPlus, FiPrinter, FiTrash2 } from 'react-icons/fi';
import html2pdf from 'html2pdf.js';
import { getApi, deleteManyApi } from 'services/api';
import { HasAccess } from '../../../redux/accessUtils';
import { useLanguage } from 'i18n';
import { useFormDefinition } from 'utils/managedForm';
import RecordFields from 'components/record/RecordFields';
import ConvertedLeadDetails from 'components/relations/ConvertedLeadDetails';
import CommonDeleteModel from 'components/commonDeleteModel';
import AddEdit from './AddEdit';
export default function View() {
  const { id } = useParams(), navigate = useNavigate(), { t } = useLanguage();
  const [permission] = HasAccess(['Opportunities']);
  const { definition } = useFormDefinition('Opportunities');
  const [data, setData] = useState(null), [editing, setEditing] = useState(false), [type, setType] = useState('edit'), [deleting, setDeleting] = useState(false), [printing, setPrinting] = useState(false);
  const load = useCallback(async () => { const result = await getApi('api/record-workspace/Opportunities/' + id); if (result?.status === 200) setData(result.data.record); }, [id]);
  useEffect(() => { load(); }, [load]);
  const print = async () => { setPrinting(true); try { await html2pdf().from(document.getElementById('reports')).set({ filename: 'Opportunity.pdf', margin: 8, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).save(); } finally { setPrinting(false); } };
  const remove = async () => { const result = await deleteManyApi('api/opportunity/deleteMany', [id]); if (result?.status === 200) navigate('/opportunities'); };
  return <Box className="crm-opportunity-detail">
    <div className="crm-opportunity-detail-toolbar">
      {permission?.create && <Button size="sm" variant="outline" leftIcon={<FiPlus />} onClick={() => { setType('add'); setEditing(true); }}>{t('Add')}</Button>}
      {permission?.update && <Button size="sm" variant="outline" leftIcon={<FiEdit3 />} onClick={() => { setType('edit'); setEditing(true); }}>{t('Edit')}</Button>}
      <Button size="sm" variant="outline" leftIcon={<FiPrinter />} onClick={print} isLoading={printing}>{t('Print as PDF')}</Button>
      {permission?.delete && <Button size="sm" variant="outline" colorScheme="red" leftIcon={<FiTrash2 />} onClick={() => setDeleting(true)}>{t('Delete')}</Button>}
      <Button size="sm" variant="outline" leftIcon={<FiArrowLeft />} onClick={() => navigate('/opportunities')}>{t('Back')}</Button>
    </div>
    <Box id="reports"><RecordFields record={data} definition={definition} title={t('Opportunities Details')} /><ConvertedLeadDetails records={data?.convertedLeads} /></Box>
    <AddEdit isOpen={editing} type={type} selectedId={type === 'edit' ? id : undefined} onClose={() => setEditing(false)} onSaved={load} />
    <CommonDeleteModel isOpen={deleting} onClose={() => setDeleting(false)} type="Opportunities" ids={[id]} handleDeleteData={remove} />
  </Box>;
}
