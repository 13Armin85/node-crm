import { useRef, useState } from 'react';
import { Button } from '@chakra-ui/react';
import { FiTrendingUp } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { HasAccess } from '../../redux/accessUtils';
import { useLanguage } from 'i18n';
import { postApi } from 'services/api';
export default function ContactToOpportunityButton({ contactId, compact = false }) {
  const { t } = useLanguage(), navigate = useNavigate();
  const [permission] = HasAccess(['Opportunities']);
  const [busy, setBusy] = useState(false), inFlight = useRef(false);
  if (!permission?.create || !contactId) return null;
  const send = async event => {
    event.stopPropagation(); if (inFlight.current) return; inFlight.current = true; setBusy(true);
    try { const result = await postApi('api/contact/to-opportunity/' + contactId, {});
      if (result?.status === 200) { toast.success(t('contactTransfer.success')); navigate('/opportunitiesView/' + result.data.opportunityId); }
      else toast.error(t(`estate.${result?.data?.code || 'serverError'}`));
    } finally { inFlight.current = false; setBusy(false); }
  };
  return <Button className="crm-contact-transfer" size={compact ? 'xs' : 'sm'} variant="outline" leftIcon={<FiTrendingUp />} onClick={send} isLoading={busy}>{t('contactTransfer.send')}</Button>;
}
