import { Box, Flex, Heading, IconButton, useColorModeValue } from '@chakra-ui/react';
import { AiOutlineMenuFold, AiOutlineMenuUnfold } from 'react-icons/ai';
import AdminNavbarLinks from './NavbarLinksAdmin';
import { useLanguage } from 'i18n';

export default function AdminNavbar({ brandText, openSidebar, setOpenSidebar, ...props }) {
  const { t } = useLanguage();
  const background = useColorModeValue('rgba(255,255,255,0.96)', 'rgba(13,24,42,0.96)');
  return (
    <Flex as="header" className="crm-header" dir="ltr" bg={background}>
      <Flex align="center" gap="12px" minW="0">
        <IconButton
          className="crm-sidebar-toggle"
          aria-label={t(openSidebar ? 'Close sidebar' : 'Open sidebar')}
          aria-expanded={openSidebar}
          aria-controls="crm-sidebar"
          icon={openSidebar ? <AiOutlineMenuFold /> : <AiOutlineMenuUnfold />}
          onClick={() => setOpenSidebar(value => !value)}
          variant="ghost" fontSize="24px" flexShrink={0}
        />
        <Heading fontSize={{ base: 'md', md: 'xl' }} noOfLines={1}>{brandText}</Heading>
      </Flex>
      <Box className="crm-header-profile" flexShrink={0}>
        <AdminNavbarLinks {...props} />
      </Box>
    </Flex>
  );
}
