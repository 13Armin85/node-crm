import React, { useEffect, useState } from 'react';
import { Box, Heading, Link, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useLanguage } from 'i18n';
import { getApi } from 'services/api';
import RecordValue from 'components/relations/RecordValue';
import { formValue } from 'utils/formValue';
export default function RelatedRecordPanels({ record }) {
  const { t } = useLanguage();
  const [activities, setActivities] = useState(null);
  const contact = formValue(record?.contact);
  const lead = formValue(record?.lead);
  useEffect(() => { let active = true; setActivities(null); if (contact || lead) getApi(contact ? 'api/contact/view/' + contact : 'api/lead/view/' + lead).then(result => { if (active && result?.status === 200) setActivities(result.data); }); return () => { active = false; }; }, [contact, lead]);
  const relations = [['contact', 'Related Contact', 'Contacts', '/contactView/'], ['lead', 'Related Lead', 'Leads', '/leadView/'], ['accountName', 'Partner Customer', 'Partner Customers', '/partner-customers/']];
  const groups = [['EmailHistory', 'Emails'], ['phoneCallHistory', 'Calls'], ['task', 'Tasks'], ['meetingHistory', 'Meetings'], ['quotes', 'Quotes'], ['invoice', 'Invoices'], ['Document', 'Documents'], ['textMsg', 'Text messages']];
  return <section className="crm-detail-surface crm-related-records"><Heading size="sm" mb={4}>{t('details.relationships')}</Heading>
    <div className="crm-related-grid">{relations.filter(([name]) => record?.[name]).map(([name, label, moduleName, path]) => <Box key={name} className="crm-related-card"><Heading size="xs">{t(label)}</Heading><Link as={RouterLink} to={path + formValue(record[name])}><RecordValue name={name} value={record[name]} moduleName={moduleName} /></Link></Box>)}
      <Box className="crm-related-card"><Heading size="xs">{t('Related Properties')}</Heading><RecordValue name="properties" value={record?.properties} /></Box>
      {groups.map(([key, label]) => <Box key={key} className="crm-related-card"><Heading size="xs">{t(label)}</Heading>{(activities?.[key] || []).length ? activities[key].map(item => <Text key={item._id} data-no-translate>{item.title || item.subject || item.agenda || item.callSubject || item.callNotes || item.folderName || item.invoiceNumber || item.quoteNumber || item.description || item.message || item.recipient || '—'}</Text>) : <Text color="var(--crm-muted)">{t('No Data Found')}</Text>}</Box>)}
    </div>
  </section>;
}
