import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../locales/translations';

// Storage key for language preference
const LANGUAGE_KEY = 'appLanguage';

// Current language state
let currentLanguage = 'en';

// Listeners for language changes
let languageChangeListeners = [];

/**
 * Add a listener for language changes
 * @param {function} callback - Function to call when language changes
 * @returns {function} - Function to remove the listener
 */
export const addLanguageChangeListener = (callback) => {
  languageChangeListeners.push(callback);
  return () => {
    languageChangeListeners = languageChangeListeners.filter(listener => listener !== callback);
  };
};

/**
 * Notify all listeners of language change
 */
const notifyLanguageChange = () => {
  languageChangeListeners.forEach(callback => callback(currentLanguage));
};

/**
 * Load saved language preference from AsyncStorage
 * @returns {Promise<string>} Current language code (en/ta)
 */
export const loadLanguage = async () => {
  try {
    const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (savedLang && (savedLang === 'en' || savedLang === 'ta')) {
      currentLanguage = savedLang;
    } else {
      currentLanguage = 'en';
    }
    return currentLanguage;
  } catch (error) {
    console.error('Error loading language:', error);
    currentLanguage = 'en';
    return currentLanguage;
  }
};

/**
 * Save language preference to AsyncStorage
 * @param {string} lang - Language code (en/ta)
 */
export const setLanguage = async (lang) => {
  try {
    currentLanguage = lang;
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    notifyLanguageChange();
  } catch (error) {
    console.error('Error saving language:', error);
  }
};

/**
 * Get current language
 * @returns {string} Current language code
 */
export const getCurrentLanguage = () => currentLanguage;

/**
 * Toggle between English and Tamil
 * @returns {Promise<string>} New language code
 */
export const toggleLanguage = async () => {
  const newLang = currentLanguage === 'en' ? 'ta' : 'en';
  await setLanguage(newLang);
  return newLang;
};

/**
 * Get translations for current language
 * @returns {object} Translations object
 */
export const getTranslations = () => translations[currentLanguage];

/**
 * Get translations for specific language
 * @param {string} lang - Language code (en/ta)
 * @returns {object} Translations object
 */
export const getTranslationsForLanguage = (lang) => translations[lang];

// Export translations directly
export { translations };

// For backward compatibility
const i18n = {
  translations: translations,
  locale: currentLanguage,
};

export default i18n;