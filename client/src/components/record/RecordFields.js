import React from 'react';
import { Box, Heading } from '@chakra-ui/react';
import { getIn } from 'formik';
import { useLanguage } from 'i18n';
import { localized, fieldPath, FileInput } from 'components/dynamicForm/DynamicFormRenderer';
import RecordValue from 'components/relations/RecordValue';
import CurrencyAmount from 'components/CurrencyAmount';
export default function RecordFields({ definition, record, title }) {
  const { t, language } = useLanguage();
  const fields = (definition?.fields || []).filter(field => field.enabled !== false && !['password', 'authVersion', 'deleted', 'avatarFilename'].includes(field.name));
  return <section className="crm-detail-surface crm-record-information">{title && <Heading size="sm" mb={4}>{title}</Heading>}<dl className="crm-record-fields">
    {fields.map(field => {
      const value = getIn(record, fieldPath(field)) ?? getIn(record, field.name), label = t(localized(field.label, language) || field.name.replace(/([a-z])([A-Z])/g, '$1 $2'));
      const option = field.options?.find(option => String(option.value) === String(value));
      let content = option && !field.relation ? t(localized(option.label || option.name, language)) : <RecordValue name={field.name} field={field} value={value} />;
      if (Array.isArray(value) && !value.length) content = '—';
      if (value !== undefined && value !== null && value !== '') {
        if (['date', 'datetime', 'datetime-local'].includes(field.type) && Number.isFinite(Date.parse(value))) content = new Date(value).toLocaleString(language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US', field.type === 'date' ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' });
        if (field.type === 'checkbox') content = t(value ? 'Yes' : 'No');
        if (field.type === 'currency') content = <CurrencyAmount amount={value} currency={record?.currency || record?.price?.currency || 'TRY'} />;
        if (field.type === 'file' && Array.isArray(value)) content = <FileInput value={value} disabled />;
      }
      return <Box key={fieldPath(field)} className={`crm-record-field${field.type === 'textarea' ? ' crm-record-field--wide' : ''}`}><dt>{label}</dt><dd>{content}</dd></Box>;
    })}
  </dl></section>;
}
