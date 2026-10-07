import { safeInternalPath } from 'services/contentSecurity';
import { Fragment } from "react";
import { Link, matchPath, matchRoutes, useLocation } from "react-router-dom";
import { Box, Flex, Text, Tooltip } from "@chakra-ui/react";
import { useLanguage } from "i18n";
import { ROLE_PATH } from 'roles';

const flattenRoutes = (items) => (Array.isArray(items) ? items : []).flatMap((route) =>
  route?.category || route?.collapse ? flattenRoutes(route.items) : [route],
);
const normalizePath = (path) => String(path || "").replace(/\/+$/, "").toLowerCase();
const normalizeName = (name) => String(name || "").trim().toLowerCase();

export function SidebarLinks({ routes, setOpenSidebar, openSidebar }) {
  const location = useLocation();
  const { t } = useLanguage();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const eligibleRoutes = flattenRoutes(routes).filter((route) =>
    route?.path && user?.role && Array.isArray(route.layout) && route.layout.includes(ROLE_PATH[user.role]),
  );
  const visibleRoutes = eligibleRoutes.filter((route) => !route.under);
  const matched = matchRoutes(
    eligibleRoutes.map((route) => ({ path: route.path, item: route })),
    location,
  )?.[0]?.route?.item;
  const selected = (matched?.under
    ? visibleRoutes.find((route) => [matched.parentName, matched.name].some((name) =>
      normalizeName(name) === normalizeName(route.name),
    ))
    : matched) || visibleRoutes.filter((route) =>
      matchPath({ path: route.path, end: false }, location.pathname),
    ).sort((a, b) => b.path.length - a.path.length)[0];
  const selectedPath = normalizePath(selected?.path);
  const renderedPaths = new Set();

  const closeMobileSidebar = () => {
    if (window.innerWidth < 1280 && typeof setOpenSidebar === "function") {
      setOpenSidebar(false);
    }
  };

  const createLinks = (items = []) =>
    items.map((route, index) => {
      const key = route?.path || route?.name || index;

      if (route?.category || route?.collapse) {
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

      const pathKey = normalizePath(route?.path);
      if (route?.under || !pathKey || !user?.role || !Array.isArray(route?.layout)
        || !route.layout.includes(ROLE_PATH[user.role]) || renderedPaths.has(pathKey)) {
        return null;
      }
      renderedPaths.add(pathKey);

      const isActive = pathKey === selectedPath;
      const link = (
        <Flex
          className={`crm-sidebar-link${isActive ? " is-active" : ""}`}
          align="center"
          justify={openSidebar ? "flex-start" : "center"}
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
        <Fragment key={pathKey}>
          {route?.separator && openSidebar && (
            <Text className="crm-sidebar-section" as="p">
              {t(route.separator)}
            </Text>
          )}
          <Link to={safeInternalPath(route.path)} aria-label={t(route.name)} aria-current={isActive ? "page" : undefined} onClick={closeMobileSidebar}>
            {openSidebar ? (
              link
            ) : (
              <Tooltip label={t(route?.name)} placement="right" hasArrow openDelay={250}>
                {link}
              </Tooltip>
            )}
          </Link>
        </Fragment>
      );
    });

  return <>{createLinks(routes)}</>;
}

export default SidebarLinks;
