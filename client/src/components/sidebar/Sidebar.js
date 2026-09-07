import { Box, IconButton, useColorModeValue } from '@chakra-ui/react';
import { IoMenuOutline } from 'react-icons/io5';
import Content from './components/Content';
import { useLanguage } from 'i18n';

export default function Sidebar({ routes, openSidebar }) {
  const background = useColorModeValue('white', 'navy.800');
  const { t } = useLanguage();
  return (
    <Box as="aside" id="crm-sidebar" className="crm-sidebar-shell" dir="ltr" aria-label={t('Navigation')}>
      <Box className="crm-sidebar-panel" bg={background}>
        <Content routes={routes} openSidebar={openSidebar} />
      </Box>
    </Box>
  );
}

// Shared toggle for the alternate navbar components; the shell owns the panel.
export function SidebarResponsive({ openSidebar, setOpenSidebar }) {
  const { t } = useLanguage();
  return <IconButton aria-label={t(openSidebar ? 'Close sidebar' : 'Open sidebar')} icon={<IoMenuOutline />} onClick={() => setOpenSidebar(value => !value)} variant="ghost" />;
}
