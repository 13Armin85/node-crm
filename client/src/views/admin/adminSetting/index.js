import { Box, Heading, Icon, Link, SimpleGrid, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiChevronRight, FiEye, FiList, FiSettings } from 'react-icons/fi';
import { FaWpforms } from 'react-icons/fa';
import { HiUsers } from 'react-icons/hi';
import { TbExchange, TbTableColumn } from 'react-icons/tb';
import { GrValidate } from 'react-icons/gr';
import { VscFileSubmodule } from 'react-icons/vsc';
import { IoIosSwitch } from 'react-icons/io';
import { useLanguage } from 'i18n';

const destinations = [
  ['User data visibility', '/data-visibility', FiEye],
  ['Logs', '/audit-logs', FiList],
  ['Users', '/user', HiUsers],
  ['Change Images', '/change-images', TbExchange],
  ['estate.formBuilder', '/form-builder', FaWpforms],
  ['Validations', '/validations', GrValidate],
  ['Table Fields', '/table-field', TbTableColumn],
  ['Module', '/module', VscFileSubmodule],
  ['Active Deactive Module', '/active-deactive-module', IoIosSwitch],
];

export default function Settings() {
  const { t } = useLanguage();
  return <Box className="crm-settings-page">
    <Box className="crm-page-hero crm-settings-heading">
      <Icon as={FiSettings} aria-hidden="true" />
      <Heading className="crm-page-hero__title">{t('Admin Settings')}</Heading>
    </Box>
    <SimpleGrid className="crm-settings-grid" columns={{ base: 1, sm: 2, xl: 3 }} gap="10px">
      {destinations.map(([label, path, icon]) => <Link as={RouterLink} to={path} key={path} className="crm-settings-link">
        <Box className="crm-settings-link__icon"><Icon as={icon} aria-hidden="true" /></Box>
        <Text className="crm-settings-link__label">{t(label)}</Text>
        <Icon as={FiChevronRight} className="crm-settings-link__arrow" aria-hidden="true" />
      </Link>)}
    </SimpleGrid>
  </Box>;
}
