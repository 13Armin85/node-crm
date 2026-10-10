import { useState } from 'react';
import { Box, Button, FormControl, FormLabel, IconButton, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Spinner, Text, Tooltip, useDisclosure } from '@chakra-ui/react';
import { FiSend } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useLanguage } from 'i18n';
import { getApi, postApi, deleteApi } from 'services/api';
import { canSendRecord } from 'services/recordSharing';
import { matchesAssignee, userDisplayName } from 'services/taskSearch';
export default function ShareRecordButton({ module, record }) {
  const { t, direction } = useLanguage();
  const modal = useDisclosure();
  const [users, setUsers] = useState([]), [shares, setShares] = useState([]);
  const [selected, setSelected] = useState(''), [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [failed, setFailed] = useState(false);
  const endpoint = 'api/record-sharing/' + encodeURIComponent(module) + '/' + record?._id;
  const alreadySent = shares.some(share => share.user?._id === selected);
  const load = async () => {
    setLoading(true); setFailed(false);
    try {
      const [directory, recipients] = await Promise.all([getApi('api/record-sharing/users'), getApi(endpoint)]);
      if (directory?.status !== 200 || recipients?.status !== 200 || !Array.isArray(directory.data) || !Array.isArray(recipients.data)) throw new Error();
      setUsers(directory.data); setShares(recipients.data);
    } catch { setFailed(true); } finally { setLoading(false); }
  };
  const open = () => { setSelected(''); setQuery(''); modal.onOpen(); load(); };
  const send = async () => {
    setSaving(true);
    try {
      const result = await postApi('api/record-sharing', { module, recordId: record._id, recipientId: selected });
      if (![200, 201].includes(result?.status)) throw new Error();
      setShares(previous => [...previous.filter(share => share.user?._id !== selected), { user: users.find(user => user._id === selected) }]);
      toast.success(t('Item sent to user'));
    } catch { toast.error(t('Failed to send item')); } finally { setSaving(false); }
  };
  const revoke = async () => {
    setSaving(true);
    try {
      const result = await deleteApi(endpoint + '/', selected);
      if (result?.status !== 200) throw new Error();
      setShares(previous => previous.filter(share => share.user?._id !== selected));
      toast.success(t('Item access revoked'));
    } catch { toast.error(t('Failed to send item')); } finally { setSaving(false); }
  };
  if (!canSendRecord(module) || !record?._id) return null;
  const choices = users.filter(user => user._id === selected || matchesAssignee(user, query));
  return <>
    <Tooltip label={t('Send to user')}><IconButton className="crm-share-record-button" size="sm" variant="ghost" colorScheme="blue" aria-label={t('Send to user')} icon={<FiSend />} onClick={open} /></Tooltip>
    <Modal isOpen={modal.isOpen} onClose={() => { if (!saving) modal.onClose(); }} isCentered>
      <ModalOverlay /><ModalContent dir={direction} className="crm-share-record-modal">
        <ModalHeader>{t('Send item to user')}</ModalHeader><ModalCloseButton isDisabled={saving} aria-label={t('Close')} />
        <ModalBody>
          <Text fontSize="sm" mb={4}>{t('Only this item will be visible to the selected user when the section is hidden.')}</Text>
          {loading ? <Spinner /> : failed ? <Box role="alert"><Text>{t('Failed to load sharing settings')}</Text><Button mt={2} onClick={load}>{t('Retry')}</Button></Box> : <FormControl>
            <FormLabel>{t('User')}</FormLabel>
            <Input mb={2} value={query} isDisabled={saving} placeholder={t('Search names...')} aria-label={t('Search names...')} onChange={event => setQuery(event.target.value)} />
            <Select value={selected} isDisabled={saving} aria-label={t('Recipient user')} onChange={event => setSelected(event.target.value)}>
              <option value="">{t('Select user')}</option>{choices.map(user => <option key={user._id} value={user._id}>{userDisplayName(user)}</option>)}
            </Select>
            {alreadySent && <Text fontSize="xs" color="gray.500" mt={2}>{t('This item has already been sent to this user')}</Text>}
            {!users.length && <Text fontSize="sm" mt={2}>{t('No ordinary users found')}</Text>}
          </FormControl>}
        </ModalBody>
        <ModalFooter gap={2}>
          {alreadySent ? <Button variant="outline" colorScheme="red" isLoading={saving} onClick={revoke}>{t('Revoke access')}</Button>
            : <Button colorScheme="blue" isLoading={saving} isDisabled={!selected || loading || failed} onClick={send}>{t('Send')}</Button>}
          <Button isDisabled={saving} onClick={modal.onClose}>{t('Close')}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  </>;
}
