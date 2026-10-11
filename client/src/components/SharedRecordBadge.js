import { useEffect, useState } from 'react';
import { Text } from '@chakra-ui/react';
import { useLanguage } from 'i18n';
import { getApi } from 'services/api';
import { canSendRecord, RECORD_SHARING_CHANGED } from 'services/recordSharing';
import { userDisplayName } from 'services/taskSearch';

export default function SharedRecordBadge({ record, module }) {
  const { t } = useLanguage();
  const [shares, setShares] = useState([]);
  const canSend = canSendRecord(module);
  const recordId = record?._id;
  useEffect(() => {
    let active = true, changed = false;
    setShares([]);
    if (!canSend || !recordId) return undefined;
    const update = event => {
      if (event.detail?.module !== module || event.detail.recordId !== recordId) return;
      changed = true; setShares(event.detail.shares);
    };
    window.addEventListener(RECORD_SHARING_CHANGED, update);
    getApi(`api/record-sharing/${encodeURIComponent(module)}/${recordId}`).then(result => {
      if (active && !changed && result?.status === 200 && Array.isArray(result.data)) setShares(result.data);
    }).catch(() => {});
    return () => { active = false; window.removeEventListener(RECORD_SHARING_CHANGED, update); };
  }, [canSend, module, recordId]);
  const recipients = shares.map(share => userDisplayName(share.user)).filter(Boolean);
  return <>
    {record?._receivedFromAdmin && <Text className="crm-received-record-label" fontSize="10px" color="gray.500" mt="2px">{t('Received from admin')}</Text>}
    {canSend && recipients.length > 0 && <Text className="crm-sent-record-label" fontSize="xs" color="blue.600" mt="2px">{t('Sent to user')}: <span data-no-translate>{recipients.join('، ')}</span></Text>}
  </>;
}
