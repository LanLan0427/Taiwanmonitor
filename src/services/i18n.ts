import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { SITE_VARIANT } from '@/config/variant';

// English is always needed as fallback — bundle it eagerly.
import enTranslation from '../locales/en.json';

const SUPPORTED_LANGUAGES = ['en', 'cs', 'fr', 'de', 'el', 'es', 'it', 'pl', 'pt', 'nl', 'sv', 'ru', 'ar', 'zh', 'zh-TW', 'ja', 'ko', 'tr', 'th', 'vi'] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
type TranslationDictionary = Record<string, unknown>;

const SUPPORTED_LANGUAGE_SET = new Set<SupportedLanguage>(SUPPORTED_LANGUAGES);
const loadedLanguages = new Set<SupportedLanguage>();

// Lazy-load only the locale that's actually needed — all others stay out of the bundle.
const localeModules = import.meta.glob<TranslationDictionary>(
  ['../locales/*.json', '!../locales/en.json'],
  { import: 'default' },
);

const RTL_LANGUAGES = new Set(['ar']);

function normalizeLanguage(lng: string): SupportedLanguage {
  const raw = (lng || 'en').toLowerCase();
  // Preserve zh-TW as a distinct locale
  if (raw === 'zh-tw' || raw === 'zh-hant' || raw === 'zh-hant-tw') return 'zh-TW' as SupportedLanguage;
  const base = raw.split('-')[0] || 'en';
  if (SUPPORTED_LANGUAGE_SET.has(base as SupportedLanguage)) {
    return base as SupportedLanguage;
  }
  return 'en';
}

function applyDocumentDirection(lang: string): void {
  const normalized = normalizeLanguage(lang);
  const htmlLang = normalized === 'zh-TW' ? 'zh-TW' : normalized === 'zh' ? 'zh-CN' : normalized.split('-')[0] || normalized;
  document.documentElement.setAttribute('lang', htmlLang);
  if (RTL_LANGUAGES.has(normalized.split('-')[0] || normalized)) {
    document.documentElement.setAttribute('dir', 'rtl');
  } else {
    document.documentElement.removeAttribute('dir');
  }
}

async function ensureLanguageLoaded(lng: string): Promise<SupportedLanguage> {
  const normalized = normalizeLanguage(lng);
  if (loadedLanguages.has(normalized) && i18next.hasResourceBundle(normalized, 'translation')) {
    return normalized;
  }

  let translation: TranslationDictionary;
  if (normalized === 'en') {
    translation = enTranslation as TranslationDictionary;
  } else {
    const loader = localeModules[`../locales/${normalized}.json`];
    if (!loader) {
      console.warn(`No locale file for "${normalized}", falling back to English`);
      translation = enTranslation as TranslationDictionary;
    } else {
      translation = await loader();
    }
  }

  i18next.addResourceBundle(normalized, 'translation', translation, true, true);
  loadedLanguages.add(normalized);
  return normalized;
}

// Initialize i18n
export async function initI18n(): Promise<void> {
  if (i18next.isInitialized) {
    const currentLanguage = normalizeLanguage(i18next.language || 'en');
    await ensureLanguageLoaded(currentLanguage);
    applyDocumentDirection(i18next.language || currentLanguage);
    return;
  }

  loadedLanguages.add('en');

  await i18next
    .use(LanguageDetector)
    .init({
      resources: {
        en: { translation: enTranslation as TranslationDictionary },
      },
      supportedLngs: [...SUPPORTED_LANGUAGES],
      nonExplicitSupportedLngs: true,
      fallbackLng: 'en',
      debug: import.meta.env.DEV,
      interpolation: {
        escapeValue: false, // not needed for these simple strings
      },
      detection: {
        order: SITE_VARIANT === 'taiwan' ? ['localStorage'] : ['localStorage', 'navigator'],
        caches: ['localStorage'],
        ...(SITE_VARIANT === 'taiwan' ? { lookupLocalStorage: 'i18nextLng' } : {}),
      },
    });

  // For Taiwan variant, default to zh-TW if no user preference is stored
  const defaultLang = SITE_VARIANT === 'taiwan' && !localStorage.getItem('i18nextLng') ? 'zh-TW' : (i18next.language || 'en');
  const detectedLanguage = await ensureLanguageLoaded(defaultLang);
  if (detectedLanguage !== i18next.language) {
    await i18next.changeLanguage(detectedLanguage);
  }

  applyDocumentDirection(i18next.language || detectedLanguage);
}

// Helper to translate
export function t(key: string, options?: Record<string, unknown>): string {
  return i18next.t(key, options);
}

// Helper to change language
export async function changeLanguage(lng: string): Promise<void> {
  const normalized = await ensureLanguageLoaded(lng);
  await i18next.changeLanguage(normalized);
  applyDocumentDirection(normalized);
  window.location.reload(); // Simple reload to update all components for now
}

// Helper to get current language (normalized to short code, preserving zh-TW)
export function getCurrentLanguage(): string {
  const lang = i18next.language || 'en';
  // Preserve zh-TW as distinct from zh
  if (lang.toLowerCase().startsWith('zh-tw') || lang.toLowerCase().startsWith('zh-hant')) return 'zh-TW';
  return lang.split('-')[0]!;
}

export function isRTL(): boolean {
  return RTL_LANGUAGES.has(getCurrentLanguage());
}

export function getLocale(): string {
  const lang = getCurrentLanguage();
  if (lang === 'zh-TW' || lang === 'zh-tw') return 'zh-TW';
  const map: Record<string, string> = { en: 'en-US', cs: 'cs-CZ', el: 'el-GR', zh: 'zh-CN', pt: 'pt-BR', ja: 'ja-JP', ko: 'ko-KR', tr: 'tr-TR', th: 'th-TH', vi: 'vi-VN' };
  return map[lang] || lang;
}

export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'cs', label: 'Čeština', flag: '🇨🇿' },
  { code: 'zh', label: '中文（简体）', flag: '🇨🇳' },
  { code: 'zh-TW', label: '中文（繁體）', flag: '🇹🇼' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'el', label: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', label: 'Svenska', flag: '🇸🇪' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'th', label: 'ไทย', flag: '🇹🇭' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
];
