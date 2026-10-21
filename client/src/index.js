import { isAdmin } from 'roles';
import React from "react";
import ReactDOM from "react-dom";
import "assets/css/App.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import AuthLayout from "./layouts/auth";
import AdminLayout from "layouts/admin";
import UserLayout from "layouts/user";
import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import theme from "theme/theme";
import { ThemeEditorProvider } from "@hypertheme-editor/chakra-ui";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Provider } from "react-redux";
import { useSelector } from "react-redux";
import { store } from "./redux/store";
import PwaProvider from "components/pwa/PwaProvider";
import ModalViewport from "components/modal/ModalViewport";
import AppErrorBoundary from "components/AppErrorBoundary";
import { LanguageProvider, TranslationBoundary } from "i18n";
import { RtlProvider } from 'components/rtlProvider/RtlProvider';
import {
  AUTH_CHANGED_EVENT,
  clearAuthSession,
  getAuthSession,
} from "services/authSession";

function App() {
  React.useEffect(() => { window.crmAppStarted?.(); }, []);
  const reduxUser = useSelector((state) => state?.user?.user);
  const [session, setSession] = React.useState(getAuthSession);

  React.useEffect(() => {
    const syncSession = () => {
      const nextSession = getAuthSession();
      if (!nextSession.token) store.dispatch({ type: "user/clearUser" });
      setSession(nextSession);
    };
    window.addEventListener("storage", syncSession);
    window.addEventListener(AUTH_CHANGED_EVENT, syncSession);
    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener(AUTH_CHANGED_EVENT, syncSession);
    };
  }, []);

  React.useEffect(() => {
    const nextSession = getAuthSession();
    setSession(nextSession);
    if (!nextSession.token && (localStorage.getItem("token") || sessionStorage.getItem("token"))) {
      clearAuthSession();
    }
  }, [reduxUser]);

  let normalizedUser = reduxUser;
  if (typeof normalizedUser === "string") {
    try { normalizedUser = JSON.parse(normalizedUser); } catch { normalizedUser = null; }
  }
  const user = normalizedUser?.role ? normalizedUser : session.user;
  const token = session.token;

  return (
    <>
      <ModalViewport />
      <ToastContainer />
      <Routes>
        {token && user?.role ? (
          user.role === "user" ? (
            <Route path="/*" element={<UserLayout />} />
          ) : isAdmin(user) ? (
            <Route path="/*" element={<AdminLayout />} />
          ) : (
            <Route path="/*" element={<AuthLayout />} />
          )
        ) : (
          <Route path="/*" element={<AuthLayout />} />
        )}
      </Routes>
    </>
  );
}

ReactDOM.render(
  <Provider store={store}>
    <AppErrorBoundary>
      <LanguageProvider>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <RtlProvider><ChakraProvider theme={theme}>
          <React.StrictMode>
            <ThemeEditorProvider>
              <TranslationBoundary>
                <Router>
                  <PwaProvider><App /></PwaProvider>
                </Router>
              </TranslationBoundary>
            </ThemeEditorProvider>
          </React.StrictMode>
        </ChakraProvider></RtlProvider>
      </LanguageProvider>
    </AppErrorBoundary>
  </Provider>,
  document.getElementById("root"),
);
