import React, { useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Button, Flex, FormControl, FormLabel, Heading, Select, SimpleGrid, Switch, Text } from '@chakra-ui/react';
import { getApi, putApi } from 'services/api';
import { useLanguage } from 'i18n';
import Spinner from 'components/spinner/Spinner';
import { defaultHidden } from 'services/moduleVisibility';
import { useNavigate } from 'react-router-dom';

import { visibilityCopy } from './dataVisibilityCopy';
const visible = (values, name) => values?.[name] ?? !defaultHidden.has(name);

export default function DataVisibility() {
  const { language, t } = useLanguage();
  const copy = visibilityCopy[language] || visibilityCopy.en;
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [modules, setModules] = useState([]);
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const current = users.find(user => user._id === selected);
  const dirty = modules.some(name => visible(draft, name) !== visible(current?.moduleVisibility, name));
  const load = async () => {
    setLoading(true); setError(false);
    const result = await getApi('api/visibility/');
    if (result?.status === 200 && Array.isArray(result.data.users)) {
      setUsers(result.data.users); setModules(result.data.modules); setSelected(''); setDraft({});
    } else setError(true);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const choose = id => {
    setSelected(id); setDraft(users.find(user => user._id === id)?.moduleVisibility || {}); setSaved(false); setError(false);
  };
  const save = async () => {
    const userId = selected;
    const changes = Object.fromEntries(modules.filter(name => visible(draft, name) !== visible(current?.moduleVisibility, name)).map(name => [name, visible(draft, name)]));
    setSaving(true); setError(false); setSaved(false);
    const result = await putApi('api/visibility/' + userId, { visibility: changes });
    if (result?.status === 200) {
      setUsers(previous => previous.map(user => user._id === userId ? { ...user, moduleVisibility: result.data.visibility } : user));
      setDraft(result.data.visibility); setSaved(true);
    } else setError(true);
    setSaving(false);
  };
  return <Box
    className="crm-data-visibility"
    dir={language === 'fa' ? 'rtl' : 'ltr'}
    textAlign={language === 'fa' ? 'right' : 'left'}
    sx={language === 'fa' ? {
      '.chakra-select__icon-wrapper': { left: '0.5rem', right: 'auto' },
      '.chakra-select': { paddingLeft: '2rem', paddingRight: '1rem' },
    } : undefined}
  >
    <Flex align="center" justify="space-between" gap={3} mb={4}><Heading size="lg">{copy.title}</Heading><Button variant="outline" onClick={() => navigate('/admin-setting')}>{copy.back}</Button></Flex>
    <Text mb={5}>{copy.hint}</Text>
    {error && <Alert status="error" mb={3}><AlertIcon />{copy.error}{!users.length && <Button ms={3} onClick={load}>{t('Retry')}</Button>}</Alert>}
    {saved && <Alert status="success" mb={3}><AlertIcon />{copy.saved}</Alert>}
    {loading ? <Spinner /> : <>
      {!users.length ? <Text>{copy.empty}</Text> : <FormControl maxW="420px" mb={5}>
        <FormLabel htmlFor="visibility-user" textAlign="inherit">{copy.user}</FormLabel>
        <Select id="visibility-user" value={selected} isDisabled={saving || dirty} onChange={event => choose(event.target.value)}>
          <option value="">{copy.choose}</option>{users.map(user => <option key={user._id} value={user._id}>{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.username}</option>)}
        </Select>
      </FormControl>}
      {current && <>
        <Flex gap={3} wrap="wrap" mb={4}>
          <Button onClick={() => { setDraft(Object.fromEntries(modules.map(name => [name, true]))); setSaved(false); }} isDisabled={saving}>{copy.all}</Button>
          <Button colorScheme="blue" onClick={save} isLoading={saving} isDisabled={!dirty}>{copy.save}</Button>
          {dirty && <Button variant="ghost" isDisabled={saving} onClick={() => choose(selected)}>{copy.cancel}</Button>}
        </Flex>
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={3}>
          {modules.map((name, index) => <FormControl key={name} display="flex" alignItems="center" justifyContent="space-between" borderWidth="1px" borderRadius="12px" p={4}>
            <Box><FormLabel htmlFor={'visibility-' + index} textAlign="inherit" mb={1}>{t(name)}</FormLabel><Text fontSize="sm" color="gray.500">{visible(draft, name) ? copy.visible : copy.hidden}</Text></Box>
            <Switch id={'visibility-' + index} aria-label={t(name)} isChecked={visible(draft, name)} isDisabled={saving} onChange={event => { setDraft(previous => ({ ...previous, [name]: event.target.checked })); setSaved(false); }} />
          </FormControl>)}
        </SimpleGrid>
      </>}
    </>}
  </Box>;
}
