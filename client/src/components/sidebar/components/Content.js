import { Box } from '@chakra-ui/react';
import Links from './Links';

export default function SidebarContent({ routes, openSidebar }) {
  return <Box as="nav" py="12px"><Links routes={routes} openSidebar={openSidebar} /></Box>;
}
