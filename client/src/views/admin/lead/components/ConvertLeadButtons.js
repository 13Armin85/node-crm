import { useRef, useState } from 'react';
import { HStack, IconButton, Tooltip } from '@chakra-ui/react';
import { FiUserCheck, FiTrendingUp } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { HasAccess } from '../../../../redux/accessUtils';
import { tr } from 'i18n/runtime';
import { postApi } from 'services/api';

export default function ConvertLeadButtons({ leadId, onConverted }) {
  const [leadAccess, contactAccess, opportunityAccess] = HasAccess(['Leads', 'Contacts', 'Opportunities']);
  const [busy, setBusy] = useState('');
  const inFlight = useRef(false);
  if (!leadAccess?.update || !leadAccess?.delete || !contactAccess?.create) return null;
  const convert = async mode => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(mode);
    try {
      const result = await postApi(`api/lead/convert/${leadId}`, { mode });
      if (result?.status === 200) {
        toast.success(tr('leadConversion.success'));
        onConverted?.(result.data);
      } else {
        const code = result?.data?.code || result?.response?.data?.code;
        toast.error(tr(code === 'duplicate' ? 'estate.duplicate' : code === 'conversionBusy' ? 'leadConversion.busy' : code === 'conversionModeMismatch' ? 'leadConversion.modeMismatch' : 'leadConversion.failed'));
      }
    } catch {
      toast.error(tr('leadConversion.failed'));
    } finally {
      inFlight.current = false;
      setBusy('');
    }
  };
  return <HStack spacing={1} display="inline-flex" onClick={event => event.stopPropagation()}>
    <Tooltip label={tr('leadConversion.contact')} hasArrow>
      <IconButton aria-label={tr('leadConversion.contact')} icon={<FiUserCheck />} size="sm" variant="ghost" colorScheme="teal"
        isLoading={busy === 'contact'} isDisabled={Boolean(busy)} onClick={() => convert('contact')} />
    </Tooltip>
    {opportunityAccess?.create && <Tooltip label={tr('leadConversion.both')} hasArrow>
      <IconButton aria-label={tr('leadConversion.both')} icon={<FiTrendingUp />} size="sm" variant="ghost" colorScheme="purple"
        isLoading={busy === 'contactAndOpportunity'} isDisabled={Boolean(busy)} onClick={() => convert('contactAndOpportunity')} />
    </Tooltip>}
  </HStack>;
}
