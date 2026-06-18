(function attachAntiChaosI18n(global) {
  const DEFAULT_LANGUAGE = "en";
  const SUPPORTED_LANGUAGES = ["en", "ru"];

  const DICTIONARIES = {
    en: {
      "popup.subtitle.loading": "Analyzing tabs...",
      "popup.aria.stats": "Tab statistics",
      "popup.aria.actions": "Actions",
      "popup.aria.settings": "Settings",
      "popup.aria.proposedGroups": "Suggested groups",
      "popup.stats.tabs": "tabs",
      "popup.stats.groups": "groups",
      "popup.stats.willGroup": "will group",
      "popup.action.group": "Group tabs",
      "popup.action.refresh": "Refresh",
      "popup.action.ungroup": "Ungroup",
      "popup.setting.autoGroup": "Auto grouping",
      "popup.setting.language": "Language",
      "popup.setting.window": "Window",
      "popup.setting.threshold": "Threshold",
      "popup.setting.minGroupSize": "Min. group",
      "popup.setting.ignorePinned": "Keep pinned tabs",
      "popup.setting.collapseGroups": "Collapse groups",
      "popup.language.browser": "Browser",
      "popup.language.english": "English",
      "popup.language.russian": "Русский",
      "popup.scope.currentWindow": "Current",
      "popup.scope.allWindows": "All windows",
      "popup.groups.heading": "Groups",
      "popup.groups.empty": "No groups of two or more tabs yet.",
      "popup.status.empty": "empty",
      "popup.status.found": "{count} found",
      "popup.status.autoEnabled": "Auto mode is on, threshold: {threshold}",
      "popup.status.canSuggest": "Some tabs can be collected into groups.",
      "popup.status.noSuggestion": "Open more similar tabs or lower the threshold.",
      "popup.status.grouping": "Grouping tabs...",
      "popup.status.ungrouping": "Ungrouping groups created by Anti-chaos tabs...",
      "popup.error.actionFailed": "Could not complete the action",

      "intent.laptops": "laptops",
      "intent.phones": "phones",
      "intent.monitors": "monitors",
      "intent.headphones": "headphones",
      "intent.clothes": "clothes",

      "group.office.excel": "Excel / spreadsheets",
      "group.office.word": "Word / documents",
      "group.office.powerpoint": "PowerPoint / presentations",
      "group.office.onedrive": "OneDrive / files",
      "group.google.sheets": "Google Sheets",
      "group.google.docs": "Google Docs",
      "group.google.slides": "Google Slides",
      "group.shoppingIntent": "Shopping: {intent}",
      "group.shoppingDomain": "Shopping: {domain}",
      "group.aiAssistants": "AI assistants",
      "group.development": "Development",
      "group.projectsTasks": "Projects and tasks",
      "group.workMaterials": "Work materials",
      "group.mail": "Mail",
      "group.meetings": "Meetings and calendar",
      "group.media": "Media",
      "group.social": "Social media",
      "group.learning": "Learning and references",
      "group.travel": "Travel and maps",
      "group.finance": "Finance",
      "group.news": "News",
      "group.topic": "Topic: {topic}",

      "reason.microsoftFileType": "shared Microsoft 365 file type",
      "reason.microsoftService": "shared Microsoft 365 service",
      "reason.googleWorkspaceType": "shared Google Workspace type",
      "reason.shoppingTopic": "shared shopping topic",
      "reason.shoppingStore": "shared store",
      "reason.aiService": "shared AI service",
      "reason.technicalTopic": "shared technical topic",
      "reason.workService": "shared work service",
      "reason.workDocs": "shared work documents",
      "reason.communicationType": "shared communication type",
      "reason.mediaService": "shared media service",
      "reason.socialService": "shared social service",
      "reason.learningTopic": "shared learning topic",
      "reason.travelTopic": "shared travel topic",
      "reason.financeTopic": "shared finance topic",
      "reason.siteType": "shared site type",
      "reason.titleTopic": "shared topic in tab titles",
      "reason.repeatedTitle": "repeated in tab titles",
      "reason.domain": "shared domain",

      "badge.autoTitle": "Anti-chaos tabs: auto grouping is on",
      "badge.suggestionsTitle": "Anti-chaos tabs: {count} groups found",
      "error.tabGroupsUnavailable": "Tab groups are not available in this browser.",
    },
    ru: {
      "popup.subtitle.loading": "Анализ вкладок...",
      "popup.aria.stats": "Статистика вкладок",
      "popup.aria.actions": "Действия",
      "popup.aria.settings": "Настройки",
      "popup.aria.proposedGroups": "Предложенные группы",
      "popup.stats.tabs": "вкладок",
      "popup.stats.groups": "групп",
      "popup.stats.willGroup": "войдут",
      "popup.action.group": "Сгруппировать",
      "popup.action.refresh": "Обновить",
      "popup.action.ungroup": "Разгруппировать",
      "popup.setting.autoGroup": "Авто-группировка",
      "popup.setting.language": "Язык",
      "popup.setting.window": "Окно",
      "popup.setting.threshold": "Порог",
      "popup.setting.minGroupSize": "Мин. группа",
      "popup.setting.ignorePinned": "Не трогать закрепленные",
      "popup.setting.collapseGroups": "Сворачивать группы",
      "popup.language.browser": "Браузер",
      "popup.language.english": "English",
      "popup.language.russian": "Русский",
      "popup.scope.currentWindow": "Текущее",
      "popup.scope.allWindows": "Все окна",
      "popup.groups.heading": "Группы",
      "popup.groups.empty": "Пока нет групп из двух и более вкладок.",
      "popup.status.empty": "пусто",
      "popup.status.found": "найдено: {count}",
      "popup.status.autoEnabled": "Авто-режим включен, порог: {threshold}",
      "popup.status.canSuggest": "Есть вкладки, которые можно собрать в группы.",
      "popup.status.noSuggestion": "Откройте больше похожих вкладок или снизьте порог.",
      "popup.status.grouping": "Группирую вкладки...",
      "popup.status.ungrouping": "Разгруппировываю группы, созданные Anti-chaos tabs...",
      "popup.error.actionFailed": "Не удалось выполнить действие",

      "intent.laptops": "ноутбуки",
      "intent.phones": "смартфоны",
      "intent.monitors": "мониторы",
      "intent.headphones": "наушники",
      "intent.clothes": "одежда",

      "group.office.excel": "Excel / таблицы",
      "group.office.word": "Word / документы",
      "group.office.powerpoint": "PowerPoint / презентации",
      "group.office.onedrive": "OneDrive / файлы",
      "group.google.sheets": "Google Sheets",
      "group.google.docs": "Google Docs",
      "group.google.slides": "Google Slides",
      "group.shoppingIntent": "Покупки: {intent}",
      "group.shoppingDomain": "Покупки: {domain}",
      "group.aiAssistants": "AI-ассистенты",
      "group.development": "Разработка",
      "group.projectsTasks": "Проекты и задачи",
      "group.workMaterials": "Рабочие материалы",
      "group.mail": "Почта",
      "group.meetings": "Встречи и календарь",
      "group.media": "Медиа",
      "group.social": "Соцсети",
      "group.learning": "Обучение и справки",
      "group.travel": "Поездки и карты",
      "group.finance": "Финансы",
      "group.news": "Новости",
      "group.topic": "Тема: {topic}",

      "reason.microsoftFileType": "общий тип файла Microsoft 365",
      "reason.microsoftService": "общий сервис Microsoft 365",
      "reason.googleWorkspaceType": "общий тип Google Workspace",
      "reason.shoppingTopic": "общая тема покупок",
      "reason.shoppingStore": "общий магазин",
      "reason.aiService": "общий AI-сервис",
      "reason.technicalTopic": "общая техническая тема",
      "reason.workService": "общий рабочий сервис",
      "reason.workDocs": "общие рабочие документы",
      "reason.communicationType": "общий тип коммуникации",
      "reason.mediaService": "общий медиа-сервис",
      "reason.socialService": "общий социальный сервис",
      "reason.learningTopic": "общая учебная тема",
      "reason.travelTopic": "общая тема поездок",
      "reason.financeTopic": "общая финансовая тема",
      "reason.siteType": "общий тип сайтов",
      "reason.titleTopic": "общая тема в заголовках",
      "reason.repeatedTitle": "повторяется в заголовках вкладок",
      "reason.domain": "общий домен",

      "badge.autoTitle": "Anti-chaos tabs: авто-группировка включена",
      "badge.suggestionsTitle": "Anti-chaos tabs: найдено групп: {count}",
      "error.tabGroupsUnavailable": "Группы вкладок недоступны в этом браузере.",
    },
  };

  function getBrowserLanguage() {
    const raw =
      global.chrome?.i18n?.getUILanguage?.() ||
      global.navigator?.language ||
      DEFAULT_LANGUAGE;
    const normalized = String(raw).toLowerCase();
    return normalized.startsWith("ru") ? "ru" : DEFAULT_LANGUAGE;
  }

  function resolveLanguage(language) {
    if (SUPPORTED_LANGUAGES.includes(language)) return language;
    return getBrowserLanguage();
  }

  function t(language, key, values = {}) {
    const resolvedLanguage = resolveLanguage(language);
    const dictionary = DICTIONARIES[resolvedLanguage] || DICTIONARIES[DEFAULT_LANGUAGE];
    const fallback = DICTIONARIES[DEFAULT_LANGUAGE][key] || key;
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
