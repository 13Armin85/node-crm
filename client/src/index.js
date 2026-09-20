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
import { store, persistor } from "./redux/store";
import { PersistGate } from "redux-persist/integration/react";
import { LanguageProvider, TranslationBoundary } from "i18n";
import { RtlProvider } from 'components/rtlProvider/RtlProvider';
import {
  AUTH_CHANGED_EVENT,
  clearAuthSession,
  getAuthSession,
} from "services/authSession";

function App() {
  const reduxUser = useSelector((state) => state?.user?.user);
  const [session, setSession] = React.useState(getAuthSession);

  React.useEffect(() => {
    const syncSession = () => setSession(getAuthSession());
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

  const user = reduxUser || session.user;
  const token = session.token;

  return (
    <>
      <ToastContainer />
      <Routes>
        {token && user?.role ? (
          user.role === "user" ? (
            <Route path="/*" element={<UserLayout />} />
          ) : user.role === "admin" ? (
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
    <PersistGate loading={null} persistor={persistor}>
      <LanguageProvider>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <RtlProvider><ChakraProvider theme={theme}>
          <React.StrictMode>
            <ThemeEditorProvider>
              <TranslationBoundary>
                <Router>
                  <App />
                </Router>
              </TranslationBoundary>
            </ThemeEditorProvider>
          </React.StrictMode>
        </ChakraProvider></RtlProvider>
      </LanguageProvider>
    </PersistGate>
  </Provider>,
  document.getElementById("root"),
);
