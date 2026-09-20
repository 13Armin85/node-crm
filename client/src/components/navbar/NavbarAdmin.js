import { Box, Flex, Heading, IconButton, Text, useColorModeValue } from '@chakra-ui/react';
import { AiOutlineMenuFold, AiOutlineMenuUnfold } from 'react-icons/ai';
import AdminNavbarLinks from './NavbarLinksAdmin';
import { useLanguage } from 'i18n';

export default function AdminNavbar({ brandText, openSidebar, setOpenSidebar, ...props }) {
  const { t, direction } = useLanguage();
  const background = useColorModeValue('rgba(255,255,255,0.88)', 'rgba(12,18,31,0.88)');
  return (
    <Flex as="header" className="crm-header" dir={direction} bg={background}>
      <Flex className="crm-header-heading" align="center" gap={{ base: '8px', md: '12px' }} minW="0">
        <IconButton
          className="crm-sidebar-toggle"
          aria-label={t(openSidebar ? 'Close sidebar' : 'Open sidebar')}
          aria-expanded={openSidebar}
          aria-controls="crm-sidebar"
          icon={openSidebar ? <AiOutlineMenuFold /> : <AiOutlineMenuUnfold />}
          onClick={() => setOpenSidebar(value => !value)}
          variant="ghost" fontSize="22px" flexShrink={0}
        />
        <Box minW="0">
          <Text className="crm-header-eyebrow">{t('Workspace')}</Text>
          <Heading className="crm-header-title" fontSize={{ base: 'md', md: 'xl' }} noOfLines={1}>{brandText}</Heading>
        </Box>
      </Flex>
      <Box className="crm-header-profile" flexShrink={0}>
        <AdminNavbarLinks {...props} />
      </Box>
    </Flex>
  );
}
