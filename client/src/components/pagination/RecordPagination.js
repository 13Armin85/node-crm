import React, { useEffect, useState } from 'react';
import { Button, Flex, IconButton, Input, Select, Text } from '@chakra-ui/react';
import { FiChevronsLeft, FiChevronLeft, FiChevronRight, FiChevronsRight } from 'react-icons/fi';
import { useLanguage } from 'i18n';

export default function RecordPagination({ page = 1, pageCount = 1, total, pageSize = 10, onPageChange, onPageSizeChange, isLoading = false }) {
  const { t, language } = useLanguage();
  const count = Math.max(1, pageCount);
  const current = Math.max(1, Math.min(page, count));
  const [draft, setDraft] = useState(String(current));
  useEffect(() => { setDraft(String(current)); }, [current]);
  const format = value => Number(value).toLocaleString(language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US');
  const changePage = value => {
    const next = Math.max(1, Math.min(count, value));
    setDraft(String(next));
    if (next !== current && !isLoading) onPageChange(next);
  };
  const commit = () => {
    const next = Number(draft);
    if (draft.trim() && Number.isFinite(next)) changePage(Math.trunc(next));
    else setDraft(String(current));
  };
  const start = Math.max(1, Math.min(current - 1, count - 2));
  const pages = Array.from({ length: Math.min(3, count) }, (_, index) => start + index);
  const firstRecord = total ? (current - 1) * pageSize + 1 : 0;
  const lastRecord = Math.min(current * pageSize, total || 0);
  return <Flex as="nav" className="crm-pagination crm-record-pagination" aria-label={t('Page')} aria-busy={isLoading || undefined}>
    <Text className="crm-record-pagination__summary" aria-live="polite" aria-atomic="true">
      {t('Page')} <strong>{format(current)}</strong> {t('of')} <strong>{format(count)}</strong>
      {typeof total === 'number' && <span className="crm-record-pagination__range">{format(firstRecord)}–{format(lastRecord)} / {format(total)} {t('records')}</span>}
    </Text>
    <Flex className="crm-record-pagination__pages" gap={1}>
      <IconButton className="crm-record-pagination__edge" aria-label={t('First Page')} title={t('First Page')} icon={<FiChevronsLeft />} isDisabled={current <= 1 || isLoading} onClick={() => changePage(1)} />
      <IconButton aria-label={t('Previous Page')} title={t('Previous Page')} icon={<FiChevronLeft />} isDisabled={current <= 1 || isLoading} onClick={() => changePage(current - 1)} />
      {pages.map(number => <Button key={number} aria-label={`${t('Page')} ${format(number)}`} aria-current={number === current ? 'page' : undefined} isDisabled={isLoading} onClick={() => changePage(number)}>{format(number)}</Button>)}
      <IconButton aria-label={t('Next Page')} title={t('Next Page')} icon={<FiChevronRight />} isDisabled={current >= count || isLoading} onClick={() => changePage(current + 1)} />
      <IconButton className="crm-record-pagination__edge" aria-label={t('Last Page')} title={t('Last Page')} icon={<FiChevronsRight />} isDisabled={current >= count || isLoading} onClick={() => changePage(count)} />
    </Flex>
    <Flex className="crm-record-pagination__options" align="center" gap={2}>
      {count > 3 && <label className="crm-record-pagination__jump">
        <span>{t('Go to page:')}</span>
        <Input type="number" inputMode="numeric" min={1} max={count} value={draft} isDisabled={isLoading}
          aria-label={t('Go to page:')} onChange={event => setDraft(event.target.value)} onBlur={commit}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }} />
      </label>}
      {onPageSizeChange && <Select aria-label={t('Show')} value={pageSize} isDisabled={isLoading} onChange={event => onPageSizeChange(Number(event.target.value))}>
        {[...new Set([5, 10, 20, 25, 30, 40, 50, pageSize])].sort((a, b) => a - b).map(size => <option key={size} value={size}>{t('Show')} {format(size)}</option>)}
      </Select>}
    </Flex>
  </Flex>;
}
