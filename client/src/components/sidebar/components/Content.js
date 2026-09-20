import { Box, Text } from "@chakra-ui/react";
import Links from "./Links";
import { useLanguage } from "i18n";

export default function SidebarContent({ routes, openSidebar, setOpenSidebar }) {
  const { t } = useLanguage();

  return (
    <Box as="nav" className="crm-sidebar-nav">
      {openSidebar && (
        <Text className="crm-sidebar-nav__title">{t("Main navigation")}</Text>
      )}
      <Links routes={routes} openSidebar={openSidebar} setOpenSidebar={setOpenSidebar} />
    </Box>
  );
}
