import { toast } from 'react-toastify';
import axios from "axios";
import { constant } from "constant";
import { translate } from 'i18n';
import { clearAuthSession, getStoredToken, getStoredUser, saveAuthSession } from "./authSession";
import { dataScopeHeaders } from "./adminDataScope";
import { readVisibilityPath } from "./readVisibility";
import { NOTIFICATIONS_CHANGED_EVENT } from "./notificationEvents";

// Share only requests that are currently running. Responses are never retained
// between reads, users, person filters or successful mutations.
const pendingReads = new Map();
let readGeneration = 0;
const copyData = data => data && typeof data === 'object'
  ? (typeof structuredClone === 'function' ? structuredClone(data) : JSON.parse(JSON.stringify(data)))
  : data;

const getRequestConfig = (config = {}) => ({
  ...config,
  headers: {
    Authorization:
      getStoredToken(),
    ...config.headers,
  },
  validateStatus: () => true,
});


const reportSave = (result, path, config) => {
  const method = config?.method || result?.config?.method;
  const url = path || result?.config?.url || '';
  const save = ['post', 'put', 'patch'].includes(method) && /api\/(?:form\/(?:add|edit)|(?:contact|lead|task|meeting)\/(?:add|edit)|estate\/(?:Properties|Residences|Partner(?:%20| )Customers)(?:\/|$))/.test(url);
  if (!save) return;
  const language = localStorage.getItem('crm-language') || 'en';
  const ok = result?.status >= 200 && result?.status < 300;
  const message = ok ? 'Saved successfully' : result?.data?.code === 'duplicate' ? 'estate.duplicate' : 'Save failed. Please check the highlighted fields and try again.';
  toast[ok ? 'success' : 'error'](translate(message, language), { toastId: `save-${url}-${ok}` });
};

const normalizeResponse = (result) => {
  // A revoked remembered session must return to sign-in instead of caching a 401 as records.
  const requestToken = result?.config?.headers?.Authorization;
  if (result?.status === 401 && requestToken && requestToken === getStoredToken()) {
    clearAuthSession();
  }
  reportSave(result);
  const language = localStorage.getItem('crm-language') || 'en';
  const isBlob = typeof Blob !== 'undefined' && result?.data instanceof Blob;
  if (result?.data && !isBlob && !Array.isArray(result.data) && typeof result.data === 'object') {
    const data = { ...result.data };
    const fallback = result.status < 300 ? 'Success' : `estate.${data.code || (result.status === 401 ? 'unauthorized' : result.status === 403 ? 'forbidden' : result.status === 400 ? 'invalid' : 'serverError')}`;
    if (typeof data.message === 'string' || data.code) {
      const original = data.message || fallback;
      const translated = translate(original, language);
      data.message = language !== 'en' && translated === original ? translate(fallback, language) : translated;
    }
    if (typeof data.error === 'string') {
      const translated = translate(data.error, language);
      data.error = language !== 'en' && translated === data.error ? translate(fallback, language) : translated;
    }
    result = { ...result, data };
  }
  if (result?.status >= 200 && result?.status < 300) {
    if (["post", "put", "patch", "delete"].includes(result.config?.method) && !result.config?.url?.includes("/notification")) {
      readGeneration += 1;
      pendingReads.clear();
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    }
    return result;
  }

  return {
    ...result,
    response: result,
  };
};

export const postApi = async (path, data, login) => {
  try {
    let result = await axios?.post(
      constant?.baseUrl + path,
      data,
      getRequestConfig({ headers: dataScopeHeaders(path, 'post') }),
    );
    // Only the sign-in response may replace the stored session; a record field
    // named "token" from any other endpoint must never become a credential.
    if (path === "api/user/login" && result?.status === 200 && typeof result?.data?.token === "string") {
      saveAuthSession({
        token: result.data.token,
        user: result.data.user,
        remember: Boolean(login),
      });
    }
    return normalizeResponse(result);
  } catch (e) {
    reportSave(e.response, path, { method: 'post' });
    return e;
  }
};

export const postApiBlob = async (path, data = {}) => {
  try {
    let result = await axios?.post(
      constant?.baseUrl + path,
      data,
      getRequestConfig({ responseType: "blob" }),
    );

    return normalizeResponse(result);
  } catch (e) {
    return e;
  }
};

export const putApi = async (path, data, id) => {
  try {
    let result = await axios?.put(
      constant?.baseUrl + path,
      data,
      getRequestConfig(),
    );
    return normalizeResponse(result);
  } catch (e) {
    reportSave(e.response, path, { method: 'put' });
    return e;
  }
};

export const deleteApi = async (path, param) => {
  try {
    let result = await axios?.delete(
      constant?.baseUrl + path + param,
      getRequestConfig(),
    );
    return normalizeResponse(result);
  } catch (e) {
    return e;
  }
};

export const deleteManyApi = async (path, data) => {
  try {
    let result = await axios?.post(
      constant?.baseUrl + path,
      data,
      getRequestConfig(),
    );
    return normalizeResponse(result);
  } catch (e) {
    return e;
  }
};

export const getApi = async (path, id, options = {}) => {
  path = readVisibilityPath(path, getStoredUser());
  const url = constant?.baseUrl + path + (id || '');
  const config = getRequestConfig({ headers: options.dataScope === false ? {} : dataScopeHeaders(path) });
  const key = JSON.stringify([url, config.headers, readGeneration]);
  try {
    let request = pendingReads.get(key);
    if (!request) {
      request = axios.get(url, config);
      pendingReads.set(key, request);
      const cleanup = () => { if (pendingReads.get(key) === request) pendingReads.delete(key); };
      request.then(cleanup, cleanup);
    }
    const result = await request;
    // Consumers may sort, edit or freeze their result without changing another
    // component's copy of the same simultaneous response.
    return normalizeResponse({ ...result, data: copyData(result.data) });
  } catch (e) {
    return e;
  }
};

export const getApiBlob = async (path) => {
  try {
    const result = await axios.get(constant?.baseUrl + path, getRequestConfig({ responseType: "blob", headers: dataScopeHeaders(path) }));
    return normalizeResponse(result);
  } catch (e) {
    return e;
  }
};

export const downloadApiFile = async (path, filename) => {
  const result = await getApiBlob(path);
  if (result?.status !== 200) return result;
  const url = URL.createObjectURL(result.data);
  if (filename) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  } else {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return result;
};
