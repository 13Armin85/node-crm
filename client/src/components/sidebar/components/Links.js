import { Fragment } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Box, Flex, Text, Tooltip } from "@chakra-ui/react";
import { useLanguage } from "i18n";

export function SidebarLinks({ routes, setOpenSidebar, openSidebar }) {
  const location = useLocation();
  const { t } = useLanguage();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const activeRoute = (routePath) => {
    if (!routePath) return false;
    const normalizedPath = routePath.toLowerCase();
    const currentPath = location.pathname.toLowerCase();
    return currentPath === normalizedPath || currentPath.startsWith(`${normalizedPath}/`);
  };

  const closeMobileSidebar = () => {
    if (window.innerWidth < 1280 && typeof setOpenSidebar === "function") {
      setOpenSidebar(false);
    }
  };

  const createLinks = (items = []) =>
    items.map((route, index) => {
      const key = route?.path || route?.name || index;

      if (route?.category) {
        return (
          <Fragment key={key}>
            {openSidebar && (
              <Text className="crm-sidebar-section" as="p">
                {t(route?.name)}
              </Text>
            )}
            {createLinks(route?.items)}
          </Fragment>
        );
      }

      if (route?.under || !user?.role || !route?.layout?.includes(`/${user.role}`)) {
        return null;
      }

      const isActive = activeRoute(route?.path);
      const link = (
        <Flex
          className={`crm-sidebar-link${isActive ? " is-active" : ""}`}
          align="center"
          justify={openSidebar ? "flex-start" : "center"}
          onClick={closeMobileSidebar}
        >
          <Flex className="crm-sidebar-link__icon" align="center" justify="center">
            {route?.icon}
          </Flex>
          {openSidebar && (
            <Text className="crm-sidebar-link__label" noOfLines={1}>
              {t(route?.name)}
            </Text>
          )}
          {isActive && <Box className="crm-sidebar-link__indicator" />}
        </Flex>
      );

      return (
        <Fragment key={key}>
          {route?.separator && openSidebar && (
            <Text className="crm-sidebar-section" as="p">
              {t(route.separator)}
            </Text>
          )}
          <NavLink to={route?.path} aria-label={t(route?.name)}>
            {openSidebar ? (
              link
            ) : (
              <Tooltip label={t(route?.name)} placement="right" hasArrow openDelay={250}>
                {link}
              </Tooltip>
            )}
          </NavLink>
        </Fragment>
      );
    });

  return <>{createLinks(routes)}</>;
}

export default SidebarLinks;
