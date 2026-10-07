// Chakra imports
import {
  Portal,
  Box,
  useDisclosure,
  Text,
  Button,
  Link,
  Flex,
  Icon,
} from "@chakra-ui/react";
import Footer from "components/footer/FooterAdmin.js";
// Layout components
import Navbar from "components/navbar/NavbarAdmin.js";
import Sidebar from "components/sidebar/Sidebar.js";
import { SidebarContext } from "contexts/SidebarContext";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ROLE_PATH } from "../../roles";
import newRoute from "routes.js";
import Spinner from "components/spinner/Spinner";
import { useDispatch, useSelector } from "react-redux";
import { fetchImage } from "../../redux/slices/imageSlice";
import { getApi } from "services/api";
import DynamicPage from "views/admin/dynamicPage";
import { LuChevronRightCircle } from "react-icons/lu";
import { fetchModules } from "../../redux/slices/moduleSlice";
import { useLanguage } from "i18n";
import PageHelp from "components/help/PageHelp";

// Custom Chakra theme
export default function User(props) {
  const { ...rest } = props;
  // states and functions
  const [fixed] = useState(false);
  const [toggleSidebar, setToggleSidebar] = useState(false);
  const [route, setRoute] = useState();
  const [openSidebar, setOpenSidebar] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1280,
  );
  const { direction, t } = useLanguage();
  const location = useLocation();
  const modules = useSelector((state) => state?.modules?.data);
  // functions for changing the states from components
  const getRoute = () => {
    return location.pathname !== "/admin/full-screen-maps";
  };

  const fetchRoute = async () => {
    let response = await getApi("api/route/");
    setRoute(response?.data);
  };

  useEffect(() => {
    fetchRoute();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && window.innerWidth < 1280) setOpenSidebar(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const routes = useMemo(() => {
    const normalizeName = (name) => String(name || "").trim().toLowerCase();
    const normalizePath = (path) => String(path || "").replace(/\/+$/, "").toLowerCase();
    const knownNames = new Set(newRoute.map((item) => normalizeName(item.name)));
    const knownPaths = new Set(newRoute.map((item) => normalizePath(item.path)));
    const dynamicRoutes = [];

    for (const item of Array.isArray(route) ? route : []) {
      const name = item?.moduleName?.trim();
      const nameKey = normalizeName(name);
      const path = "/" + nameKey.replace(/\s+/g, "-");
      if (!name || knownNames.has(nameKey) || knownPaths.has(path)) continue;
      knownNames.add(nameKey);
      knownPaths.add(path);
      dynamicRoutes.push({
        name,
        layout: [ROLE_PATH.user],
        path,
        icon: <Icon as={LuChevronRightCircle} width="20px" height="20px" color="inherit" />,
        component: DynamicPage,
      });
    }

    const configuredModules = new Map(
      (Array.isArray(modules) ? modules : []).map((item) => [
        normalizeName(item.moduleName), item.isActive,
      ]),
    );
    const seenPaths = new Set();
    return [...newRoute, ...dynamicRoutes].filter((item) => {
      if (!Array.isArray(item?.layout) || !item.layout.includes(ROLE_PATH.user)) return false;
      const moduleName = normalizeName(item.parentName || item.name);
      if (configuredModules.has(moduleName) && !configuredModules.get(moduleName)) return false;
      const pathKey = normalizePath(item.path);
      if (!pathKey || seenPaths.has(pathKey)) return false;
      seenPaths.add(pathKey);
      return true;
    });
  }, [modules, route]);

  const getActiveRoute = (routes) => {
    let activeRoute = "Dashboard";
    for (let i = 0; i < routes.length; i++) {
      if (routes[i].collapse) {
        let collapseActiveRoute = getActiveRoute(routes[i].items);
        if (collapseActiveRoute !== activeRoute) {
          return collapseActiveRoute;
        }
      } else if (routes[i].category) {
        let categoryActiveRoute = getActiveRoute(routes[i].items);
        if (categoryActiveRoute !== activeRoute) {
          return categoryActiveRoute;
        }
      } else {
        if (
          location.pathname.indexOf(routes[i].path.replace("/:id", "")) !==
          -1
        ) {
          return routes[i].name;
        }
      }
    }
    return activeRoute;
  };
  const under = (routes) => {
    let activeRoute = false;
    for (let i = 0; i < routes?.length; i++) {
      if (routes[i]?.collapse) {
        let collapseActiveRoute = getActiveRoute(routes[i]?.items);
        if (collapseActiveRoute !== activeRoute) {
          return collapseActiveRoute;
        }
      } else if (routes[i]?.category) {
        let categoryActiveRoute = getActiveRoute(routes[i]?.items);
        if (categoryActiveRoute !== activeRoute) {
          return categoryActiveRoute;
        }
      } else {
        if (
          location.pathname?.indexOf(
            routes[i]?.path?.replace("/:id", ""),
          ) !== -1
        ) {
          return routes[i];
        }
      }
    }
    return activeRoute;
  };

  const getActiveNavbar = (routes) => {
    let activeNavbar = false;
    for (let i = 0; i < routes.length; i++) {
      if (routes[i].collapse) {
        let collapseActiveNavbar = getActiveNavbar(routes[i].items);
        if (collapseActiveNavbar !== activeNavbar) {
          return collapseActiveNavbar;
        }
      } else if (routes[i].category) {
        let categoryActiveNavbar = getActiveNavbar(routes[i].items);
        if (categoryActiveNavbar !== activeNavbar) {
          return categoryActiveNavbar;
        }
      } else {
        if (location.pathname.indexOf(routes[i].path) !== -1) {
          return routes[i].secondary;
        }
      }
    }
    return activeNavbar;
  };
  const getActiveNavbarText = (routes) => {
    let activeNavbar = false;
    for (let i = 0; i < routes.length; i++) {
      if (routes[i].collapse) {
        let collapseActiveNavbar = getActiveNavbarText(routes[i].items);
        if (collapseActiveNavbar !== activeNavbar) {
          return collapseActiveNavbar;
        }
      } else if (routes[i].category) {
        let categoryActiveNavbar = getActiveNavbarText(routes[i].items);
        if (categoryActiveNavbar !== activeNavbar) {
          return categoryActiveNavbar;
        }
      } else {
        if (location.pathname.indexOf(routes[i].path) !== -1) {
          return routes[i].messageNavbar;
        }
      }
    }
    return activeNavbar;
  };

  const getRoutes = (routes) => {
    return routes?.map((prop) => {
      // if (!prop.under && prop.layout === '/admin') {
      if (!prop?.under && prop?.layout !== "/auth") {
        return (
          <Route
            path={prop?.path}
            element={prop && <prop.component />}
            key={prop.path}
          />
        );
      } else if (prop?.under) {
        return (
          <Route
            path={prop?.path}
            element={prop && <prop.component />}
            key={prop.path}
          />
        );
      }
      if (prop?.collapse) {
        return getRoutes(prop?.items);
      }
      if (prop?.category) {
        return getRoutes(prop?.items);
      } else {
        return null;
      }
    });
  };
  const { onOpen } = useDisclosure();

  const dispatch = useDispatch();

  useEffect(() => {
    // Load branding images and available modules on component mount.
    dispatch(fetchImage());
    dispatch(fetchModules());
  }, [dispatch]);

  const largeLogo = useSelector((state) =>
    state?.images?.images?.filter((item) => item?.isActive === true),
  );

  return (
    <Box className="crm-shell" dir={direction} data-sidebar-open={openSidebar ? "true" : "false"}>
      <Box>
        <SidebarContext.Provider
          value={{
            toggleSidebar,
            setToggleSidebar,
          }}
        >
          <Sidebar
            routes={routes}
            display="none"
            {...rest}
            openSidebar={openSidebar}
            setOpenSidebar={setOpenSidebar}
            largeLogo={largeLogo}
          />
          <Box
            className="crm-main"
            minHeight="100vh"
            height="100%"
            overflow="auto"
            position="relative"
            maxHeight="100%"
          >
            <Portal>
              <Box className="header">
                <Navbar
                  onOpen={onOpen}
                  logoText={"Horizon UI Dashboard PRO"}
                  brandText={t(getActiveRoute(routes))}
                  secondary={getActiveNavbar(routes)}
                  message={t(getActiveNavbarText(routes))}
                  fixed={fixed}
                  routes={routes}
                  under={under(routes)}
                  largeLogo={largeLogo}
                  openSidebar={openSidebar}
                  setOpenSidebar={setOpenSidebar}
                  {...rest}
                />
              </Box>
            </Portal>
            <Box className="crm-workspace-body" pt="100px">
              {getRoute() ? (
                <Box
                  className="crm-content"
                  mx="auto"
                  pe="20px"
                  minH="84vh"
                  pt="50px"
                  style={{
                    padding: openSidebar ? "8px 20px 8px 20px" : "8px 20px",
                  }}
                >
                  <PageHelp
                    routes={routes}
                    route={under(routes)}
                    activeRouteName={getActiveRoute(routes)}
                  />
                  <Suspense
                    fallback={
                      <Flex
                        justifyContent={"center"}
                        alignItems={"center"}
                        width="100%"
                      >
                        <Spinner />
                      </Flex>
                    }
                  >
                    <Routes>
                      {getRoutes(routes)}
                      <Route path="/*" element={<Navigate to="/default" />} />
                    </Routes>
                  </Suspense>
                </Box>
              ) : null}
            </Box>
            <Box className="crm-footer-container">
              <Footer />
            </Box>
          </Box>
        </SidebarContext.Provider>
      </Box>
    </Box>
  );
}
