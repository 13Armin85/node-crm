import jwtDecode from "jwt-decode";

export const AUTH_CHANGED_EVENT = "crm:auth-changed";

const parseUser = (value) => {
  if (!value || value === "undefined" || value === "null") return null;

  try {
    const user = JSON.parse(value);
    if (user?.role === "superAdmin") return { ...user, role: "admin" };
    return ["admin", "user"].includes(user?.role) ? user : null;
  } catch (error) {
    return null;
  }
};

export const getStoredToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

export const getStoredUser = () => parseUser(localStorage.getItem("user"));

export const isTokenActive = (token) => {
  if (!token) return false;

  try {
    const { exp } = jwtDecode(token);
    return !exp || exp * 1000 > Date.now();
  } catch (error) {
    return false;
  }
};

export const getAuthSession = () => {
  const token = getStoredToken();
  const user = getStoredUser();

  if (!user || !isTokenActive(token)) return { token: null, user: null };
  return { token, user };
};

export const notifyAuthChanged = () => {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
};

export const saveAuthSession = ({ token, user, remember = true }) => {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
  (remember ? localStorage : sessionStorage).setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  notifyAuthChanged();
};

export const clearAuthSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  notifyAuthChanged();
};
