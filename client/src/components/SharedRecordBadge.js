import { Text } from '@chakra-ui/react';
import { useLanguage } from 'i18n';
export default function SharedRecordBadge({ record }) {
  const { t } = useLanguage();
  return record?._receivedFromAdmin ? <Text className="crm-received-record-label" fontSize="10px" fontWeight="400" color="gray.500" mt="2px">{t('Received from admin')}</Text> : null;
}
