import React from 'react';
import { clearRecordCache } from 'services/recordCache';

const messages = {
  en: ['The page could not be loaded', 'Please try again. Your saved records are safe.', 'Try again'],
  fa: ['صفحه بارگذاری نشد', 'دوباره تلاش کنید. اطلاعات ثبت‌شدهٔ شما محفوظ است.', 'تلاش دوباره'],
  tr: ['Sayfa yüklenemedi', 'Lütfen tekrar deneyin. Kaydedilen verileriniz güvende.', 'Tekrar dene'],
};

export default class AppErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error) {
    console.error('Application render failed', error);
    window.crmAppStarted?.();
    window.crmRecoverAsset?.(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    let language = 'en';
    try { language = localStorage.getItem('crm-language') || language; } catch (_) {}
    const copy = messages[language] || messages.en;
    return (
      <main role="alert" dir={language === 'fa' ? 'rtl' : 'ltr'} style={{ maxWidth: 480, margin: '15vh auto', padding: 24, fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22 }}>{copy[0]}</h1>
        <p>{copy[1]}</p>
        <button onClick={() => { clearRecordCache(); window.location.reload(); }} style={{ padding: '12px 24px', cursor: 'pointer' }}>{copy[2]}</button>
      </main>
    );
  }
}
