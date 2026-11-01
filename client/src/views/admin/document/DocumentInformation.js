import { Fragment } from 'react';
import { Box } from '@chakra-ui/react';
import { useLanguage } from 'i18n';
import RecordValue from 'components/relations/RecordValue';
import { localized } from 'components/dynamicForm/DynamicFormRenderer';

export default function DocumentInformation({ file, folderName, category, definition }) {
  const { t, language } = useLanguage();
  const relations = file.relatedRecords?.length ? file.relatedRecords : file.entityId ? [{ entityType: file.entityType, entityId: file.entityId }] : [];
  const relationNames = { Property: 'Property', Lead: 'Lead', Contact: 'Contact', Opportunity: 'Opportunity', PartnerCustomer: 'Partner Customer' };
  const fields = Object.entries(file.customFields || {}).filter(([, value]) => value !== null && value !== undefined && value !== '');
  return <Box className="crm-document-information">
    <p className="crm-document-information__title">{t('2. Information and category')}</p>
    <dl>
      <dt>{t('Section / category')}</dt><dd>{t(category || 'General')}</dd>
      <dt>{t('Storage location')}</dt><dd data-no-translate>{folderName || t('Files without folder')}</dd>
      {relations.map(record => <Fragment key={`${record.entityType}-${record.entityId}`}>
        <dt>{t(record.entityType === 'Contact' && file.entityType === 'Property' ? 'Property Owner' : relationNames[record.entityType] || 'Related record')}</dt>
        <dd><RecordValue value={record.label || record.entityId} moduleName={({ Property: 'Properties', Lead: 'Leads', Contact: 'Contacts', Opportunity: 'Opportunities', PartnerCustomer: 'Partner Customers' })[record.entityType]} /></dd>
      </Fragment>)}
      {fields.map(([name, value]) => {
        const field = definition?.fields?.find(field => field.name === name && field.kind === 'CUSTOM_FIELD');
        return <Fragment key={name}>
          <dt>{field ? localized(field.label, language) : t(name)}</dt>
          <dd><RecordValue name={name} field={field} value={value} /></dd>
        </Fragment>;
      })}
    </dl>
  </Box>;
}
