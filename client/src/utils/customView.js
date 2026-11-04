import React from 'react';
import { Box } from '@chakra-ui/react';
import { useFormDefinition } from './managedForm';
import RecordFields from 'components/record/RecordFields';
import { useLanguage } from 'i18n';

export default function CustomView({ data, fieldData, id }) {
  const { t } = useLanguage();
  const { definition } = useFormDefinition(data?.moduleName);
  const legacy = (data?.fields || []).filter(field => !field.delete && !field.isDefault).map(field => ({ ...field,
    kind: field.kind || 'SYSTEM_FIELD', relation: field.relation || field.ref,
    type: ({ tel: 'phone', check: 'checkbox', 'datetime-local': 'datetime' })[field.type] || field.type,
  }));
  const effective = definition || { moduleName: data?.moduleName, fields: legacy };
  return <Box id={id} className="crm-custom-record-details"><RecordFields definition={effective} record={fieldData} title={t('Information')} /></Box>;
}
