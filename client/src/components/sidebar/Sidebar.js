import { useEffect } from "react";
import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { IoMenuOutline } from "react-icons/io5";
import BrandLogo from "components/BrandLogo";
import Content from "./components/Content";
import { useLanguage } from "i18n";

export default function Sidebar({ routes, openSidebar, setOpenSidebar }) {
  const { t, direction } = useLanguage();
  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 1279px)");
    if (!media) return undefined;
    const previous = document.body.style.overflow;
    const sync = () => { document.body.style.overflow = openSidebar && media.matches ? "hidden" : previous; };
    const resized = () => { if (media.matches) setOpenSidebar?.(false); sync(); };
    sync();
    media.addEventListener?.("change", resized);
    return () => { document.body.style.overflow = previous; media.removeEventListener?.("change", resized); };
  }, [openSidebar, setOpenSidebar]);

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
