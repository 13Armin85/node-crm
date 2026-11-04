import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Checkbox, Flex, IconButton, Menu, MenuButton, MenuDivider, MenuItem, MenuList, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Portal, Stack, Text } from '@chakra-ui/react';
import { BsColumnsGap } from 'react-icons/bs';
import { FiArrowUp, FiArrowDown, FiColumns, FiDownload, FiMove, FiUpload } from 'react-icons/fi';
import { useLanguage } from 'i18n';
import { getStoredUser } from 'services/authSession';

export const columnKey = (column, index) => String(column.id || (typeof column.accessor === 'string' && column.accessor) || index);

const strings = values => Array.isArray(values) ? [...new Set(values.filter(value => typeof value === 'string'))] : [];
export const orderedColumnKeys = (keys, order = []) => [...new Set([...strings(order).filter(key => keys.includes(key)), ...keys])];
export function readColumnPreferences(storageKey) {
  if (!storageKey) return { hidden: [], order: [] };
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return Array.isArray(value) ? { hidden: strings(value), order: [] }
      : { hidden: strings(value?.hidden), order: strings(value?.order) };
  } catch { return { hidden: [], order: [] }; }
}

export function useVisibleColumns(columns, moduleName) {
  const storageKey = moduleName ? `crm-table-columns:${getStoredUser()?._id || ''}:${moduleName}` : null;
  const [preferences, setPreferences] = useState(() => readColumnPreferences(storageKey));
  useEffect(() => { setPreferences(readColumnPreferences(storageKey)); }, [storageKey]);
  const keys = useMemo(() => columns.map(columnKey), [columns]);
  const order = useMemo(() => orderedColumnKeys(keys, preferences.order), [keys, preferences.order]);
  const visible = useMemo(() => order.filter(key => !preferences.hidden.includes(key)), [order, preferences.hidden]);
  const orderedColumns = useMemo(() => {
    const byId = new Map(columns.map((column, index) => [columnKey(column, index), column]));
    return order.map(id => byId.get(id));
  }, [columns, order]);
  const selectedColumns = useMemo(() => orderedColumns.filter((column, index) => visible.includes(order[index])), [orderedColumns, visible, order]);
  return { visible, order, orderedColumns, columns: selectedColumns,
    setVisible: (selected, nextOrder = order) => {
      const next = { hidden: keys.filter(key => !selected.includes(key)), order: orderedColumnKeys(keys, nextOrder) };
      setPreferences(next);
      if (storageKey) try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the current table usable when storage is unavailable. */ }
    } };
}

// The same menu and column dialog are used by server-paged and client tables.
export default function TableTools({ columns = [], visible, order, onColumnsChange, onImport, importLabel = 'Import', exports = [], disabled }) {
  const { t, direction } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [draftOrder, setDraftOrder] = useState([]);
  const [dragging, setDragging] = useState(null);
  useEffect(() => {
    if (open) {
      setDraft(visible || columns.map(column => column.id));
      setDraftOrder(orderedColumnKeys(columns.map(column => column.id), order));
      setDragging(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = id => setDraft(current => current.includes(id) ? current.filter(key => key !== id) : [...current, id]);
  const move = (id, target) => setDraftOrder(current => {
    const index = current.indexOf(id);
    if (index < 0 || target < 0 || target >= current.length) return current;
    const next = [...current]; next.splice(index, 1); next.splice(target, 0, id); return next;
  });
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
    <Modal isOpen={open} onClose={() => setOpen(false)} isCentered scrollBehavior="inside">
      <ModalOverlay /><ModalContent dir={direction} className="crm-columns-modal" maxH="calc(100vh - 2rem)">
        <ModalHeader>{t('Manage Columns')}</ModalHeader><ModalCloseButton />
        <ModalBody>
          <Text fontSize="sm" color="var(--crm-muted)" mb={3}>{t('columns.orderHint')}</Text>
          <Stack spacing={2} role="list" aria-label={t('columns.leftToRight')}>
            {draftOrder.map((id, index) => {
              const column = columns.find(item => item.id === id);
              if (!column) return null;
              return <Flex key={id} role="listitem" data-column-id={id} align="center" gap={2} px={2} py={2} border="1px solid" borderColor={dragging === id ? 'brand.500' : 'var(--crm-border)'} bg="var(--crm-panel)" minW={0}
                onDragOver={event => { if (dragging) event.preventDefault(); }}
                onDrop={event => { event.preventDefault(); if (dragging) move(dragging, index); setDragging(null); }}>
                <Box as="span" draggable onDragStart={event => { setDragging(id); event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDragging(null)} title={t('columns.drag')} cursor="grab" color="var(--crm-muted)"><FiMove aria-hidden="true" /></Box>
                <Text as="span" fontSize="xs" color="var(--crm-muted)" minW="18px" textAlign="center">{index + 1}</Text>
                <Checkbox flex="1" minW={0} isChecked={draft.includes(id)} onChange={() => toggle(id)} sx={{ '& .chakra-checkbox__label': { whiteSpace: 'normal', overflowWrap: 'anywhere' } }}>{column.label}</Checkbox>
                <Flex gap={1} dir="ltr" flexShrink={0}>
                  <IconButton size="xs" variant="ghost" aria-label={`${t('columns.moveUp')}: ${column.label}`} icon={<FiArrowUp />} isDisabled={index === 0} onClick={() => move(id, index - 1)} />
                  <IconButton size="xs" variant="ghost" aria-label={`${t('columns.moveDown')}: ${column.label}`} icon={<FiArrowDown />} isDisabled={index === draftOrder.length - 1} onClick={() => move(id, index + 1)} />
                </Flex>
              </Flex>;
            })}
          </Stack>
        </ModalBody>
        <ModalFooter gap={2}><Button size="sm" variant="brand" isDisabled={!draft.length} onClick={() => { onColumnsChange(draftOrder.filter(id => draft.includes(id)), draftOrder); setOpen(false); }}>{t('Save')}</Button><Button size="sm" variant="outline" onClick={() => setOpen(false)}>{t('Cancel')}</Button></ModalFooter>
      </ModalContent>
    </Modal>
  </>;
}
