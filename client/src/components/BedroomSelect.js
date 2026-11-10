import React, { useRef, useState } from 'react';
import { Box, IconButton, Input, InputGroup, InputLeftElement, InputRightElement, Popover, PopoverAnchor, PopoverContent, Portal, Text } from '@chakra-ui/react';
import { FiCheck, FiChevronDown, FiPlus, FiX } from 'react-icons/fi';
import { MdOutlineBed } from 'react-icons/md';
import { useLanguage } from 'i18n';
import { normalizeBedroom } from 'utils/roomPlans';
import './BedroomSelect.css';

export default function BedroomSelect({ id, name, value = '', options = [], onChange, onBlur, placeholder, readOnly = false, disabled = false, ...props }) {
  const { t, language } = useLanguage();
  const direction = language === 'fa' ? 'rtl' : 'ltr';
  const input = useRef(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(-1);
  const choices = [...new Set(options.map(option => String(option.value)))];
  const search = normalizeBedroom(query).toLowerCase();
  const matches = choices.filter(choice => normalizeBedroom(choice).toLowerCase().includes(search));
  const custom = query.trim() && !choices.some(choice => normalizeBedroom(choice) === normalizeBedroom(query));
  const items = custom ? [...matches, query.trim()] : matches;
  const close = () => { setOpen(false); setQuery(''); setActive(-1); };
  const choose = next => { onChange(next); close(); };
  const locked = readOnly || disabled;
  return <Popover isOpen={open && !locked} onClose={close} autoFocus={false} returnFocusOnClose={false} matchWidth placement="bottom-start" strategy="fixed">
    <PopoverAnchor><InputGroup className="crm-bedroom-picker" dir={direction}>
      <InputLeftElement pointerEvents="none"><MdOutlineBed size={18} /></InputLeftElement>
      <Input {...props} ref={input} id={id} name={name} type="text" dir="ltr" role="combobox" autoComplete="off"
        aria-autocomplete="list" aria-expanded={open && !locked} aria-controls={`${id}-options`}
        aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
        isReadOnly={readOnly} isDisabled={disabled} value={value ?? ''} placeholder={placeholder || t('estate.bedroomPlaceholder')}
        onFocus={() => { if (!locked) { setOpen(true); setQuery(''); setActive(-1); } }}
        onClick={() => { if (!locked) setOpen(true); }}
        onBlur={event => { close(); onBlur?.(event); }}
        onChange={event => { setOpen(true); setQuery(event.target.value); setActive(-1); onChange(event.target.value); }}
        onKeyDown={event => {
          if (locked) return;
          if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
          if (event.key === 'Tab') close();
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault(); setOpen(true);
            setActive(index => event.key === 'ArrowDown' ? Math.min(items.length - 1, index + 1) : index <= 0 ? items.length - 1 : index - 1);
          }
          if (event.key === 'Enter' && open) { event.preventDefault(); if (active >= 0 && items[active]) choose(items[active]); else close(); }
        }} />
      {!locked && <InputRightElement width="68px" gap={0}>
        {value !== '' && value != null && <IconButton type="button" aria-label={t('Clear selection')} icon={<FiX />} size="xs" variant="ghost" onMouseDown={event => event.preventDefault()} onClick={() => { onChange(''); setQuery(''); setActive(-1); input.current?.focus(); }} />}
        <IconButton type="button" aria-label={t('estate.bedroomChoices')} aria-expanded={open} icon={<FiChevronDown />} size="xs" variant="ghost" className={open ? 'is-open' : ''}
          onMouseDown={event => event.preventDefault()} onClick={() => { const next = !open; if (next) input.current?.focus(); setOpen(next); setQuery(''); setActive(-1); }} />
      </InputRightElement>}
    </InputGroup></PopoverAnchor>
    <Portal><PopoverContent className="crm-bedroom-menu" rootProps={{ style: { zIndex: 1800 } }} dir={direction}>
      <Box className="crm-bedroom-menu__heading"><MdOutlineBed size={17} /><Text>{t('estate.bedroomChoices')}</Text></Box>
      <Box id={`${id}-options`} role="listbox" aria-label={t('estate.bedroomChoices')} className="crm-bedroom-menu__grid" dir="ltr">
        {items.map((choice, index) => {
          const selected = normalizeBedroom(value) === normalizeBedroom(choice);
          const own = Boolean(custom && index === items.length - 1);
          return <Box as="button" type="button" key={choice} role="option" id={`${id}-option-${index}`} aria-selected={selected}
            className={`crm-bedroom-choice${selected ? ' is-selected' : ''}${index === active ? ' is-active' : ''}${own ? ' crm-bedroom-choice--custom' : ''}`}
            onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(choice)}>
            {own && <FiPlus size={14} />}<span data-no-translate>{choice}</span>{selected && <FiCheck className="crm-bedroom-choice__check" size={12} />}
          </Box>;
        })}
      </Box>
      <Text className="crm-bedroom-menu__hint">{t('estate.bedroomCustomHint')}</Text>
    </PopoverContent></Portal>
  </Popover>;
}
