import React, { useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Button, Checkbox, FormControl, FormLabel, Heading, Input, Select, Spinner, Stack, Text } from '@chakra-ui/react';
import Card from 'components/card/Card';
import { getApi, putApi } from 'services/api';
import { useLanguage } from 'i18n';
import { localized } from 'components/dynamicForm/DynamicFormRenderer';

const types = ['text', 'textarea', 'number', 'currency', 'select', 'multiselect', 'checkbox', 'radio', 'date', 'datetime', 'email', 'phone', 'file', 'url'];
const languages = ['en', 'fa', 'tr'];
const emptyLocalized = () => ({ en: '', fa: '', tr: '' });
export default function FormBuilder() {
  const { t, language, direction } = useLanguage();
  const [modules, setModules] = useState([]); const [moduleName, setModuleName] = useState('Properties');
  const [definition, setDefinition] = useState(null); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [success, setSuccess] = useState(false);
  const [selected, setSelected] = useState(0);
  const [savedNames, setSavedNames] = useState([]);
  const admin = JSON.parse(localStorage.getItem('user') || '{}').role === 'superAdmin';
  useEffect(() => { getApi('api/estate/definitions').then(r => { if (r.status === 200) setModules(r.data); else setError('serverError'); }); }, []);
  useEffect(() => {
    let active = true; setDefinition(null); setError(''); setSuccess(false);
    getApi(`api/estate/definitions/${encodeURIComponent(moduleName)}`).then(r => { if (active) { if (r.status === 200) { setDefinition(r.data); setSavedNames(r.data.fields.map(f => f.name)); setSelected(0); } else setError(r.data?.code || 'serverError'); } });
    return () => { active = false; };
  }, [moduleName]);
  if (!admin) return <Alert status="error" mt="100px">{t('estate.forbidden')}</Alert>;
  const field = definition?.fields[selected];
  const update = patch => setDefinition({ ...definition, fields: definition.fields.map((f, i) => i === selected ? { ...f, ...patch } : f) });
  const add = () => {
    const next = { name: `field_${Date.now()}`, kind: 'CUSTOM_FIELD', type: 'text', label: emptyLocalized(), enabled: true, required: false, options: [], order: definition.fields.length };
    setDefinition({ ...definition, fields: [...definition.fields, next] }); setSelected(definition.fields.length); setSuccess(false);
  };
  const move = delta => {
    const fields = [...definition.fields]; const target = selected + delta;
    if (target < 0 || target >= fields.length) return;
    [fields[selected], fields[target]] = [fields[target], fields[selected]];
    setDefinition({ ...definition, fields: fields.map((f, order) => ({ ...f, order })) }); setSelected(target);
  };
  const save = async () => {
    setBusy(true); setError(''); setSuccess(false);
    const result = await putApi(`api/estate/definitions/${encodeURIComponent(moduleName)}`, definition);
    if (result.status === 200) { setDefinition(result.data); setSavedNames(result.data.fields.map(f => f.name)); setSuccess(true); } else setError(result.data?.code || 'serverError');
    setBusy(false);
  };
  const localizedEditor = key => <Box key={key}><Text fontWeight="bold">{t(`estate.${key}`)}</Text><Stack direction={{ base: 'column', md: 'row' }}>{languages.map(lang => <FormControl key={lang}><FormLabel>{t(`estate.language.${lang}`)}</FormLabel><Input dir={lang === 'fa' ? 'rtl' : 'ltr'} value={field[key]?.[lang] || ''} onChange={e => update({ [key]: { ...emptyLocalized(), ...field[key], [lang]: e.target.value } })} /></FormControl>)}</Stack></Box>;
  return <Box pt="100px" dir={direction}><Card><Stack spacing={5}>
    <Heading size="md">{t('estate.formBuilder')}</Heading>
    <Select aria-label={t('Module')} value={moduleName} onChange={e => setModuleName(e.target.value)}>{modules.map(name => <option key={name} value={name}>{t(name)}</option>)}</Select>
    {error && <Alert status="error"><AlertIcon />{t(`estate.${error}`)}</Alert>}{success && <Alert status="success"><AlertIcon />{t('Success')}</Alert>}
    {!definition ? <Spinner /> : <>
      <Stack direction={{ base: 'column', lg: 'row' }} spacing={6} align="start">
        <Stack minW="220px" maxH="600px" overflowY="auto"><Button onClick={add}>{t('estate.addField')}</Button>{definition.fields.map((f, index) => <Button key={f.name} variant={selected === index ? 'solid' : 'ghost'} onClick={() => setSelected(index)} justifyContent="start">{localized(f.label, language) || t('estate.newField')}</Button>)}</Stack>
        {field && <Stack flex="1" spacing={4} width="100%">
          <Stack direction="row" flexWrap="wrap"><Button disabled={selected === 0} onClick={() => move(-1)}>{t('estate.moveUp')}</Button><Button disabled={selected === definition.fields.length - 1} onClick={() => move(1)}>{t('estate.moveDown')}</Button>
            {field.kind === 'CUSTOM_FIELD' && <Button colorScheme="red" onClick={() => { setDefinition({ ...definition, fields: definition.fields.filter((_, i) => i !== selected) }); setSelected(Math.max(0, selected - 1)); }}>{t('Delete')}</Button>}</Stack>
          <Text>{t(field.kind === 'SYSTEM_FIELD' ? 'estate.systemField' : 'estate.customField')}</Text>
          <FormControl><FormLabel>{t('Type')}</FormLabel><Select value={field.type} disabled={field.kind === 'SYSTEM_FIELD' || savedNames.includes(field.name)} onChange={e => update({ type: e.target.value, defaultValue: undefined })}>{types.map(type => <option key={type} value={type}>{t(`estate.type.${type}`)}</option>)}</Select></FormControl>
          <Stack direction="row"><Checkbox isChecked={field.enabled !== false} disabled={field.locked} onChange={e => update({ enabled: e.target.checked })}>{t('estate.enabled')}</Checkbox><Checkbox isChecked={Boolean(field.required)} disabled={field.locked} onChange={e => update({ required: e.target.checked })}>{t('estate.required')}</Checkbox></Stack>
          {['label', 'placeholder', 'helpText', 'validationMessage'].map(localizedEditor)}
          <FormControl><FormLabel>{t('estate.defaultValue')}</FormLabel>
            {field.type === 'checkbox' ? <Checkbox isChecked={Boolean(field.defaultValue)} onChange={e => update({ defaultValue: e.target.checked })}>{t('estate.defaultValue')}</Checkbox>
              : ['multiselect', 'file'].includes(field.type) ? <Text>{t('estate.defaultEmpty')}</Text>
              : <Input value={field.defaultValue ?? ''} type={['number', 'currency'].includes(field.type) ? 'number' : 'text'} onChange={e => update({ defaultValue: e.target.value === '' ? undefined : ['number', 'currency'].includes(field.type) ? Number(e.target.value) : e.target.value })} />}
          </FormControl>
          {['number', 'currency'].includes(field.type) && field.kind === 'CUSTOM_FIELD' && <Stack direction="row">{['min', 'max'].map(key => <FormControl key={key}><FormLabel>{t(`estate.${key}`)}</FormLabel><Input type="number" value={field[key] ?? ''} onChange={e => update({ [key]: e.target.value === '' ? undefined : Number(e.target.value) })} /></FormControl>)}</Stack>}
          {['select', 'radio', 'multiselect'].includes(field.type) && !field.relation && <Stack><Heading size="sm">{t('estate.options')}</Heading>
            {(field.options || []).map((option, i) => <Box borderWidth="1px" borderRadius="md" p={3} key={i}><Stack>
              <FormControl><FormLabel>{t('estate.optionValue')}</FormLabel><Input value={option.value} disabled={field.kind === 'SYSTEM_FIELD'} onChange={e => update({ options: field.options.map((o, index) => index === i ? { ...o, value: e.target.value } : o) })} /></FormControl>
              {languages.map(lang => <FormControl key={lang}><FormLabel>{t(`estate.language.${lang}`)}</FormLabel><Input value={option.label?.[lang] || ''} onChange={e => update({ options: field.options.map((o, index) => index === i ? { ...o, label: { ...o.label, [lang]: e.target.value } } : o) })} /></FormControl>)}
              {field.kind === 'CUSTOM_FIELD' && <Button onClick={() => update({ options: field.options.filter((_, index) => index !== i) })}>{t('Delete')}</Button>}
            </Stack></Box>)}
            {field.kind === 'CUSTOM_FIELD' && <Button onClick={() => update({ options: [...(field.options || []), { value: '', label: emptyLocalized() }] })}>{t('estate.addOption')}</Button>}
          </Stack>}
        </Stack>}
      </Stack><Button variant="brand" alignSelf="end" isLoading={busy} onClick={save}>{t('Save')}</Button>
    </>}
  </Stack></Card></Box>;
}
