import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { IoMenuOutline } from "react-icons/io5";
import BrandLogo from "components/BrandLogo";
import Content from "./components/Content";
import { useLanguage } from "i18n";

export default function Sidebar({ routes, openSidebar, setOpenSidebar }) {
  const { t, direction } = useLanguage();

  return (
    <>
      <Box className="crm-sidebar-backdrop" aria-hidden="true" onClick={() => setOpenSidebar?.(false)} />
      <Box as="aside" id="crm-sidebar" className="crm-sidebar-shell" dir="ltr" aria-label={t("Navigation")}>
        <Box className="crm-sidebar-panel" dir={direction}>
          <Flex className="crm-sidebar-brand" align="center">
            <BrandLogo width={openSidebar ? "88px" : "40px"} height={openSidebar ? "88px" : "40px"} maxW="100%" mx="auto" />
          </Flex>
          <Content routes={routes} openSidebar={openSidebar} setOpenSidebar={setOpenSidebar} />
          {openSidebar && (
            <Box className="crm-sidebar-status">
              <Box className="crm-sidebar-status__dot" />
              <Box>
                <Text className="crm-sidebar-status__title">{t("System ready")}</Text>
                <Text className="crm-sidebar-status__text">{t("All services are available")}</Text>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
}

export function SidebarResponsive({ openSidebar, setOpenSidebar }) {
  const { t } = useLanguage();
  return <IconButton aria-label={t(openSidebar ? "Close sidebar" : "Open sidebar")} icon={<IoMenuOutline />} onClick={() => setOpenSidebar((value) => !value)} variant="ghost" />;
}
