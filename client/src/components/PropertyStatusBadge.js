import { Badge, Stack, Text } from '@chakra-ui/react';
import { useLanguage } from 'i18n';
export default function PropertyStatusBadge({ property }) {
  const { t } = useLanguage();
  const status = property?.sale?.status || String(property?.status || '').toUpperCase();
  const rented = status === 'RENTED' || (status === 'SOLD' && property?.transactionType === 'RENT');
  if (!rented && status !== 'SOLD') return null;
  return <Stack mt={1} spacing={1} align="start">
    <Badge colorScheme={rented ? 'purple' : 'green'} borderRadius="full" px={2}>{t(rented ? 'Rented' : 'Sold')}</Badge>
    <Text fontSize="xs" color="var(--crm-text)">{t(rented ? 'Rented to' : 'Sold to')}: <span data-no-translate>{property.sale?.customerName || t('Customer unavailable')}</span></Text>
  </Stack>;
}
