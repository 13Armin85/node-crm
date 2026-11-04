import React, { useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Flex, Heading, Link, Select, SimpleGrid, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import Card from 'components/card/Card';
import CurrencyAmount from 'components/CurrencyAmount';
import { getApi } from 'services/api';
import { useLanguage } from 'i18n';
export default function CommissionPerformance({ onData }) {
  const {t}=useLanguage(), [period,setPeriod]=useState('year'), [teamMonths,setTeamMonths]=useState('3'), [currency,setCurrency]=useState('TRY');
  const [data,setData]=useState(null),[busy,setBusy]=useState(true),[error,setError]=useState(false);
  useEffect(()=>{
    let active=true;setBusy(true);setError(false);
    getApi(`api/estate/dashboard/sales-summary?period=${period}&teamMonths=${teamMonths}&currency=${currency}`).then(result=>{
      if(!active)return;
      if(result?.status===200){setData(result.data);onData?.(result.data);}else{setData(null);onData?.(null);setError(true);}
    }).catch(()=>{if(active){setError(true);setData(null);onData?.(null);}}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[period,teamMonths,currency,onData]);
  const money=values=><CurrencyAmount values={values||[]} compact />;
  return <Card className="crm-dashboard-panel crm-sales-performance" mb="12px" overflow="hidden">
    <Flex className="crm-dashboard-card-header" justify="space-between" gap={3} wrap="wrap" mb={4}>
      <Box><Heading size="sm">{t('dashboard.salesPerformance')}</Heading><Text fontSize="sm" color="var(--crm-muted)" mt={2}>{t('finance.commissionBasis')}</Text></Box>
      <Flex gap={2} wrap="wrap" minW={0}>
        <Select width="auto" size="sm" aria-label={t('finance.incomePeriod')} value={period} onChange={event=>setPeriod(event.target.value)}>{['week','month','half','year'].map(key=><option key={key} value={key}>{t('finance.period.'+key)}</option>)}</Select>
        <Select width="auto" size="sm" aria-label={t('Currency')} value={currency} onChange={event=>setCurrency(event.target.value)}>{['TRY','USD','EUR'].map(key=><option key={key}>{key}</option>)}</Select>
      </Flex>
    </Flex>
    {error&&<Alert status="error"><AlertIcon/>{t('estate.serverError')}</Alert>}
    {busy?<Flex minH="180px" justify="center" align="center"><Spinner/></Flex>:<>
      <SimpleGrid columns={{base:1,sm:2,xl:4}} spacing={3} mb={5}>
        {[['sold','finance.companyIncome'],['available','finance.pendingIncome'],['lost','finance.lostIncome'],['total','finance.totalCommission']].map(([key,label])=><Box key={key} className="crm-finance-kpi" data-finance-bucket={key}>
          <Text className="crm-finance-kpi__label">{t(label)}</Text><Box className="crm-finance-kpi__value">{money(data?.[key]?.values)}</Box><Text className="crm-finance-kpi__meta">{data?.[key]?.count||0} {t('Opportunities')}</Text>
        </Box>)}
      </SimpleGrid>
    </>}
    <Flex justify="space-between" gap={3} wrap="wrap" align="center" mb={3}>
      <Heading size="sm">{t('finance.salesRanking')}</Heading>
      <Select width="auto" size="sm" aria-label={t('finance.teamPeriod')} value={teamMonths} onChange={event=>setTeamMonths(event.target.value)}>{['3','6','12'].map(months=><option key={months} value={months}>{t('finance.months.'+months)}</option>)}</Select>
    </Flex>
    {!busy&&<Box className="crm-team-sales-table" overflowX="auto">{data?.bySeller?.length?<Table size="sm" className="crm-mobile-records" role="table">
      <Thead><Tr>{['finance.rank','dashboard.teamMember','dashboard.soldCount','finance.salesValue','finance.commission'].map(label=><Th key={label}>{t(label)}</Th>)}</Tr></Thead>
      <Tbody>{data.bySeller.map(person=><Tr key={person.userId} className="crm-record-row" role="row">
        <Td role="cell" data-label={t('finance.rank')} data-mobile-role="field">{person.rank}</Td>
        <Td role="cell" data-label={t('dashboard.teamMember')} data-mobile-role="primary"><Link as={RouterLink} to={'/userView/'+person.userId}>{person.name||t('Record unavailable')}</Link></Td>
        <Td role="cell" data-label={t('dashboard.soldCount')} data-mobile-role="field">{person.soldCount}</Td>
        <Td role="cell" data-label={t('finance.salesValue')} data-mobile-role="field">{money(person.salesValues)}</Td>
        <Td role="cell" data-label={t('finance.commission')} data-mobile-role="field">{money(person.values)}</Td>
      </Tr>)}</Tbody>
    </Table>:<Text textAlign="center" py={6} color="var(--crm-muted)">{t('dashboard.noSales')}</Text>}</Box>}
  </Card>;
}
