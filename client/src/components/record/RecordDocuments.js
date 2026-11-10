import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Button, Flex, Heading, IconButton, SimpleGrid, Spinner, Text } from '@chakra-ui/react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { useLanguage } from 'i18n';
import { deleteApi, downloadApiFile, getApi } from 'services/api';
import { getStoredUser } from 'services/authSession';
import { notifyDocumentsChanged, useDocumentChanges } from 'services/documentEvents';
import { isAdmin } from 'roles';
import { HasAccess } from '../../redux/accessUtils';
import DocumentCard from 'views/admin/document/DocumentCard';
import { useFormDefinition } from 'utils/managedForm';
import AddDocumentModal from 'utils/addDocumentModal';

export default function RecordDocuments({ moduleName, recordId }) {
  const { t } = useLanguage();
  const [permissions] = HasAccess(['Documents']);
  const { definition } = useFormDefinition('Documents');
  const [folders, setFolders] = useState([]), [busy, setBusy] = useState(true), [error, setError] = useState(false), [adding, setAdding] = useState(false);
  const entityType = { Leads: 'Lead', Contacts: 'Contact', Opportunities: 'Opportunity' }[moduleName];
  const actor = getStoredUser();
  const canDelete = folder => permissions?.delete && (isAdmin(actor) || String(folder.createBy?._id || folder.createBy) === String(actor?._id));
  const load = useCallback(async () => {
    setBusy(true); setError(false);
    try {
      const result = await getApi('api/document/?' + new URLSearchParams({ entityType, entityId: recordId }));
      if (result?.status === 200) setFolders(result.data); else setError(true);
    } catch { setError(true); }
    finally { setBusy(false); }
  }, [entityType, recordId]);
  useEffect(() => { load(); }, [load]);
  useDocumentChanges(load);
  const remove = async file => {
    if (!window.confirm(`${file.fileName}: ${t('Delete this file?')}`)) return;
    setError(false);
    try {
      const result = await deleteApi('api/document/delete/', file._id);
      if (result?.status === 200) notifyDocumentsChanged(); else setError(true);
    } catch { setError(true); }
  };
  const documents = folders.flatMap(folder => (folder.files || []).map(file => ({ file, folder })));
  const download = async file => {
    setError(false);
    try {
      const result = await downloadApiFile(`api/document/download/${file._id}`, file.fileName);
      if (result?.status !== 200) setError(true);
    }
    catch { setError(true); }
  };
  return <Box className="crm-detail-surface crm-record-documents">
    <Flex align="center" justify="space-between" gap={3} mb={4} wrap="wrap"><Heading size="sm">{t('Documents')}</Heading>
      {permissions?.create && <Button size="sm" variant="brand" leftIcon={<FiPlus />} onClick={() => setAdding(true)}>{t('Add Document')}</Button>}
    </Flex>
    {error && <Alert status="error"><AlertIcon />{t('estate.serverError')}</Alert>}
    {busy ? <Spinner size="sm" /> : !documents.length ? <Text color="var(--crm-muted)">{t('No Data Found')}</Text>
      : <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>{documents.map(({ file, folder }) =>
        <DocumentCard key={file._id} file={file} folder={folder} definition={definition} onDownload={download}
          deleteAction={canDelete(folder) && <IconButton aria-label={t('Delete')} icon={<FiTrash2 />} size="sm" variant="ghost" colorScheme="red" onClick={() => remove(file)} />} />
      )}</SimpleGrid>}
    {adding && <AddDocumentModal addDocument={adding} setAddDocument={setAdding} linkId={recordId} from={entityType.toLowerCase()} fetchData={load} />}
  </Box>;
}
