import { Text } from '@chakra-ui/react';
import { tr } from 'i18n/runtime';
export default function LeadOwner({ lead }) {
  const owner = lead?.createBy;
  const name = owner && typeof owner === 'object'
    ? [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.username
    : lead?.createByName;
  return <Text fontSize="xs" fontWeight="normal" color="gray.500" mt={1} data-testid="lead-owner">
    {tr('pipeline.owner')}: {name || tr('Unknown')}
  </Text>;
}
