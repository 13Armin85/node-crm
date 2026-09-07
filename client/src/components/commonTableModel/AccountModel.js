import React, { useState } from 'react';
import { Button, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@chakra-ui/react';
import { AsyncRelationSelect } from 'components/dynamicForm/DynamicFormRenderer';
import { useLanguage } from 'i18n';
export default function PartnerCustomerSelect({ onClose, isOpen, fieldName, setFieldValue }) {
  const { t, direction } = useLanguage();
  const [value, setValue] = useState('');
  return <Modal isOpen={isOpen} onClose={onClose}><ModalOverlay /><ModalContent dir={direction}><ModalHeader>{t('Partner Customers')}</ModalHeader><ModalBody><AsyncRelationSelect moduleName="Partner Customers" value={value} onChange={setValue} /></ModalBody><ModalFooter><Button disabled={!value} onClick={() => { setFieldValue(fieldName, value); onClose(); }}>{t('Select')}</Button><Button ms={2} onClick={onClose}>{t('Close')}</Button></ModalFooter></ModalContent></Modal>;
}
