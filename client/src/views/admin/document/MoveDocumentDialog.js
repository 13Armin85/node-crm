import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertIcon, Button, FormControl, FormLabel, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Text } from '@chakra-ui/react';
import { toast } from 'react-toastify';
import { useLanguage } from 'i18n';
import { postApi } from 'services/api';

const ownerId = folder => String(folder?.createBy?._id || folder?.createBy || '');
const folderPath = (folder, folders) => {
  const names = [], visited = new Set();
  let current = folder;
  while (current && !visited.has(current._id)) {
    visited.add(current._id); names.unshift(current.folderName);
    current = folders.find(candidate => candidate._id === current.parentFolder);
  }
  return names.join(' / ');
};

export default function MoveDocumentDialog({ item, folders, onClose, onMoved }) {
  const { t, direction } = useLanguage();
  const [destination, setDestination] = useState(''), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const isFolder = item?.kind === 'folder';
  useEffect(() => { setDestination(''); setError(''); }, [item]);
  const choices = useMemo(() => {
    if (!item) return [];
    const excluded = new Set(isFolder ? [item.record._id] : [item.sourceFolder?._id]);
    if (isFolder) {
      let changed;
      do {
        changed = false;
        for (const folder of folders) if (excluded.has(folder.parentFolder) && !excluded.has(folder._id)) {
          excluded.add(folder._id); changed = true;
        }
      } while (changed);
    }
    return folders.filter(folder => !folder.isRoot && ownerId(folder) === ownerId(item.sourceFolder) && !excluded.has(folder._id));
  }, [folders, item, isFolder]);
  const move = async () => {
    setSaving(true); setError('');
    try {
      const result = await postApi('api/document/move/' + item.kind + '/' + item.record._id, { folderId: destination || null });
      if (result?.status !== 200) { setError(result?.data?.code || 'serverError'); return; }
      toast.success(t(isFolder ? 'Folder moved successfully' : 'File moved successfully'));
      await onMoved();
      onClose();
    } catch { setError('serverError'); } finally { setSaving(false); }
  };
  return <Modal isOpen={!!item} onClose={() => { if (!saving) onClose(); }} isCentered>
    <ModalOverlay /><ModalContent dir={direction} className="crm-move-document-modal">
      <ModalHeader>{t(isFolder ? 'Move folder' : 'Move file')}</ModalHeader><ModalCloseButton isDisabled={saving} aria-label={t('Close')} />
      <ModalBody>
        {error && <Alert status="error" mb={3}><AlertIcon />{t('estate.' + error)}</Alert>}
        <Text mb={4} fontWeight="700" data-no-translate>{isFolder ? item?.record.folderName : item?.record.fileName}</Text>
        <FormControl>
          <FormLabel>{t('Destination folder')}</FormLabel>
          <Select value={destination} isDisabled={saving} aria-label={t('Destination folder')} onChange={event => setDestination(event.target.value)}>
            <option value="">{t(isFolder ? 'Top level folders' : 'Files without folder')}</option>
            {choices.map(folder => <option key={folder._id} value={folder._id}>{folderPath(folder, folders)}</option>)}
          </Select>
        </FormControl>
      </ModalBody>
      <ModalFooter gap={2}>
        <Button colorScheme="blue" isLoading={saving} onClick={move}>{t('Move')}</Button>
        <Button isDisabled={saving} onClick={onClose}>{t('Cancel')}</Button>
      </ModalFooter>
    </ModalContent>
  </Modal>;
}
