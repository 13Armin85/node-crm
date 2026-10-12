import { Alert, AlertIcon, Box, Checkbox, Flex, FormLabel, Grid, GridItem, Input, Select, Spinner, Stack, Tag, TagCloseButton, TagLabel, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { getApi } from "services/api";
import { useLanguage } from 'i18n';
import { formLabel, formValue } from 'utils/formValue';
import { formatPriceInput } from 'utils/price';
import { getIn } from 'formik';
import { useRequiredFields } from 'utils/managedForm';
import { isLeadRelationVisible, normalizeLeadRelations, LEAD_SELECTION_MESSAGE } from 'utils/leadRelations';
import { localized } from 'components/dynamicForm/DynamicFormRenderer';

export const labelOf = (item, type) => {
  if (type === "contact") return formLabel(item.fullName) || formLabel(item) || item.email;
  if (type === "lead") return formLabel(item.leadName) || item.leadEmail;
  if (type === "property") return formLabel(item.title) || formLabel(item.name) || item.propertyAddress;
  return formLabel(item.companyName) || formLabel(item.fullName) || formLabel(item.name) || item.email;
};

const RelationSelect = ({ label, name, value, items, type, setFieldValue, error, required }) => {
  const { t } = useLanguage();
  const selected = formValue(value);
  return (
  <GridItem colSpan={{ base: 12, md: 6 }}>
    <FormLabel htmlFor={`relation-${name}`} fontSize="sm" fontWeight="600">{label}{required && <Box as="span" ms={1} color="red.500">*</Box>}</FormLabel>
    <Select
      id={`relation-${name}`}
      name={name}
      value={selected}
      placeholder={t('Select')}
      onChange={(event) => setFieldValue(name, event.target.value || null)}
    >
      {selected && !items.some(item => item._id === selected) && <option value={selected}>{labelOf(value, type) || selected}</option>}
      {items.map((item) => <option value={item._id} key={item._id}>{labelOf(item, type)}</option>)}
    </Select>
    {error && <Text role="alert" fontSize="sm" color="red.500" mt={1}>{error}</Text>}
  </GridItem>
);
};

export function PropertyMultiSelect({ value = [], items, setFieldValue, busy, error }) {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState('');
  const selected = Array.isArray(value) ? [...new Set(value.map(formValue).filter(Boolean))] : [];
  const remove = id => setFieldValue('properties', selected.filter(item => item !== id));
  const normalize = text => String(text || '').toLocaleLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();
  const filtered = [...items].sort((a, b) => String(labelOf(a, 'property') || '').localeCompare(String(labelOf(b, 'property') || ''), language, { numeric: true }))
    .filter(item => normalize([labelOf(item, 'property'), item.propertyAddress, item.district, item.neighborhood, item._id].filter(Boolean).join(' ')).includes(normalize(query)));
  return <GridItem colSpan={12}>
    <FormLabel htmlFor="related-property-search" fontSize="sm" fontWeight="600">{t('Related Properties')}</FormLabel>
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden">
      <Box p={3} borderBottomWidth="1px">
        <Input id="related-property-search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search...')} />
        {!!selected.length && <Flex flexWrap="wrap" gap={2} mt={3}>
          {selected.map(id => {
            const item = items.find(property => property._id === id) || value.find(property => formValue(property) === id);
            const label = (item && labelOf(item, 'property')) || id;
            return <Tag key={id} colorScheme="blue" maxW="100%"><TagLabel data-no-translate>{label}</TagLabel><TagCloseButton aria-label={`${t('Delete')} ${label}`} onClick={() => remove(id)} /></Tag>;
          })}
        </Flex>}
      </Box>
      <Stack spacing={0} maxH="280px" overflowY="auto">
        {busy ? <Flex p={5} justify="center"><Spinner /></Flex> : filtered.length ? filtered.map(item => <Checkbox
          key={item._id} p={3} borderBottomWidth="1px" w="100%" colorScheme="blue"
          isChecked={selected.includes(item._id)}
          onChange={event => event.target.checked ? setFieldValue('properties', [...selected, item._id]) : remove(item._id)}
        >
          <Text fontSize="sm" fontWeight="600" data-no-translate>{labelOf(item, 'property')}</Text>
          <Text fontSize="xs" color="gray.500" data-no-translate>{[item.district, item.neighborhood, item.propertyAddress].filter(Boolean).join(' · ')}</Text>
          {item.price?.amount != null && <Text fontSize="xs" dir="ltr" data-no-translate>{formatPriceInput(item.price.amount)} {item.price.currency}</Text>}
        </Checkbox>) : <Text p={4} fontSize="sm" color="gray.500">{t('No Data Found')}</Text>}
      </Stack>
    </Box>
    {error && <Text role="alert" fontSize="sm" color="red.500" mt={1}>{error}</Text>}
  </GridItem>;
}

export default function RelationFields({ values, setFieldValue, contact, lead, partner, properties, definition, formik, excludeLeadId }) {
  const { t, language } = useLanguage();
  const exclusive = definition?.moduleName === 'Leads';
  const relationVisible = name => !exclusive || isLeadRelationVisible(name, values);
  const changeRelation = (name, value) => {
    if (!exclusive) return setFieldValue(name, value);
    const next = { ...values, [name]: value };
    if (value) for (const key of ['lead', 'contact', 'partnerCustomer']) {
      if (key !== name) next[key] = null;
    }
    const normalized = normalizeLeadRelations(next);
    if (formik?.setValues) return formik.setValues(normalized);
    for (const key of ['lead', 'contact', 'partnerCustomer']) setFieldValue(key, normalized[key], false);
  };
  const relationNames = [contact && 'contact', lead && 'lead', partner && 'partnerCustomer', properties && 'properties'].filter(Boolean);
  useRequiredFields((definition?.fields || []).filter(field => relationNames.includes(field.name) && relationVisible(field.name)), formik);
  const errorFor = name => {
    const error = getIn(formik?.errors, name);
    if (!error || !(formik?.submitCount > 0 || getIn(formik?.touched, name))) return undefined;
    return localized(definition?.fields.find(field => field.name === name)?.validationMessage, language)
      || (['required', 'invalid', 'relationNotFound'].includes(error) ? t(`estate.${error}`) : error);
  };
  const required = name => Boolean(definition?.fields.find(field => field.name === name)?.required);
  const enabled = name => {
    const field = definition?.fields.find(item => item.name === name);
    return relationVisible(name) && field?.enabled !== false && Object.entries(field?.condition || {}).every(([key, value]) => (Array.isArray(value) ? value.includes(getIn(values, key)) : getIn(values, key) === value));
  };
  const label = (name, fallback) => localized(definition?.fields.find(item => item.name === name)?.label, language) || t(fallback);
  const [options, setOptions] = useState({ contacts: [], leads: [], partners: [], properties: [] });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setBusy(true);
      const requests = await Promise.all([
        contact ? getApi("api/contact") : null,
        lead ? getApi("api/lead") : null,
        partner ? getApi("api/estate/Partner%20Customers?limit=100") : null,
        properties ? getApi("api/property") : null,
      ]);
      if (!active) return;
      setFailed(requests.some(result => result && result.status !== 200));
      setOptions({
        contacts: Array.isArray(requests[0]?.data) ? requests[0].data : [],
        leads: Array.isArray(requests[1]?.data) ? requests[1].data : [],
        partners: requests[2]?.data?.items || [],
        properties: Array.isArray(requests[3]?.data) ? requests[3].data : [],
      });
      setBusy(false);
    };
    load();
    return () => { active = false; };
  }, [contact, lead, partner, properties]);

  return (
    <Grid templateColumns="repeat(12, 1fr)" gap={3} mt={3}>
      {failed && <GridItem colSpan={12}><Alert status="error"><AlertIcon />{t('estate.serverError')}</Alert></GridItem>}
      {contact && enabled('contact') && <RelationSelect label={label('contact', 'Related Contact')} name="contact" error={errorFor("contact")} required={required("contact")} value={values.contact} items={options.contacts} type="contact" setFieldValue={changeRelation} />}
      {lead && enabled('lead') && <RelationSelect label={label('lead', definition?.moduleName === 'Leads' ? 'Related Lead' : 'Lead')} name="lead" error={errorFor("lead")} required={required("lead")} value={values.lead} items={options.leads.filter(item => item._id !== excludeLeadId)} type="lead" setFieldValue={changeRelation} />}
      {partner && enabled('partnerCustomer') && <RelationSelect label={label('partnerCustomer', 'Partner Customer')} name="partnerCustomer" error={errorFor("partnerCustomer")} required={required("partnerCustomer")} value={values.partnerCustomer} items={options.partners} type="partner" setFieldValue={changeRelation} />}
      {exclusive && formik?.errors?.leadRelations && formik?.submitCount > 0 && <GridItem colSpan={12}>
        <Text role="alert" data-testid="lead-selection-error" fontSize="sm" color="red.500">{t(LEAD_SELECTION_MESSAGE)}</Text>
      </GridItem>}
      {properties && enabled('properties') && <PropertyMultiSelect error={errorFor("properties")} value={values.properties || []} items={options.properties} setFieldValue={setFieldValue} busy={busy} />}
    </Grid>
  );
}
