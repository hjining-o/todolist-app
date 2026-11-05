import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import zh from './locales/zh.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ko: { translation: ko }, en: { translation: en }, zh: { translation: zh }, ja: { translation: ja } },
    supportedLngs: ['ko', 'en', 'zh', 'ja'],
    fallbackLng: 'ko',
    load: 'languageOnly', // zh-CN -> zh
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: 'lang', caches: ['localStorage'] },
  })

export default i18n
