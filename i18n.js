(function attachAntiChaosI18n(global) {
  const DEFAULT_LANGUAGE = "en";
  const LANGUAGE_ALIASES = {
    "pt-br": "pt_BR",
    "pt_br": "pt_BR",
    "pt-pt": "pt_PT",
    "pt_pt": "pt_PT",
  };
  const DICTIONARIES = global.AntiChaosLocales || {};
  if (!DICTIONARIES.pt && DICTIONARIES.pt_BR) {
    DICTIONARIES.pt = DICTIONARIES.pt_BR;
  }
  const SUPPORTED_LANGUAGES = [
    "en",
    "ru",
    "es",
    "fr",
    "de",
    "pt",
    "pt_BR",
    "pt_PT",
    "it",
  ].filter(
    (language) => DICTIONARIES[language],
  );

  function normalizeLanguage(language) {
    const normalized = String(language || DEFAULT_LANGUAGE).toLowerCase();
    return LANGUAGE_ALIASES[normalized] || normalized.split(/[-_]/)[0];
  }

  function getBrowserLanguage() {
    const raw =
      global.chrome?.i18n?.getUILanguage?.() ||
      global.navigator?.language ||
      DEFAULT_LANGUAGE;
    const language = normalizeLanguage(raw);
    return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
  }

  function resolveLanguage(language) {
    const normalized = normalizeLanguage(language);
    if (SUPPORTED_LANGUAGES.includes(normalized)) return normalized;
    return getBrowserLanguage();
  }

  function t(language, key, values = {}) {
    const resolvedLanguage = resolveLanguage(language);
    const dictionary = DICTIONARIES[resolvedLanguage] || DICTIONARIES[DEFAULT_LANGUAGE] || {};
    const fallbackDictionary = DICTIONARIES[DEFAULT_LANGUAGE] || {};
    const fallback = fallbackDictionary[key] || key;
    const template = dictionary[key] || fallback;

    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
    );
  }

  global.AntiChaosI18n = {
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    getBrowserLanguage,
    resolveLanguage,
    t,
  };
})(globalThis);
