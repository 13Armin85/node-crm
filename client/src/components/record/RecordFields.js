import React, { useState } from 'react';
import { Box, Heading, Link, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiArrowUpRight } from 'react-icons/fi';
import { getIn } from 'formik';
import { useLanguage } from 'i18n';
import { localized, fieldPath, FileInput } from 'components/dynamicForm/DynamicFormRenderer';
import RecordValue from 'components/relations/RecordValue';
import CurrencyAmount from 'components/CurrencyAmount';
import { safeUrl, sanitizeHtml } from 'services/contentSecurity';
import { formValue } from 'utils/formValue';
import { roomPlanMatches, isRoomPlanField } from 'utils/roomPlans';
import { useRecordEditing, canEditRecordField } from './recordEditing';
import RecordFieldEditor from './RecordFieldEditor';

const relationPaths = { Users: '/userView/', Contacts: '/contactView/', Leads: '/leadView/', Properties: '/propertyView/', Opportunities: '/opportunitiesView/', 'Partner Customers': '/partner-customers/' };
function RecordField({ field, value, label, record, language, t }) {
  const editing = useRecordEditing(), [open, setOpen] = useState(false);
  const editable = editing?.editable && canEditRecordField(field);
  const optionLabel = item => field.options?.find(option => isRoomPlanField(field) ? roomPlanMatches(option.value, item) : String(option.value) === String(item));
  const format = item => {
    const option = optionLabel(item);
    const display = option && !field.relation ? t(localized(option.label || option.name, language)) : <RecordValue name={field.name} field={field} value={item} />;
    const id = formValue(item), path = relationPaths[field.relation];
    return <>{display}{path && /^[a-f\d]{24}$/i.test(id) && <Link as={RouterLink} to={path + id} className="crm-record-reference-link" aria-label={t('View')}><FiArrowUpRight /></Link>}</>;
  };
  let content = Array.isArray(value) && field.type !== 'file' ? value.length ? value.map((item, index) => <span key={index}>{index > 0 && ', '}{format(item)}</span>) : '—' : format(value);
  if (value !== undefined && value !== null && value !== '') {
    if (['date', 'datetime', 'datetime-local'].includes(field.type) && Number.isFinite(Date.parse(value))) content = new Date(value).toLocaleString(language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US', field.type === 'date' ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' });
    if (field.type === 'checkbox') content = t(value ? 'Yes' : 'No');
    if (field.type === 'currency') content = <CurrencyAmount amount={value} currency={record?.currency || record?.price?.currency || 'TRY'} />;
    if (field.type === 'file' && Array.isArray(value)) content = <FileInput value={value} disabled />;
    if ((field.type === 'url' || field.name === 'url') && safeUrl(value)) content = <Link href={safeUrl(value)} isExternal>{String(value)}</Link>;
    if (field.name === 'html') content = <div className="crm-record-html" dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }} />;
  }
  const start = event => { if (!editable || event.target.closest('a,button,input,select,textarea')) return; event.preventDefault(); setOpen(true); };
  return <Box data-record-field={fieldPath(field)} className={`crm-record-field${field.type === 'textarea' ? ' crm-record-field--wide' : ''}${editable ? ' crm-record-field--editable' : ''}${open ? ' crm-record-field--editing' : ''}`} onDoubleClick={start}>
    <dt>{label}</dt><dd tabIndex={editable && !open ? 0 : undefined} title={editable && !open ? t('details.doubleClick') : undefined} onKeyDown={event => { if (editable && !open && event.target === event.currentTarget && ['Enter', 'F2'].includes(event.key)) { event.preventDefault(); setOpen(true); } }}>
      {open ? <RecordFieldEditor field={field} editing={editing} onClose={() => setOpen(false)} /> : content}
    </dd>
  </Box>;
}
export default function RecordFields({ definition, record, title }) {
  const { t, language } = useLanguage();
  const editing = useRecordEditing();
  const fields = [...(definition?.fields || [])].sort((a, b) => (a.order || 0) - (b.order || 0)).filter(field => field.enabled !== false && !['password', 'authVersion', 'deleted', 'avatarFilename', 'avatarVersion'].includes(field.name));
  return <section className="crm-detail-surface crm-record-information">{title && <Heading size="sm" mb={4}>{title}</Heading>}{editing?.editable && <Text fontSize="sm" color="var(--crm-muted)" mb={3}>{t('details.doubleClick')}</Text>}<dl className="crm-record-fields">
    {fields.map(field => {
      const value = getIn(record, fieldPath(field)) ?? getIn(record, field.name), label = t(localized(field.label, language) || field.name.replace(/([a-z])([A-Z])/g, '$1 $2'));
      return <RecordField key={fieldPath(field)} {...{ field, value, label, record, language, t }} />;
    })}
  </dl></section>;
}
