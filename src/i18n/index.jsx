import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import en from './en.json';
import fr from './fr.json';

const translations = { en, fr };

const dateLocales = {
  en: 'en-GB',
  fr: 'fr-FR',
};

export const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
];

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => localStorage.getItem('locale') || 'en');

  const setLocale = useCallback((code) => {
    setLocaleState(code);
    localStorage.setItem('locale', code);
  }, []);

  const t = useCallback((key, params) => {
    let str = translations[locale]?.[key] || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      });
    }
    return str;
  }, [locale]);

  const dateLocale = dateLocales[locale] || 'en-GB';

  const value = useMemo(() => ({ t, locale, setLocale, dateLocale }), [t, locale, setLocale, dateLocale]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
