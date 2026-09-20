import React, { useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Button, Checkbox, FormControl, FormErrorMessage, FormHelperText, FormLabel, Grid, Input, Radio, RadioGroup, Select, Stack, Text, Textarea } from '@chakra-ui/react';
import { getIn } from 'formik';
import { useLanguage, translate } from 'i18n';
import { getApi, postApi } from 'services/api';
import axios from 'axios';
import { constant } from 'constant';
import CalendarDateInput from 'components/date/CalendarDateInput';
import CurrencyAmount from 'components/CurrencyAmount';

export const fieldPath = field => field.kind === 'CUSTOM_FIELD' ? `customFields.${field.name}` : field.name;
export const isVisible = (field, values) => field.enabled !== false && Object.entries(field.condition || {}).every(([key, expected]) => getIn(values, key) === expected);
export const localized = (value, language) => translate(typeof value === 'object' && value !== null ? value[language] || value.en || '' : value || '', language);
export async function downloadFile(file) {
  const response = await axios.get(`${constant.baseUrl}api/estate/files/${file.id || file._id}`, { headers: { Authorization: localStorage.getItem('token') || sessionStorage.getItem('token') }, responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); URL.revokeObjectURL(url);
}
export function FileInput({ value = [], onChange, disabled }) {
  const { t, language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const upload = async event => {
    const files = Array.from(event.target.files || []); if (!files.length) return;
    const data = new FormData(); files.forEach(file => data.append('files', file));
    setBusy(true); setError('');
    const response = await postApi('api/estate/files', data);
    if (response.status === 201) onChange([...value, ...response.data]); else setError(t('estate.invalidFile'));
    setBusy(false); event.target.value = '';
  };
  return <Stack>{error && <Alert status="error"><AlertIcon />{error}</Alert>}
    {!disabled && <Input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.txt" onChange={upload} disabled={busy} aria-label={t('Upload Files')} />}
    {busy && <Text>{t('estate.loading')}</Text>}
    {value.map((file, index) => <Stack direction="row" key={file.id || file._id || index} align="center" flexWrap="wrap">
      <Button variant="link" onClick={() => downloadFile(file).catch(() => setError(t('estate.serverError')))}><span data-no-translate>{file.name}</span></Button>
      <Text fontSize="sm">{file.uploadedAt ? new Date(file.uploadedAt).toLocaleString(language) : t('estate.unknownDate')}</Text>
      {!disabled && <Button size="xs" onClick={() => onChange(value.filter((_, i) => i !== index))}>{t('Delete')}</Button>}
    </Stack>)}
  </Stack>;
}
export function AsyncRelationSelect({ moduleName, value, onChange, id, disabled }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    if (!value) { setSelected(null); return undefined; }
    getApi(`api/estate/${encodeURIComponent(moduleName)}/options?id=${encodeURIComponent(value)}`).then(result => {
      if (active && result.status === 200) setSelected(result.data[0] || null);
    });
    return () => { active = false; };
  }, [moduleName, value]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setBusy(true); setError(false);
      const result = await getApi(`api/estate/${encodeURIComponent(moduleName)}/options?q=${encodeURIComponent(query)}`);
      if (active) { setOptions(result.status === 200 ? result.data : []); setError(result.status !== 200); setBusy(false); }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [moduleName, query]);
  const all = selected && !options.some(o => o.value === selected.value) ? [selected, ...options] : options;
  return <Stack spacing={1}>
    {!disabled && <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('Search...')} aria-label={t('Search...')} />}
    <Select id={id} value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled}>
      <option value="">{t(busy ? 'estate.loading' : 'Select')}</option>
      {all.map(option => <option key={option.value} value={option.value} data-no-translate>{option.label}</option>)}
    </Select>
    {error && <Text color="red.500">{t('estate.serverError')}</Text>}
    {!busy && !error && !all.length && <Text fontSize="sm">{t('No Data Found')}</Text>}
  </Stack>;
}
export default function DynamicFormRenderer({ definition, formik, readOnly = false, customOnly = false }) {
  const { language, t } = useLanguage();
  if (!definition) return null;
  const change = (field, value) => {
    formik.setFieldValue(fieldPath(field), value);
    const resets = {
      category: { subtype: '', bedroom: null }, isInsideResidence: { residence: null },
      'sale.status': { 'sale.buyerType': null, 'sale.lead': null, 'sale.partnerCustomer': null, 'sale.soldAt': null },
      'sale.buyerType': { 'sale.lead': null, 'sale.partnerCustomer': null },
      customerType: { companyName: '', contactPerson: '', taxNumber: '' },
    };
    Object.entries(resets[field.name] || {}).forEach(([key, v]) => formik.setFieldValue(key, v));
  };
  return <Grid className="crm-dynamic-form" templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={5} dir="ltr">
    {[...definition.fields].sort((a, b) => a.order - b.order).filter(field => (!customOnly || field.kind === 'CUSTOM_FIELD') && !field.external && isVisible(field, formik.values)).map(field => {
      const path = fieldPath(field); const value = getIn(formik.values, path); const error = getIn(formik.errors, path);
      const label = localized(field.label, language); const id = `field-${path}`;
      let options = field.options || [];
      if (field.name === 'subtype') options = options.filter(o => (formik.values.category === 'COMMERCIAL' ? ['SHOP', 'OFFICE'] : ['APARTMENT', 'RESIDENCE', 'VILLA']).includes(o.value));
      const common = { id, name: path, value: value ?? '', onBlur: formik.handleBlur, onChange: e => change(field, e.target.value), placeholder: localized(field.placeholder, language), isReadOnly: readOnly };
      let control;
      if (field.relation) control = <AsyncRelationSelect id={id} moduleName={field.relation} value={value} onChange={v => change(field, v)} disabled={readOnly} />;
      else if (field.type === 'file') control = <FileInput value={value || []} onChange={v => change(field, v)} disabled={readOnly} />;
      else if (field.type === 'currency' && readOnly) control = <CurrencyAmount amount={value} currency={getIn(formik.values, field.name === 'price.amount' ? 'price.currency' : 'currency') || 'TRY'} />;
      else if (field.type === 'textarea') control = <Textarea {...common} />;
      else if (field.type === 'checkbox') control = <Checkbox id={id} isChecked={Boolean(value)} isDisabled={readOnly} onChange={e => change(field, e.target.checked)}>{label}</Checkbox>;
      else if (field.type === 'radio') control = <RadioGroup id={id} value={value || ''} onChange={v => change(field, v)}><Stack direction="row" flexWrap="wrap">{options.map(o => <Radio isDisabled={readOnly} key={o.value} value={o.value}>{localized(o.label, language)}</Radio>)}</Stack></RadioGroup>;
      else if (field.type === 'multiselect') control = <Stack>{options.map(o => <Checkbox key={o.value} isDisabled={readOnly} isChecked={(value || []).includes(o.value)} onChange={e => change(field, e.target.checked ? [...(value || []), o.value] : value.filter(v => v !== o.value))}>{localized(o.label, language)}</Checkbox>)}</Stack>;
      else if (field.type === 'select') control = <Select {...common} isDisabled={readOnly}><option value="">{t('Select')}</option>{options.map(o => <option key={o.value} value={o.value}>{localized(o.label, language)}</option>)}</Select>;
      else if (['date', 'datetime'].includes(field.type)) control = <CalendarDateInput
        {...common}
        type={field.type === 'datetime' ? 'datetime-local' : 'date'}
        isDisabled={readOnly}
        min={field.min}
        max={field.max}
        value={value ? String(value).slice(0, field.type === 'date' ? 10 : 16) : ''}
        onChange={e => change(field, e.target.value)}
      />;
      else {
        const type = ({ currency: 'number', phone: 'tel', datetime: 'datetime-local' })[field.type] || field.type;
        control = <Input {...common} type={type} min={field.min} max={field.max} step={type === 'number' ? 'any' : undefined}
          value={value ?? ''}
          onChange={e => change(field, type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />;
      }
      return <FormControl className="crm-dynamic-field" key={path} isRequired={field.required} isInvalid={Boolean(error)} data-read-only={readOnly ? "true" : "false"}>
        {field.type !== 'checkbox' && <FormLabel htmlFor={id}>{label}</FormLabel>}
        <Box>{control}</Box>
        {field.helpText && <FormHelperText>{localized(field.helpText, language)}</FormHelperText>}
        <FormErrorMessage>{error ? localized(field.validationMessage, language) || t(`estate.${error}`) : ''}</FormErrorMessage>
      </FormControl>;
    })}
  </Grid>;
}
