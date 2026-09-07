import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Button, Heading, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Spinner, Stack, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { useFormik, getIn, setIn } from 'formik';
import { useParams } from 'react-router-dom';
import Card from 'components/card/Card';
import DynamicFormRenderer, { isVisible, fieldPath, localized } from 'components/dynamicForm/DynamicFormRenderer';
import { useLanguage } from 'i18n';
import { getApi, postApi, putApi, deleteApi } from 'services/api';
import { HasAccess } from '../../../redux/accessUtils';

const propertySections = [
  ['estate.section.basic', name => ['title', 'description', 'category', 'subtype', 'transactionType'].includes(name)],
  ['estate.section.pricing', name => name.startsWith('price.')],
  ['estate.section.location', name => ['district', 'neighborhood', 'isInsideResidence', 'residence'].includes(name)],
  ['estate.section.details', name => ['bedroom', 'buildingAge', 'occupancyStatus', 'floor'].includes(name) || name.startsWith('area.')],
  ['estate.section.files', name => name === 'files'],
  ['estate.section.sale', name => name.startsWith('sale.')],
  ['estate.section.additional', (name, field) => field.kind === 'CUSTOM_FIELD'],
];

export function EntityPage({ moduleName }) {
  const { t, language, direction } = useLanguage();
  const [permissions] = HasAccess([moduleName]);
  const { id } = useParams();
  const [definition, setDefinition] = useState(null);
  const [items, setItems] = useState([]); const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1); const [query, setQuery] = useState(''); const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({}); const [sort, setSort] = useState('createdDate'); const [order, setOrder] = useState('desc');
  const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [record, setRecord] = useState(null); const [readOnly, setReadOnly] = useState(false); const [deleting, setDeleting] = useState(null);
  const base = `api/estate/${encodeURIComponent(moduleName)}`;
  useEffect(() => { let active = true; getApi(`api/estate/definitions/${encodeURIComponent(moduleName)}`).then(r => { if (active) { if (r.status === 200) setDefinition(r.data); else setError(r.data?.code || 'serverError'); } }); return () => { active = false; }; }, [moduleName]);
  useEffect(() => { const timer = setTimeout(() => { setSearch(query); setPage(1); }, 300); return () => clearTimeout(timer); }, [query]);
  const fetchData = useCallback(async () => {
    setBusy(true); setError('');
    const params = new URLSearchParams({ q: search, page, limit: 20, sort, order, ...filters });
    const result = await getApi(`${base}?${params}`);
    if (result.status === 200) { setItems(result.data.items); setTotal(result.data.total); }
    else setError(result.data?.code || 'serverError');
    setBusy(false);
  }, [base, search, page, sort, order, filters]);
  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    let active = true;
    if (id) getApi(`${base}/${id}`).then(r => { if (active) { if (r.status === 200) { setRecord(r.data); setReadOnly(true); } else setError(r.data?.code || 'serverError'); } });
    return () => { active = false; };
  }, [base, id]);
  let initialValues = record || {};
  if (definition && !record?._id) for (const field of definition.fields) if (getIn(initialValues, fieldPath(field)) === undefined && field.defaultValue !== undefined) initialValues = setIn(initialValues, fieldPath(field), field.defaultValue);
  const formik = useFormik({ initialValues, enableReinitialize: true,
    validate(values) {
      let errors = {};
      for (const field of definition?.fields || []) {
        if (!isVisible(field, values)) continue;
        const value = getIn(values, fieldPath(field));
        if (field.required && (value === '' || value == null || (Array.isArray(value) && !value.length))) errors = setIn(errors, fieldPath(field), 'required');
        if (value !== '' && value != null && ['number', 'currency'].includes(field.type) && (!Number.isFinite(value) || (field.min != null && value < field.min) || (field.max != null && value > field.max))) errors = setIn(errors, fieldPath(field), 'invalid');
      }
      return errors;
    },
    async onSubmit(values, helpers) {
      setError('');
      const result = record?._id ? await putApi(`${base}/${record._id}`, values) : await postApi(base, values);
      if ([200, 201].includes(result.status)) { setRecord(null); setNotice('Success'); await fetchData(); }
      else { setError(result.data?.code || 'serverError'); if (result.data?.field) helpers.setFieldError(result.data.field, result.data.code); }
    },
  });
  const open = (item, view) => { setError(''); setRecord(item); setReadOnly(view); };
  const filterNames = moduleName === 'Properties' ? ['category', 'subtype', 'transactionType', 'district', 'neighborhood', 'residence', 'bedroom', 'buildingAge', 'occupancyStatus', 'floor', 'area.type', 'sale.status'] : moduleName === 'Partner Customers' ? ['customerType', 'status', 'district'] : ['district', 'neighborhood'];
  const name = item => item.title || item.fullName || item.companyName || item.name || item.propertyType || item._id;
  const formatPrice = item => item.price?.amount != null ? new Intl.NumberFormat(language, { style: 'currency', currency: item.price.currency || 'TRY' }).format(item.price.amount) : '';
  const remove = async () => {
    const result = await deleteApi(`${base}/`, deleting._id);
    if (result.status === 200) { setDeleting(null); setNotice('Success'); fetchData(); }
    else { setError(result.data?.code || 'serverError'); setDeleting(null); }
  };
  const form = definition && moduleName === 'Properties' ? <Stack spacing={7}>{propertySections.map(([title, matches]) => {
    const fields = definition.fields.filter(field => matches(field.name, field));
    return fields.some(field => isVisible(field, formik.values)) ? <Box key={title}><Heading size="sm" mb={4}>{t(title)}</Heading><DynamicFormRenderer definition={{ ...definition, fields }} formik={formik} readOnly={readOnly} /></Box> : null;
  })}</Stack> : definition ? <DynamicFormRenderer definition={definition} formik={formik} readOnly={readOnly} /> : <Spinner />;
  return <Box pt={{ base: '100px', md: '80px' }} dir={direction}>
    <Card><Stack spacing={5}>
      <Stack direction="row" justify="space-between" align="center"><Heading size="md">{t(moduleName)}</Heading>{permissions?.create && <Button variant="brand" onClick={() => open({}, false)}>{t('Add')}</Button>}</Stack>
      {error && <Alert status="error"><AlertIcon />{t(`estate.${error}`)}</Alert>}
      {notice && <Alert status="success"><AlertIcon />{t(notice)}</Alert>}
      <Input placeholder={t('Search...')} aria-label={t('Search...')} value={query} onChange={e => setQuery(e.target.value)} />
      <Stack direction="row" flexWrap="wrap" spacing={2}>
        {filterNames.map(key => { const field = definition?.fields.find(f => f.name === key); if (!field) return null;
          return field.options?.length ? <Select maxW="200px" key={key} value={filters[key] || ''} aria-label={localized(field.label, language)} onChange={e => { setFilters({ ...filters, [key]: e.target.value }); setPage(1); }}><option value="">{localized(field.label, language)}</option>{field.options.map(o => <option key={o.value} value={o.value}>{localized(o.label, language)}</option>)}</Select>
            : !field.relation ? <Input maxW="200px" key={key} placeholder={localized(field.label, language)} value={filters[key] || ''} onChange={e => { setFilters({ ...filters, [key]: e.target.value }); setPage(1); }} /> : null;
        })}
        {moduleName === 'Properties' && ['priceMin', 'priceMax'].map(key => <Input key={key} type="number" min="0" maxW="180px" placeholder={t(`estate.${key}`)} value={filters[key] || ''} onChange={e => { setFilters({ ...filters, [key]: e.target.value }); setPage(1); }} />)}
        <Select maxW="180px" value={sort} aria-label={t('estate.sort')} onChange={e => setSort(e.target.value)}><option value="createdDate">{t('Created Date')}</option><option value={moduleName === 'Properties' ? 'title' : moduleName === 'Partner Customers' ? 'fullName' : 'name'}>{t('Name')}</option>{moduleName === 'Properties' && <option value="price.amount">{t('Price')}</option>}</Select>
        <Select maxW="180px" value={order} aria-label={t('estate.order')} onChange={e => setOrder(e.target.value)}><option value="asc">{t('estate.ascending')}</option><option value="desc">{t('estate.descending')}</option></Select>
      </Stack>
      {busy ? <Spinner /> : <Box overflowX="auto"><Table size="sm"><Thead><Tr><Th>{t('Name')}</Th><Th>{t(moduleName === 'Properties' ? 'Price' : 'Phone')}</Th><Th>{t('Created Date')}</Th><Th>{t('Actions')}</Th></Tr></Thead>
        <Tbody>{items.map(item => <Tr key={item._id}><Td data-no-translate>{name(item)}</Td><Td data-no-translate>{moduleName === 'Properties' ? formatPrice(item) : item.phone || item.district}</Td><Td>{item.createdDate ? new Date(item.createdDate).toLocaleDateString(language) : ''}</Td><Td><Stack direction="row"><Button size="xs" onClick={() => open(item, true)}>{t('Details')}</Button>{permissions?.update && <Button size="xs" onClick={() => open(item, false)}>{t('Edit')}</Button>}{permissions?.delete && <Button size="xs" colorScheme="red" onClick={() => setDeleting(item)}>{t('Delete')}</Button>}</Stack></Td></Tr>)}</Tbody></Table>{!items.length && <Text p={6}>{t('No Data Found')}</Text>}</Box>}
      <Stack direction="row" justify="space-between"><Button disabled={page <= 1 || busy} onClick={() => setPage(page - 1)}>{t('Previous Page')}</Button><Text>{page} / {Math.max(1, Math.ceil(total / 20))} ({total})</Text><Button disabled={page * 20 >= total || busy} onClick={() => setPage(page + 1)}>{t('Next Page')}</Button></Stack>
    </Stack></Card>
    <Modal isOpen={record !== null} onClose={() => setRecord(null)} size="4xl" scrollBehavior="inside"><ModalOverlay /><ModalContent dir={direction}>
      <ModalHeader>{t(readOnly ? 'Details' : record?._id ? 'Edit' : 'Add')} — {t(moduleName)}</ModalHeader><ModalCloseButton aria-label={t('Close')} />
      <ModalBody>{error && <Alert status="error"><AlertIcon />{t(`estate.${error}`)}</Alert>}{form}
        {readOnly && <Stack mt={4}><Text>{t('Created Date')}: {record?.createdDate ? new Date(record.createdDate).toLocaleString(language) : ''}</Text><Text>{t('Updated Date')}: {record?.updatedDate ? new Date(record.updatedDate).toLocaleString(language) : ''}</Text>{record?.createBy && <Text>{t('estate.createdBy')}: <span data-no-translate>{typeof record.createBy === 'object' ? record.createBy.username || record.createBy._id : record.createBy}</span></Text>}</Stack>}
      </ModalBody><ModalFooter><Stack direction="row">{!readOnly && <Button variant="brand" isLoading={formik.isSubmitting} disabled={!definition} onClick={formik.handleSubmit}>{t('Save')}</Button>}<Button onClick={() => setRecord(null)}>{t('Close')}</Button></Stack></ModalFooter>
    </ModalContent></Modal>
    <Modal isOpen={Boolean(deleting)} onClose={() => setDeleting(null)}><ModalOverlay /><ModalContent dir={direction}><ModalHeader>{t('Delete')}</ModalHeader><ModalBody>{t('estate.confirmDelete')}</ModalBody><ModalFooter><Button colorScheme="red" onClick={remove}>{t('Delete')}</Button><Button ms={2} onClick={() => setDeleting(null)}>{t('Cancel')}</Button></ModalFooter></ModalContent></Modal>
  </Box>;
}
export const PropertiesPage = () => <EntityPage moduleName="Properties" />;
export const PartnerCustomersPage = () => <EntityPage moduleName="Partner Customers" />;
export const ResidencesPage = () => <EntityPage moduleName="Residences" />;
