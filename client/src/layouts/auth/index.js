import { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

// Chakra imports
import { Box, Flex, useColorModeValue } from "@chakra-ui/react";

// Layout components
import { SidebarContext } from "contexts/SidebarContext";
import Spinner from "components/spinner/Spinner";
import { useLanguage } from "i18n";

const SignIn = lazy(() => import('views/auth/signIn'));

// Custom Chakra theme
export default function Auth({ setIsLogin }) {
  // states and functions
  const [toggleSidebar, setToggleSidebar] = useState(false);
  const { direction } = useLanguage();
  // functions for changing the states from components
  const getRoute = () => {
    return window.location.pathname !== "/auth/full-screen-maps";
  };

  const authBg = useColorModeValue("transparent", "transparent");
  return (
    <Box className="crm-auth-shell" dir={direction}>
      <SidebarContext.Provider
        value={{
          toggleSidebar,
          setToggleSidebar,
        }}
      >
        <Box
          bg={authBg}
          minW="0"
          position="relative"
          w="100%"
          transition="all 0.33s cubic-bezier(0.685, 0.0473, 0.346, 1)"
          transitionDuration=".2s, .2s, .35s"
          transitionProperty="top, bottom, width"
          transitionTimingFunction="linear, linear, ease"
        >
          {getRoute() ? (
            <Box mx="auto" minW="0">
              <Suspense
                fallback={
                  <Flex
                    justifyContent={"center"}
                    alignItems={"center"}
                    width="100%"
                    height={"100vh"}
                  >
                    <Spinner />
                  </Flex>
                }
              >
                <Routes>
                  <Route path="/auth/sign-in" element={<SignIn />} />
                  <Route path="/*" element={<Navigate to="/auth/sign-in" />} />
                </Routes>
              </Suspense>
            </Box>
          ) : null}
        </Box>
      </SidebarContext.Provider>
    </Box>
  );
}
