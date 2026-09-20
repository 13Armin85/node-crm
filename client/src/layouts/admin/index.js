// Chakra imports
import { Portal, Box, useDisclosure, Flex, Icon } from "@chakra-ui/react";
import Footer from "components/footer/FooterAdmin.js";
// Layout components
import Navbar from "components/navbar/NavbarAdmin.js";
import Sidebar from "components/sidebar/Sidebar.js";
import Spinner from "components/spinner/Spinner";
import { SidebarContext } from "contexts/SidebarContext";
import React, { Suspense, useEffect } from "react";
import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ROLE_PATH } from "../../roles";
import newRoutes from "routes.js";
import { useDispatch, useSelector } from "react-redux";
import { fetchImage } from "../../redux/slices/imageSlice";
import { getApi } from "services/api";
import { MdHome, MdLock } from "react-icons/md";
import DynamicPage from "views/admin/dynamicPage";
import DynamicPageview from "views/admin/dynamicPage/DynamicPageview";
import { fetchRouteData } from "../../redux/slices/routeSlice";
import { LuChevronRightCircle } from "react-icons/lu";
import { fetchModules } from "../../redux/slices/moduleSlice";
import { useLanguage } from "i18n";
import PageHelp from "components/help/PageHelp";

const MainDashboard = React.lazy(() => import("views/admin/default"));

// Custom Chakra theme
export default function Dashboard(props) {
  const { ...rest } = props;
  // states and functions
  const [fixed] = useState(false);
  const [toggleSidebar, setToggleSidebar] = useState(false);
  const [openSidebar, setOpenSidebar] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1280,
  );
  const { direction, t } = useLanguage();
  const location = useLocation();
  // const user = JSON.parse(localStorage.getItem("user"))

  // let routes = newRoutes;
  const [routes, setRoutes] = useState(newRoutes);
  const route = useSelector((state) => state?.route?.data);
  const modules = useSelector((state) => state?.modules?.data);
  const dispatch = useDispatch();

  const pathName = (name) => {
    return `/${name?.toLowerCase()?.replace(/ /g, "-")}`;
  };

  const getRoute = () => {
    return location.pathname !== "/admin/full-screen-maps";
  };

  const dynamicRoute = () => {
    let apiData = [];

    route &&
      route?.length > 0 &&
      route?.map((item, i) => {
        let rec = routes?.find((route) => route?.name === item?.moduleName);
        if (!routes?.some((route) => route?.name === item?.moduleName)) {
          const newRoute = [
            {
              name: item?.moduleName,
              layout: [ROLE_PATH?.admin],
              path: pathName(item?.moduleName),
              icon: item?.icon ? (
                <img src={item?.icon} width="20px" height="20px" alt="icon" />
              ) : (
                <Icon
                  as={LuChevronRightCircle}
                  width="20px"
                  height="20px"
                  color="inherit"
                />
              ),
              component: DynamicPage,
            },
            {
              name: item?.moduleName,
              layout: [ROLE_PATH?.admin],
              under: item?.moduleName,
              parentName: item?.moduleName,
              path: `${pathName(item?.moduleName)}/:id`,
              icon: item?.icon ? (
                <img src={item?.icon} width="20px" height="20px" alt="icon" />
              ) : (
                <Icon
                  as={LuChevronRightCircle}
                  width="20px"
                  height="20px"
                  color="inherit"
                />
              ),
              component: DynamicPageview,
            },
          ];
          setRoutes((pre) => [...pre, ...newRoute]);
        } else if (
          routes?.some((route) => route?.name === item?.moduleName) &&
          rec.icon?.props?.src !== item?.icon
        ) {
          const updatedData = routes?.map((i) => {
            if (i.name === item?.moduleName) {
              return {
                ...i,
                icon: (
                  <img src={item?.icon} width="20px" height="20px" alt="icon" />
                ),
              };
            }
            return i;
          });
          setRoutes(updatedData);
        }
        if (routes?.find((route) => route?.name !== item?.moduleName)) {
          if (
            !newRoutes?.find(
              (route) =>
                route?.name?.toLowerCase() === item?.moduleName?.toLowerCase(),
            )
          ) {
            const newRoute = [
              {
                name: item?.moduleName,
                layout: [ROLE_PATH?.admin],
                path: pathName(item?.moduleName),
                icon: item?.icon ? (
                  <img src={item?.icon} width="20px" height="20px" alt="icon" />
                ) : (
                  <Icon
                    as={LuChevronRightCircle}
                    width="20px"
                    height="20px"
                    color="inherit"
                  />
                ),
                component: DynamicPage,
              },
              {
                name: item?.moduleName,
                layout: [ROLE_PATH.admin],
                under: item?.moduleName,
                parentName: item?.moduleName,
                path: `${pathName(item.moduleName)}/:id`,
                icon: item?.icon ? (
                  <img src={item?.icon} width="20px" height="20px" alt="icon" />
                ) : (
                  <Icon
                    as={LuChevronRightCircle}
                    width="20px"
                    height="20px"
                    color="inherit"
                  />
                ),
                component: DynamicPageview,
              },
            ];

            apiData.push(...newRoute);
          }
        }
      });

    let filterData = [...newRoutes, ...apiData];

    const activeModel = modules
      ?.filter((module) => module?.isActive)
      ?.map((module) => module?.moduleName);

    const activeRoutes = filterData?.filter(
      (data) =>
        activeModel?.includes(data?.name) ||
        activeModel?.includes(data?.parentName) ||
        !modules?.some(
          (module) =>
            module?.moduleName === data?.name ||
            module?.moduleName === data?.parentName,
        ),
    );

    setRoutes(activeRoutes);
  };

  const getActiveRoute = (routes) => {
    let activeRoute = "Dashboard";
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
          return routes[i]?.name;
        }
      }
    }
    return activeRoute;
  };

  useEffect(() => {
    dynamicRoute();
  }, [route, modules]);

  useEffect(() => {
    dispatch(fetchRouteData());
    dispatch(fetchImage());
    dispatch(fetchModules());
  }, [dispatch]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && window.innerWidth < 1280) setOpenSidebar(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const largeLogo = useSelector((state) =>
    state?.images?.images?.filter((item) => item?.isActive === true),
  );

  const under = (routes) => {
    let activeRoute = false;
    for (let i = 0; i < routes.length; i++) {
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
    for (let i = 0; i < routes?.length; i++) {
      if (routes[i]?.collapse) {
        let collapseActiveNavbar = getActiveNavbar(routes[i]?.items);
        if (collapseActiveNavbar !== activeNavbar) {
          return collapseActiveNavbar;
        }
      } else if (routes[i]?.category) {
        let categoryActiveNavbar = getActiveNavbar(routes[i]?.items);
        if (categoryActiveNavbar !== activeNavbar) {
          return categoryActiveNavbar;
        }
      } else {
        if (location.pathname?.indexOf(routes[i]?.path) !== -1) {
          return routes[i]?.secondary;
        }
      }
    }
    return activeNavbar;
  };
  const getActiveNavbarText = (routes) => {
    let activeNavbar = false;
    for (let i = 0; i < routes?.length; i++) {
      if (routes[i]?.collapse) {
        let collapseActiveNavbar = getActiveNavbarText(routes[i]?.items);
        if (collapseActiveNavbar !== activeNavbar) {
          return collapseActiveNavbar;
        }
      } else if (routes[i]?.category) {
        let categoryActiveNavbar = getActiveNavbarText(routes[i]?.items);
        if (categoryActiveNavbar !== activeNavbar) {
          return categoryActiveNavbar;
        }
      } else {
        if (location.pathname?.indexOf(routes[i]?.path) !== -1) {
          return routes[i]?.messageNavbar;
        }
      }
    }
    return activeNavbar;
  };

  const getRoutes = (routes) => {
    return routes?.map((prop, key) => {
      // if (!prop.under && prop.layout === '/admin') {
      if (!prop?.under && prop?.layout?.includes(ROLE_PATH?.admin)) {
        return (
          <Route path={prop?.path} element={<prop.component />} key={key} />
        );
      } else if (prop?.under) {
        return (
          <Route path={prop?.path} element={<prop.component />} key={key} />
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
            largeLogo={largeLogo}
            display="none"
            {...rest}
            openSidebar={openSidebar}
            setOpenSidebar={setOpenSidebar}
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
                  routes={routes}
                  fixed={fixed}
                  under={under(routes)}
                  largeLogo={largeLogo}
                  openSidebar={openSidebar}
                  setOpenSidebar={setOpenSidebar}
                  {...rest}
                />
              </Box>
            </Portal>
            <Box pt="100px">
              {getRoute() ? (
                <Box
                  className="crm-content"
                  mx="auto"
                  pe="20px"
                  minH="84vh"
                  pt="50px"
                  style={{
                    padding: "8px 20px",
                  }}
                >
                  <PageHelp
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
            <Box>
              <Footer />
            </Box>
          </Box>
        </SidebarContext.Provider>
      </Box>
    </Box>
  );
}
