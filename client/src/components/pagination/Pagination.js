import React from 'react';
import RecordPagination from './RecordPagination';

export default function Pagination({ gotoPage, setGopageValue, pageCount, setPageSize, pageSize, pageIndex, total, isLoading }) {
  return <RecordPagination page={pageIndex + 1} pageCount={pageCount} total={total} pageSize={pageSize} isLoading={isLoading}
    onPageChange={page => { gotoPage(page - 1); setGopageValue?.(page); }}
    onPageSizeChange={size => { setPageSize(size); gotoPage(0); setGopageValue?.(1); }} />;
}
