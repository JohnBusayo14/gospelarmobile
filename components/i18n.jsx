import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources: {
    en: { translation: { "welcome": "Welcome", "start_quiz": "Start Quiz" } },
    yo: { translation: { "welcome": "Kábọ̀", "start_quiz": "Bẹ̀rẹ̀ Ìdánwò" } },
    fr: { translation: { "welcome": "Bienvenue", "start_quiz": "Commencer le quiz" } },
  },
  lng: 'en', // default language
  fallbackLng: 'en',
});