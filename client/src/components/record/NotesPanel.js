import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertIcon, Box, Button, Heading, Link, Spinner, Text, Textarea } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiMessageSquare, FiSend } from 'react-icons/fi';
import { getApi, postApi } from 'services/api';
import { getStoredUser } from 'services/authSession';
import { useLanguage } from 'i18n';
import { formLabel } from 'utils/formValue';
import ProfileAvatar from 'components/profile/ProfileAvatar';
export default function NotesPanel({ moduleName, recordId }) {
  const { t, language } = useLanguage();
  const [notes, setNotes] = useState([]), [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true), [before, setBefore] = useState(null);
  const pending = useRef(null), list = useRef(null), active = useRef(true), actor = getStoredUser();
  const base = `api/record-workspace/${encodeURIComponent(moduleName)}/${recordId}/notes`;
  const merge = useCallback(items => setNotes(current => [...new Map([...current, ...items].map(note => [note._id, note])).values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a._id.localeCompare(b._id))), []);
  const load = useCallback(async (cursor, initial = false) => {
    const result = await getApi(base + (cursor ? '?before=' + cursor : ''));
    if (!active.current) return;
    if (result?.status === 200) { merge(result.data.items); if (cursor || initial) setBefore(result.data.before); setError(''); }
    else setError(result?.data?.code || 'serverError');
    setLoading(false);
  }, [base, merge]);
  useEffect(() => { active.current = true; setNotes([]); setLoading(true); setBefore(null); load(null, true); const timer = setInterval(() => load(), 15000); return () => { active.current = false; clearInterval(timer); }; }, [load]);
  const send = async event => {
    event.preventDefault(); if (!text.trim() || busy) return;
    const body = text.trim(); pending.current ||= crypto.randomUUID(); setBusy(true); setError('');
    try { const result = await postApi(base, { text: body, clientId: pending.current });
      if (result?.status === 201) { merge([result.data]); setText(''); pending.current = null; requestAnimationFrame(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }); }
      else setError(result?.data?.code || 'serverError');
    } finally { setBusy(false); }
  };
  const formatDate = value => new Date(value).toLocaleString(language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  return <section className="crm-notes-panel crm-detail-surface" aria-label={t('notes.title')}>
    <header className="crm-detail-section-heading"><div><FiMessageSquare /><Heading size="sm">{t('notes.title')}</Heading></div><Text fontSize="xs" color="var(--crm-muted)">{t('notes.hint')}</Text></header>
    {error && <Alert status="error"><AlertIcon />{t(`estate.${error}`)}</Alert>}
    <div ref={list} className="crm-note-list" role="log" aria-live="polite" aria-relevant="additions">
      {before && <Button size="sm" variant="ghost" onClick={() => load(before)}>{t('notes.older')}</Button>}
      {loading ? <Spinner size="sm" /> : !notes.length ? <Text className="crm-note-empty">{t('notes.empty')}</Text> : notes.map(note => {
        const mine = String(note.author?._id) === actor?._id;
        const name = formLabel(note.author) || note.authorName || t('notes.formerUser');
        return <article key={note._id} className={`crm-note${mine ? ' crm-note--mine' : ''}`}>
          <Link as={note.author?._id ? RouterLink : 'span'} to={note.author?._id ? `/profile/${note.author._id}` : undefined} aria-label={`${t('profile.view')} · ${name}`}><ProfileAvatar user={note.author} size="sm" /></Link>
          <Box minW={0} className="crm-note-body"><div className="crm-note-meta"><Link as={note.author?._id ? RouterLink : 'span'} to={note.author?._id ? `/profile/${note.author._id}` : undefined} data-no-translate>{name}</Link><time dateTime={note.createdAt} title={formatDate(note.createdAt)}>{formatDate(note.createdAt)}</time></div>
            <Text className="crm-note-text" data-no-translate>{note.text}</Text>{note.author?.jobTitle && <Text className="crm-note-role" data-no-translate>{note.author.jobTitle}</Text>}
          </Box>
        </article>;
      })}
    </div>
    <form className="crm-note-composer" onSubmit={send}><Textarea aria-label={t('notes.placeholder')} placeholder={t('notes.placeholder')} value={text} maxLength={10000} onChange={event => { pending.current = null; setText(event.target.value); }} isDisabled={busy} resize="vertical" minH="82px" /><div><Text fontSize="xs" color="var(--crm-muted)">{t('notes.identity')}</Text><Button type="submit" variant="brand" leftIcon={<FiSend />} isLoading={busy} isDisabled={!text.trim()}>{t('notes.send')}</Button></div></form>
  </section>;
}
