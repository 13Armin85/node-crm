/* Keep recovery independent of React and of the versioned application bundle. */
(function () {
  'use strict';
  // Some browser privacy settings deny Web Storage. Keep the app usable for this tab.
  function ensureStorage(name) {
    var nativeStorage;
    var values = Object.create(null);
    try {
      nativeStorage = window[name];
      var probe = 'crm:storage-probe';
      nativeStorage.setItem(probe, probe);
      nativeStorage.removeItem(probe);
      return;
    } catch (_) {}
    try {
      for (var i = 0; nativeStorage && i < nativeStorage.length; i++) {
        var key = nativeStorage.key(i);
        values[key] = nativeStorage.getItem(key);
      }
    } catch (_) {}
    var fallback = {
      getItem: function (key) { key = String(key); return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
      setItem: function (key, value) { values[String(key)] = String(value); try { nativeStorage.setItem(key, value); } catch (_) {} },
      removeItem: function (key) { delete values[String(key)]; try { nativeStorage.removeItem(key); } catch (_) {} },
      clear: function () { values = Object.create(null); try { nativeStorage.clear(); } catch (_) {} },
      key: function (index) { return Object.keys(values)[index] || null; }
    };
    Object.defineProperty(fallback, 'length', { get: function () { return Object.keys(values).length; } });
    try { Object.defineProperty(window, name, { configurable: true, value: fallback }); } catch (_) {}
  }
  ensureStorage('localStorage');
  ensureStorage('sessionStorage');
  var started = false;
  var retrying = false;
  var copy = {
    en: ['Loading the application…', 'The page could not be loaded. Check your connection and try again.', 'Try again'],
    fa: ['در حال بارگذاری برنامه…', 'صفحه بارگذاری نشد. اتصال اینترنت را بررسی و دوباره تلاش کنید.', 'تلاش دوباره'],
    tr: ['Uygulama yükleniyor…', 'Sayfa yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.', 'Tekrar dene']
  };
  var language = 'en';
  try { language = window.localStorage.getItem('crm-language') || language; } catch (_) {}
  var text = copy[language] || copy.en;

  function retry() {
    var url = new URL(window.location.href);
    url.searchParams.set('_crm_retry', String(Date.now()));
    window.location.replace(url.href);
  }

  function showRecovery() {
    var panel = document.getElementById('crm-startup-recovery');
    if (!panel) return;
    panel.hidden = false;
    panel.dir = language === 'fa' ? 'rtl' : 'ltr';
    document.getElementById('crm-startup-message').textContent = text[1];
    var button = document.getElementById('crm-startup-retry');
    button.textContent = text[2];
    button.onclick = retry;
  }

  function assetFailed() {
    if (retrying) return;
    // The URL marker also bounds retries when browser storage is disabled.
    if (!new URL(window.location.href).searchParams.has('_crm_retry') && navigator.onLine !== false) {
      retrying = true;
      retry();
    } else showRecovery();
  }

  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target.tagName === 'SCRIPT' && /\/static\/js\//.test(target.src || '')) assetFailed();
  }, true);
  window.crmRecoverAsset = function (error) {
    if (/ChunkLoadError|Loading (?:CSS )?chunk [\s\S]*failed/i.test(String(error && (error.message || error)))) assetFailed();
  };
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    if (/ChunkLoadError|Loading (?:CSS )?chunk [\s\S]*failed/i.test(String(reason && (reason.message || reason)))) assetFailed();
  });

  var timeout = window.setTimeout(function () { if (!started) showRecovery(); }, 20000);
  window.crmAppStarted = function () {
    started = true;
    window.clearTimeout(timeout);
    var panel = document.getElementById('crm-startup-recovery');
    if (panel) panel.hidden = true;
  };
  document.addEventListener('DOMContentLoaded', function () {
    var loading = document.getElementById('crm-startup-loading');
    if (loading) loading.textContent = text[0];
  });
}());
