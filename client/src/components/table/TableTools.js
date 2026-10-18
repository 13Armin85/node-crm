import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, IconButton, Menu, MenuButton, MenuDivider, MenuItem, MenuList, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Portal, Stack } from '@chakra-ui/react';
import { BsColumnsGap } from 'react-icons/bs';
import { FiColumns, FiDownload, FiUpload } from 'react-icons/fi';
import { useLanguage } from 'i18n';

export const columnKey = (column, index) => String(column.id || (typeof column.accessor === 'string' && column.accessor) || index);

export function useVisibleColumns(columns) {
  const [hidden, setHidden] = useState([]);
  const keys = useMemo(() => columns.map(columnKey), [columns]);
  const visible = useMemo(() => keys.filter(key => !hidden.includes(key)), [keys, hidden]);
  const selectedColumns = useMemo(() => columns.filter((column, index) => !hidden.includes(columnKey(column, index))), [columns, hidden]);
  return { visible, columns: selectedColumns,
    setVisible: selected => setHidden(keys.filter(key => !selected.includes(key))) };
}

// The same menu and column dialog are used by server-paged and client tables.
export default function TableTools({ columns = [], visible, onColumnsChange, onImport, importLabel = 'Import', exports = [], disabled }) {
  const { t, direction } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  useEffect(() => { if (open) setDraft(visible || columns.map(column => column.id)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = id => setDraft(current => current.includes(id) ? current.filter(key => key !== id) : [...current, id]);
  return <>
    <Menu isLazy strategy="fixed" placement="bottom-end" preventOverflow>
      <MenuButton as={IconButton} className="crm-table-settings" aria-label={t('Table tools')} title={t('Table tools')} icon={<BsColumnsGap />} variant="outline" size="sm" isDisabled={disabled} />
      <Portal><MenuList className="crm-table-tools-menu" minW="210px" p="8px" zIndex="popover" dir={direction}>
        {onColumnsChange && <MenuItem icon={<FiColumns />} onClick={() => setOpen(true)}>{t('Manage Columns')}</MenuItem>}
        {onImport && <MenuItem icon={<FiUpload />} onClick={onImport}>{t(importLabel)}</MenuItem>}
        {exports.length > 0 && <MenuDivider />}
        {exports.map(item => <MenuItem key={item.label} icon={<FiDownload />} isDisabled={item.disabled} onClick={item.onClick}>{t(item.label)}</MenuItem>)}
      </MenuList></Portal>
    </Menu>
    <Modal isOpen={open} onClose={() => setOpen(false)} isCentered>
      <ModalOverlay /><ModalContent dir={direction} className="crm-columns-modal">
        <ModalHeader>{t('Manage Columns')}</ModalHeader><ModalCloseButton />
        <ModalBody><Stack spacing={3}>{columns.map(column => <Checkbox key={column.id} isChecked={draft.includes(column.id)} onChange={() => toggle(column.id)}>{column.label}</Checkbox>)}</Stack></ModalBody>
        <ModalFooter gap={2}><Button size="sm" variant="brand" isDisabled={!draft.length} onClick={() => { onColumnsChange(draft); setOpen(false); }}>{t('Save')}</Button><Button size="sm" variant="outline" onClick={() => setOpen(false)}>{t('Cancel')}</Button></ModalFooter>
      </ModalContent>
    </Modal>
  </>;
}
