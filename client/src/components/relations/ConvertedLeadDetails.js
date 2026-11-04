import { Box, Grid, Text } from '@chakra-ui/react';
import { tr } from 'i18n/runtime';
import RecordValue from './RecordValue';

export default function ConvertedLeadDetails({ records, title }) {
  if (!records?.length) return null;
  return <Box my={4} className="crm-detail-surface crm-converted-details">
    <Text fontWeight="bold" mb={3}>{title || tr('leadConversion.original')}</Text>
    <Text fontSize="sm" color="var(--crm-muted)" mb={3}>{tr('details.sourceHistoryHint')}</Text>
    {records.map(record => {
      const fields = record.fields || [];
      const { customFields = {}, ...values } = record.values || {};
      const entries = [...Object.entries(values).filter(([key]) => !['_id', '__v', '_duplicateKeys', 'deleted', 'createBy', 'updatedDate', 'convertedLeads', 'convertedContacts'].includes(key)),
        ...Object.entries(customFields)];
      return <Grid key={record.leadId || record.contactId} templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={3} mb={4}>
        {entries.filter(([, value]) => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length)).map(([name, value]) =>
          <Box key={name} minW={0} className="crm-record-field">
            <Text fontSize="sm" fontWeight="bold"><RecordValue value={fields.find(field => field.name === name)?.label || name} /></Text>
            <Text fontSize="sm" whiteSpace="pre-wrap" overflowWrap="anywhere"><RecordValue name={name} field={fields.find(field => field.name === name)} value={value} /></Text>
          </Box>)}
      </Grid>;
    })}
  </Box>;
}
