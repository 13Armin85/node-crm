import axios from "axios";
import { constant } from "constant";
import { translate } from 'i18n';

const getRequestConfig = (config = {}) => ({
  ...config,
  headers: {
    Authorization:
      localStorage.getItem("token") || sessionStorage.getItem("token"),
    ...config.headers,
  },
  validateStatus: () => true,
});

const normalizeResponse = (result) => {
  const language = localStorage.getItem('crm-language') || 'en';
  if (result?.data && !Array.isArray(result.data) && typeof result.data === 'object') {
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
      getRequestConfig(),
    );
    if (result?.data?.token && result?.data?.token !== null) {
      if (login) {
        localStorage.setItem("token", result?.data?.token);
      } else {
        sessionStorage.setItem("token", result?.data?.token);
      }
      localStorage.setItem("user", JSON.stringify(result?.data?.user));
    }
    return normalizeResponse(result);
  } catch (e) {
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
    return e;
  }
};

export const deleteApi = async (path, param) => {
  try {
    let result = await axios?.delete(
      constant?.baseUrl + path + param,
      getRequestConfig(),
    );
    if (result?.data?.token && result?.data?.token !== null) {
      localStorage.setItem("token", result?.data?.token);
    }
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
    if (result?.data?.token && result?.data?.token !== null) {
      localStorage.setItem("token", result?.data?.token);
    }
    return normalizeResponse(result);
  } catch (e) {
    return e;
  }
};

export const getApi = async (path, id) => {
  try {
    if (id) {
      let result = await axios?.get(
        constant?.baseUrl + path + id,
        getRequestConfig(),
      );
      return normalizeResponse(result);
    } else {
      let result = await axios?.get(
        constant?.baseUrl + path,
        getRequestConfig(),
      );
      return normalizeResponse(result);
    }
  } catch (e) {
    return e;
  }
};
