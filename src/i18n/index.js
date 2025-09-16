/**
 * @fileoverview 国际化配置 - 配置i18next多语言支持
 *
 * 支持中文和英文两种语言，自动检测用户语言偏好
 *
 * @author hhyufan
 * @version 1.2.0
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

const resources = {
  'zh-CN': {
    translation: zhCN
  },
  'en-US': {
    translation: enUS
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh-CN',
    debug: process.env.NODE_ENV === 'development',

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'miaogu-notepad-language'
    },

    interpolation: {
      escapeValue: false
    },

    defaultNS: 'translation',
    ns: ['translation']
  });

export const getI18n = () => {
  return {
    t: i18n.t.bind(i18n)
  };
};

export default i18n;
