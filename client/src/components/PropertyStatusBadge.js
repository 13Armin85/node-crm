import { Badge } from '@chakra-ui/react';
import { useLanguage } from 'i18n';
export default function PropertyStatusBadge({ property }) {
  const { t } = useLanguage();
  const status = property?.sale?.status || String(property?.status || '').toUpperCase();
  const rented = status === 'RENTED' || (status === 'SOLD' && property?.transactionType === 'RENT');
  if (!rented && status !== 'SOLD') return null;
  return <Badge mt={1} colorScheme={rented ? 'purple' : 'green'} borderRadius="full" px={2}>{t(rented ? 'Rented' : 'Sold')}</Badge>;
}
