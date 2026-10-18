import { Button, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerOverlay, IconButton, Spinner, Text } from '@chakra-ui/react';
import { CloseIcon } from '@chakra-ui/icons';
import { useEffect, useState } from 'react';
import { tr, withLocalization } from 'i18n/runtime';
import { getApi } from 'services/api';
import InvoiceDocument from './components/InvoiceDocument';

function Preview({ onClose, isOpen, id, generatePDF, selectedId, isLoading }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true; setInvoice(null);
    if (!isOpen || !selectedId) return undefined;
    setLoading(true);
    getApi('api/invoices/view/', selectedId).then(result => {
      if (active && result?.status === 200) setInvoice(result.data?.result);
    }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, selectedId]);
  const close = () => onClose(false);
  return <Drawer isOpen={isOpen} onClose={close} size="xl"><DrawerOverlay /><DrawerContent>
    <DrawerHeader display="flex" justifyContent="space-between" alignItems="center">{tr('Invoice')}
      <IconButton aria-label={tr('Close')} icon={<CloseIcon />} onClick={close} variant="ghost" /></DrawerHeader>
    <DrawerBody>{loading ? <Spinner /> : invoice ? <div id={id}><InvoiceDocument invoice={invoice} /></div>
      : <Text color="red.500">{tr('estate.serverError')}</Text>}</DrawerBody>
    <DrawerFooter><Button size="sm" variant="brand" isLoading={isLoading} isDisabled={loading || !invoice} onClick={generatePDF}>{tr('Download')}</Button></DrawerFooter>
  </DrawerContent></Drawer>;
}
export default withLocalization(Preview);
