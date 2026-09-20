import { Box, Flex, IconButton, Image, Text } from "@chakra-ui/react";
import { IoMenuOutline } from "react-icons/io5";
import { FiCommand } from "react-icons/fi";
import Content from "./components/Content";
import { useLanguage } from "i18n";

export default function Sidebar({ routes, openSidebar, setOpenSidebar, largeLogo }) {
  const { t, direction } = useLanguage();
  const logo = largeLogo?.[0]?.logoLgImg;

  return (
    <>
      <Box className="crm-sidebar-backdrop" aria-hidden="true" onClick={() => setOpenSidebar?.(false)} />
      <Box as="aside" id="crm-sidebar" className="crm-sidebar-shell" dir="ltr" aria-label={t("Navigation")}>
        <Box className="crm-sidebar-panel" dir={direction}>
          <Flex className="crm-sidebar-brand" align="center">
            <Flex className="crm-sidebar-brand__mark" align="center" justify="center">
              {logo ? <Image src={logo} alt="CRM" /> : <FiCommand />}
            </Flex>
            {openSidebar && (
              <Box minW="0">
                <Text className="crm-sidebar-brand__name" noOfLines={1}>{t("CRM Studio")}</Text>
                <Text className="crm-sidebar-brand__caption" noOfLines={1}>{t("Business workspace")}</Text>
              </Box>
            )}
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
