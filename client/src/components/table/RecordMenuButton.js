import React from 'react';
import { Button, MenuButton } from '@chakra-ui/react';
import { FiChevronDown, FiMoreHorizontal } from 'react-icons/fi';
import { useLanguage } from 'i18n';

export default function RecordMenuButton(props) {
  const { t } = useLanguage();
  return <MenuButton as={Button} type="button" variant="ghost" size="sm"
    aria-label={t('Actions')} title={t('Actions')} {...props} className={`crm-record-menu-button ${props.className || ''}`}>
    <span className="crm-record-menu-button__content">
      <FiMoreHorizontal aria-hidden="true" />
      <span className="crm-record-menu-button__label">{t('Actions')}</span>
      <FiChevronDown className="crm-record-menu-button__chevron" aria-hidden="true" />
    </span>
  </MenuButton>;
}
