import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Button, Flex, Heading, IconButton, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Spinner, Table, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import Card from 'components/card/Card';
import RecordPagination from 'components/pagination/RecordPagination';
import { HasAccess } from '../../../redux/accessUtils';
import { useLanguage } from 'i18n';
import { getApi, deleteApi } from 'services/api';
import CatalogRecordDialog from './CatalogRecordDialog';

export default function DistrictsPage() {
  const { t, language, direction } = useLanguage();
  const [permissions] = HasAccess(['Districts']);
  const [result, setResult] = useState({ items: [], total: 0 });
  const [query, setQuery] = useState(''), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(20);
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [adding, setAdding] = useState(false), [deleting, setDeleting] = useState(null);
  const load = useCallback(async () => {
    setBusy(true);
    try { const response = await getApi(`api/estate/districts?${new URLSearchParams({ q: query, page, limit: pageSize })}`); if (response?.status === 200) { setResult(response.data); setError(''); } else setError(response?.data?.code || 'serverError'); }
    catch { setError('serverError'); } finally { setBusy(false); }
  }, [query, page, pageSize]);
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);
  const remove = async () => { const response = await deleteApi('api/estate/districts/', deleting._id); setDeleting(null); if (response?.status === 200) load(); else setError(response?.data?.code || 'serverError'); };
  return <Box dir={direction} className="crm-districts-page">
    <Flex className="crm-page-hero" justify="space-between" gap={3} wrap="wrap"><Heading className="crm-page-hero__title">{t('Districts')}</Heading>{permissions?.create && <Button className="crm-page-hero__action" leftIcon={<FiPlus />} onClick={() => setAdding(true)}>{t('Create New District')}</Button>}</Flex>
    {error && <Alert status="error" mb={3}><AlertIcon />{t(`estate.${error}`)}</Alert>}
    <Card className="crm-data-card crm-list-table">
      <Box p={3}><Input aria-label={t('Search...')} placeholder={t('Search...')} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} maxW="360px" /></Box>
      {busy ? <Flex p={6} justify="center"><Spinner /></Flex> : <Box overflowX="auto"><Table className="crm-data-table"><Thead><Tr><Th>{t('District')}</Th><Th width="80px">{t('Actions')}</Th></Tr></Thead><Tbody>
        {result.items.map(item => <Tr key={item._id}><Td data-no-translate>{item.label?.[language] || item.label?.en || item.name}</Td><Td>{permissions?.delete && <IconButton variant="ghost" size="sm" colorScheme="red" aria-label={t('Delete')} icon={<FiTrash2 />} onClick={() => setDeleting(item)} />}</Td></Tr>)}
        {!result.items.length && <Tr><Td colSpan={2}>{t('No Data Found')}</Td></Tr>}
      </Tbody></Table></Box>}
      <RecordPagination page={page} pageCount={Math.ceil(result.total / pageSize)} total={result.total} pageSize={pageSize} isLoading={busy} onPageChange={setPage} onPageSizeChange={value => { setPageSize(value); setPage(1); }} />
    </Card>
    {adding && <CatalogRecordDialog moduleName="Districts" onClose={() => setAdding(false)} onCreated={() => { if (!query && page === 1) load(); else { setQuery(''); setPage(1); } }} />}
    <Modal isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} isCentered><ModalOverlay /><ModalContent><ModalHeader>{t('Delete')}</ModalHeader><ModalBody>{t('estate.confirmDelete')}</ModalBody><ModalFooter gap={2}><Button variant="outline" onClick={() => setDeleting(null)}>{t('Cancel')}</Button><Button colorScheme="red" onClick={remove}>{t('Delete')}</Button></ModalFooter></ModalContent></Modal>
  </Box>;
}
