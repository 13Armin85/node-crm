import React from 'react';
import { Box } from '@chakra-ui/react';
import RecordFields from './RecordFields';
import { useRecordEditing } from './recordEditing';

// Keep each page's existing actions and related tables around its common fields.
export default function WorkspaceInformation({ children }) {
  const editing = useRecordEditing();
  if (!editing?.definition || !editing.record) return <>{children}</>;
  const audit = [
    { name: 'createBy', label: 'Created By', relation: 'Users', type: 'text' },
    { name: 'timestamp', label: 'Created On', type: 'datetime' },
  ].filter(field => editing.record[field.name] && !editing.definition.fields.some(item => item.name === field.name));
  const definition = { ...editing.definition, fields: [...editing.definition.fields, ...audit.map((field, index) => ({ ...field, order: 10000 + index }))] };
  return <Box gridColumn="1 / -1" minW={0}><RecordFields definition={definition} record={editing.record} /></Box>;
}
export function LegacyInformationOnly({ children }) {
  return useRecordEditing() ? null : <>{children}</>;
}
