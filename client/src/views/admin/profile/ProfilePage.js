import React, { useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Button, FormControl, FormLabel, Heading, Input, Link, SimpleGrid, Spinner, Text, Textarea } from '@chakra-ui/react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useFormik } from 'formik';
import { getApi, postApi, putApi } from 'services/api';
import { getStoredUser, updateSessionUser } from 'services/authSession';
import { setUser } from '../../../redux/slices/localSlice';
import { useLanguage } from 'i18n';
import ProfileAvatar from 'components/profile/ProfileAvatar';
import { formLabel } from 'utils/formValue';
import { safeUrl } from 'services/contentSecurity';
export default function ProfilePage() {
  const { id } = useParams(), navigate = useNavigate(), dispatch = useDispatch();
  const { t } = useLanguage();
  const own = !id || id === getStoredUser()?._id;
  const [user, setProfile] = useState(null), [error, setError] = useState(''), [success, setSuccess] = useState(false), [uploading, setUploading] = useState(false);
  const persist = value => { setProfile(current => ({ ...current, ...value })); if (own) dispatch(setUser(updateSessionUser(value))); };
  useEffect(() => { let active = true; setProfile(null); getApi('api/profile/' + (own ? 'me' : id)).then(result => { if (!active) return; if (result?.status === 200) setProfile(result.data); else setError(result?.data?.code || 'serverError'); }); return () => { active = false; }; }, [id, own]);
  const fields = ['firstName', 'lastName', 'phoneNumber', 'jobTitle', 'department', 'website', 'bio'];
  const labels = { firstName: 'First Name', lastName: 'Last Name', phoneNumber: 'Phone Number', jobTitle: 'profile.jobTitle', department: 'profile.department', website: 'Website', bio: 'profile.bio' };
  const formik = useFormik({ initialValues: Object.fromEntries(fields.map(name => [name, user?.[name] ?? ''])), enableReinitialize: true,
    async onSubmit(values) { setError(''); setSuccess(false); const result = await putApi('api/profile/me', values); if (result?.status === 200) { persist(result.data); setSuccess(true); } else setError(result?.data?.code || 'serverError'); },
  });
  const upload = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('invalidFile'); return; }
    setUploading(true); setError(''); const body = new FormData(); body.append('avatar', file);
    try { const result = await postApi('api/profile/me/avatar', body); if (result?.status === 200) persist(result.data); else setError(result?.data?.code || 'invalidFile'); }
    finally { setUploading(false); event.target.value = ''; }
  };
  return <Box className="crm-profile-page">
    <header className="crm-detail-heading"><div><Text className="crm-detail-eyebrow">{t('profile.title')}</Text><Heading size="md">{user ? formLabel(user) : t('profile.title')}</Heading></div><Button variant="outline" onClick={() => navigate(-1)}>{t('Back')}</Button></header>
    {error && <Alert status="error"><AlertIcon />{t(`estate.${error}`)}</Alert>}{success && <Alert status="success"><AlertIcon />{t('Saved successfully')}</Alert>}
    {!user ? <Spinner /> : <Box className="crm-profile-layout">
      <aside className="crm-detail-surface crm-profile-summary"><ProfileAvatar user={user} size="2xl" /><Heading size="sm" mt={4} data-no-translate>{formLabel(user)}</Heading><Text data-no-translate>{user.jobTitle}</Text><Text color="var(--crm-muted)" data-no-translate>{user.department}</Text>
        {own && <><FormLabel className="crm-avatar-upload" htmlFor="profile-photo">{uploading ? t('estate.loading') : t('profile.changePhoto')}</FormLabel><Input id="profile-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} isDisabled={uploading} hidden /><Text fontSize="xs" color="var(--crm-muted)">{t('profile.photoHint')}</Text></>}
      </aside>
      <Box className="crm-detail-surface" as={own ? 'form' : 'section'} onSubmit={own ? formik.handleSubmit : undefined}>
        <Heading size="sm" mb={5}>{t('profile.information')}</Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>{fields.filter(name => own || !['phoneNumber'].includes(name)).map(name => <FormControl key={name} gridColumn={name === 'bio' ? '1 / -1' : undefined}>
          <FormLabel htmlFor={`profile-${name}`}>{t(labels[name])}</FormLabel>
          {own ? (name === 'bio' ? <Textarea id={`profile-${name}`} name={name} value={formik.values[name]} onChange={formik.handleChange} maxLength={2000} /> : <Input id={`profile-${name}`} name={name} value={formik.values[name]} onChange={formik.handleChange} maxLength={name === 'website' ? 500 : 120} />)
            : name === 'website' && user.website ? <Link href={safeUrl(user.website)} isExternal data-no-translate>{user.website}</Link> : <Text whiteSpace="pre-wrap" data-no-translate>{user[name] || '—'}</Text>}
        </FormControl>)}</SimpleGrid>{own && <Button type="submit" variant="brand" mt={5} isLoading={formik.isSubmitting}>{t('Save')}</Button>}
      </Box>
    </Box>}
  </Box>;
}
