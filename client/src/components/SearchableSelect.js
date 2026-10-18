import { normalizeSearchText } from 'utils/searchText';
import React, { useRef, useState } from 'react';
import { Box, Button, Input, InputGroup, InputRightElement, Popover, PopoverContent, PopoverAnchor, Portal, Stack, Text } from '@chakra-ui/react';
import { ChevronDownIcon, CloseIcon } from '@chakra-ui/icons';
import { useLanguage } from 'i18n';

// One input owns both the selected label and the search query.
export default function SearchableSelect({ id, name, value = '', options = [], onChange, onBlur, onSearch, disabled, busy, error, noResults, placeholder, ...props }) {
  const { t } = useLanguage();
  const input = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = options.find(option => String(option.value) === String(value));
  const matches = onSearch ? options : options.filter(option => normalizeSearchText(option.label).includes(normalizeSearchText(query)));
  const search = text => { setQuery(text); setActive(0); onSearch?.(text); };
  const close = () => { setOpen(false); search(''); };
  const choose = option => { onChange(String(option?.value || '')); close(); };
  return <Popover isOpen={open && !disabled} onClose={close} autoFocus={false} returnFocusOnClose={false} matchWidth placement="bottom-start" strategy="fixed">
    <PopoverAnchor><InputGroup>
      <Input {...props} ref={input} id={id} name={name} role="combobox" autoComplete="off" aria-autocomplete="list"
        aria-expanded={Boolean(open && !disabled)} aria-controls={`${id}-options`} aria-activedescendant={open && matches.length ? `${id}-option-${Math.min(active, matches.length - 1)}` : undefined}
        aria-busy={busy} isDisabled={disabled} value={open ? query : selected?.label || ''} placeholder={placeholder || t('Search...')} pe="4.5rem"
        onFocus={() => { if (!disabled) { setOpen(true); search(''); } }}
        onBlur={event => { onBlur?.(event); close(); }} onClick={() => { if (!disabled) setOpen(true); }} onChange={event => { setOpen(true); search(event.target.value); }}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); close(); }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            setActive(index => Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
          }
          if (event.key === 'Enter' && open) { event.preventDefault(); if (matches[active]) choose(matches[active]); }
          if (event.key === 'Tab') close();
        }} />
      <InputRightElement width="4.5rem" height="100%" gap={1}>
        {!!value && !disabled && <Button aria-label={t('Clear selection')} size="xs" variant="ghost" onMouseDown={event => event.preventDefault()} onClick={() => choose(null)}><CloseIcon boxSize={2} /></Button>}
        <ChevronDownIcon cursor="pointer" aria-hidden onMouseDown={event => event.preventDefault()} onClick={() => { if (!disabled) { setOpen(!open); if (document.activeElement !== input.current) input.current?.focus(); } }} />
      </InputRightElement>
    </InputGroup></PopoverAnchor>
    <Portal><PopoverContent rootProps={{ style: { zIndex: 1800 } }} width="100%" zIndex="popover" p={1}>
      <Stack id={`${id}-options`} role="listbox" maxH="240px" overflowY="auto" spacing={0}>
        {busy ? <Text role="status" p={3}>{t('estate.loading')}</Text> : error ? <Text role="alert" color="red.500" p={3}>{t('estate.serverError')}</Text> : matches.length ? matches.map((option, index) =>
          <Box as="button" type="button" textAlign="start" role="option" aria-selected={String(option.value) === String(value)} id={`${id}-option-${index}`} key={option.value} p={3} borderRadius="md" bg={index === active ? 'blackAlpha.100' : undefined} _dark={{ bg: index === active ? 'whiteAlpha.200' : undefined }}
            onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)} data-no-translate>{option.label}</Box>) : <Text role="status" p={3}>{t('No Data Found')}</Text>}
        {!busy && !error && noResults && matches.length > 0 && <Text role="status" p={3}>{t('No Data Found')}</Text>}
      </Stack>
    </PopoverContent></Portal>
  </Popover>;
}
