import { Box, Grid, Text } from '@chakra-ui/react';
import { tr } from 'i18n/runtime';

const show = value => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map(show).join(', ');
  if (typeof value === 'object') {
    if (value.label || value.value) return tr(value.label || value.value);
    return JSON.stringify(value);
  }
  return tr(String(value));
};

export default function ConvertedLeadDetails({ records }) {
  if (!records?.length) return null;
  return <Box my={4}>
    <Text fontWeight="bold" mb={3}>{tr('leadConversion.original')}</Text>
    {records.map(record => {
      const fields = record.fields || [];
      const { customFields = {}, ...values } = record.values || {};
      const entries = [...Object.entries(values).filter(([key]) => !['_id', 'createBy', 'updatedDate'].includes(key)),
        ...Object.entries(customFields)];
      return <Grid key={record.leadId} templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={3} mb={4}>
        {entries.filter(([, value]) => value !== null && value !== undefined && value !== '').map(([name, value]) =>
          <Box key={name} minW={0}>
            <Text fontSize="sm" fontWeight="bold">{tr(fields.find(field => field.name === name)?.label || name)}</Text>
            <Text fontSize="sm" whiteSpace="pre-wrap" overflowWrap="anywhere">{show(value)}</Text>
          </Box>)}
      </Grid>;
    })}
  </Box>;
}
