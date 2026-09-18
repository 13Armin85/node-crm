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
import { store, persistor } from "./redux/store";
import { PersistGate } from "redux-persist/integration/react";
import { LanguageProvider, TranslationBoundary } from "i18n";
import { RtlProvider } from 'components/rtlProvider/RtlProvider';

const getStoredUser = () => {
  try {
    const storedUser = localStorage.getItem("user");
    if (!storedUser || storedUser === "undefined" || storedUser === "null") return null;

    const user = JSON.parse(storedUser);
    if (user?.role === "superAdmin") {
      const migratedUser = { ...user, role: "admin" };
      localStorage.setItem("user", JSON.stringify(migratedUser));
      return migratedUser;
    }
    if (!["admin", "user"].includes(user?.role)) return null;
    return user;
  } catch (error) {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    return null;
  }
};

function App() {
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  const user = getStoredUser();

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
