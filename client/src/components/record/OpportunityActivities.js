import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Button, Link, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useLanguage } from 'i18n';
import { getApi } from 'services/api';
import { HasAccess } from '../../redux/accessUtils';
import CommonCheckTable from 'components/reactTable/checktable';
import AddEmail from 'views/admin/emailHistory/components/AddEmail';
import AddCall from 'views/admin/phoneCall/components/AddPhoneCall';
import AddMeeting from 'views/admin/meeting/components/Addmeeting';
import AddTask from 'views/admin/task/components/AddEdit';
import RecordDocuments from './RecordDocuments';

const groups = [
  ['Emails', 'Email', 'subject', '/Email/'],
  ['Calls', 'Call', 'callNotes', '/phone-call/'],
  ['Meetings', 'Meeting', 'agenda', '/metting/'],
  ['Tasks', 'Task', 'title', '/view/'],
];

export default function OpportunityActivities({ recordId }) {
  const { t, language } = useLanguage();
  const permissions = HasAccess(groups.map(([module]) => module));
  const [data, setData] = useState({}), [busy, setBusy] = useState(true), [error, setError] = useState(false);
  const [adding, setAdding] = useState(''), [expanded, setExpanded] = useState({});
  const load = useCallback(async () => {
    setBusy(true); setError(false);
    try {
      const result = await getApi(`api/record-workspace/Opportunities/${recordId}/activities`);
      if (result?.status === 200) setData(result.data); else setError(true);
    } catch { setError(true); }
    finally { setBusy(false); }
  }, [recordId]);
  useEffect(() => { load(); }, [load]);
  const lead = !data.sources?.contact && data.sources?.lead;
  const contact = data.sources?.contact;
  const sourceId = contact?._id || lead?._id;
  const common = { opportunityId: recordId, id: sourceId, fetchData: load, onClose: () => setAdding('') };
  const related = contact ? 'contactView' : lead ? 'leadView' : undefined;
  const available = groups.filter((_, index) => permissions[index]?.view);
  const date = value => value ? new Date(/^\d{10,13}$/.test(String(value)) ? Number(value) : value).toLocaleString(language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US') : '—';
  return <Box className="crm-detail-surface crm-record-activities">
    {error && <Alert status="error"><AlertIcon />{t('estate.serverError')}</Alert>}
    <Tabs isLazy><TabList overflowX="auto">{available.map(([module, label]) => <Tab key={module}>{t(label)}</Tab>)}<Tab>{t('Documents')}</Tab></TabList>
      <TabPanels>{available.map(([module, label, field, path]) => {
        const items = data[module] || [];
        const shown = expanded[module] ? items : items.slice(0, 1);
        const access = permissions[groups.findIndex(group => group[0] === module)];
        const columns = [
          { Header: t(module === 'Emails' ? 'Subject' : module === 'Tasks' ? 'Title' : module === 'Meetings' ? 'Agenda' : 'Call Notes'), accessor: field,
            cell: ({ row, value }) => <Link as={RouterLink} color="brand.600" to={path + row.original._id}>{value || row.original.recipient || t('Details')}</Link> },
          { Header: t('Status'), accessor: 'status', cell: ({ value, row }) => <Text>{t(value || row.original.deliveryStatus || '—')}</Text> },
          { Header: t('Date'), accessor: 'timestamp', cell: ({ row }) => <Text>{date(row.original.dateTime || row.original.start || row.original.startDate || row.original.timestamp || row.original.createdDate)}</Text> },
        ];
        return <TabPanel key={module} px={0}><CommonCheckTable title={t(label)} isLoding={busy} columnData={columns} allData={shown} tableData={shown} dataLength={items.length}
          AdvanceSearch={false} checkBox={false} tableCustomFields={[]} deleteMany ManageGrid={false} onOpen={() => setAdding(module)} access={access} />
          {items.length > 1 && <Button size="sm" variant="outline" onClick={() => setExpanded(current => ({ ...current, [module]: !current[module] }))}>{t(expanded[module] ? 'Show less' : 'Show more')}</Button>}
        </TabPanel>;
      })}<TabPanel px={0}><RecordDocuments moduleName="Opportunities" recordId={recordId} /></TabPanel></TabPanels>
    </Tabs>
    {adding === 'Emails' && <AddEmail {...common} isOpen lead={Boolean(lead)} contactEmail={contact?.email} leadEmail={lead?.leadEmail} />}
    {adding === 'Calls' && <AddCall {...common} isOpen lead={Boolean(lead)} cData={contact} LData={lead} viewData={{ contact, lead }} />}
    {adding === 'Meetings' && <AddMeeting {...common} isOpen leadContect={related} view leadName={lead} />}
    {adding === 'Tasks' && <AddTask {...common} isOpen leadContect={related} userAction="add" view />}
  </Box>;
}
