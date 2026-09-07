import React from 'react';
import { translate, useLanguage } from './index';
export const tr = value => translate(value, localStorage.getItem('crm-language') || 'en');
export function LocalizedText({ text }) { const { t } = useLanguage(); return <>{t(text)}</>; }
export function withLocalization(Component) {
  function LocalizedComponent(props) { useLanguage(); return <Component {...props} />; }
  LocalizedComponent.displayName = `Localized(${Component.displayName || Component.name || 'Component'})`;
  return LocalizedComponent;
}
