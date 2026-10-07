import React, { useEffect, useState } from 'react';
import { Button, Flex, FormControl, FormLabel, Select, Text } from '@chakra-ui/react';
import { useLanguage } from 'i18n';
import { getApi } from 'services/api';
import { getDataUser, setDataUser } from 'services/adminDataScope';

const labels = {
  en: { title: 'View data', all: 'All users', hint: 'View everyone’s records or select a person across all pages.', error: 'Failed to load users', retry: 'Retry' },
  fa: { title: 'نمایش اطلاعات', all: 'همه کاربران', hint: 'اطلاعات همه را ببینید یا یک فرد را برای تمام صفحات انتخاب کنید.', error: 'دریافت کاربران ناموفق بود', retry: 'تلاش دوباره' },
  tr: { title: 'Verileri göster', all: 'Tüm kullanıcılar', hint: 'Tüm sayfalarda herkesin kayıtlarını görüntüleyin veya bir kişi seçin.', error: 'Kullanıcılar yüklenemedi', retry: 'Tekrar dene' },
};
export default function AdminDataFilter() {
  const { language } = useLanguage();
  const copy = labels[language] || labels.en;
  const [selected] = useState(() => getDataUser());
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const change = async value => {
    setDataUser(value);
    // Purge persisted record caches before reloading; old responses cannot enter the new view.
    const { persistor } = await import('../../redux/store');
    persistor.pause();
    await persistor.flush();
    await persistor.purge();
    window.location.reload();
  };
  const load = async () => {
    setLoading(true); setError(false);
    const response = await getApi('api/user/', undefined, { dataScope: false });
    if (response?.status === 200 && Array.isArray(response.data?.user)) {
      setUsers(response.data.user);
      if (selected && !response.data.user.some(user => user._id === selected)) await change('');
    } else setError(true);
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // The directory is independent of the data selector.
  return (
    <Flex className="crm-admin-data-filter" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3} mb={3} p={3} border="1px solid" borderColor="gray.200" borderRadius="12px">
      <FormControl width={{ base: '100%', md: '320px' }}>
        <FormLabel htmlFor="crm-data-user" fontSize="sm" mb={1}>{copy.title}</FormLabel>
        <Select id="crm-data-user" aria-label={copy.title} value={selected} isDisabled={loading} onChange={event => change(event.target.value)} size="sm">
          <option value="">{copy.all}</option>
          {users.map(user => <option key={user._id} value={user._id}>{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.username}</option>)}
        </Select>
      </FormControl>
      <Text fontSize="sm" color="gray.500">{error ? copy.error : copy.hint}</Text>
      {error && <Button size="sm" onClick={load}>{copy.retry}</Button>}
    </Flex>
  );
}
