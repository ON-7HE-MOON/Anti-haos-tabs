importScripts(
  "_locales/en/app.js",
  "_locales/ru/app.js",
  "_locales/es/app.js",
  "_locales/fr/app.js",
  "_locales/de/app.js",
  "_locales/pt_BR/app.js",
  "_locales/it/app.js",
  "i18n.js",
);

const SETTINGS_KEY = "antiChaosSettings";
const MANAGED_GROUPS_KEY = "antiChaosManagedGroups";
const COLLAPSE_LOCKED_GROUPS_KEY = "antiChaosCollapseLockedGroups";
const ACTIVE_GROUP_BY_WINDOW_KEY = "antiChaosActiveGroupByWindow";
const TOGGLE_COLLAPSE_LOCK_MENU_ID = "antiChaosToggleCollapseLock";
const TAB_GROUP_ID_NONE = -1;

const DEFAULT_SETTINGS = {
  autoGroup: false,
  threshold: 8,
  minGroupSize: 2,
  scope: "currentWindow",
  language: "auto",
  ignorePinned: true,
  collapseGroups: false,
};

const COLORS = {
  ai: "purple",
  commerce: "orange",
  dev: "blue",
  docs: "cyan",
  education: "green",
  finance: "green",
  mail: "blue",
  maps: "green",
  media: "pink",
  meetings: "blue",
  news: "yellow",
  office: "green",
  project: "purple",
  social: "pink",
  topic: "purple",
  travel: "cyan",
  domain: "grey",
};

const COMMON_SECOND_LEVEL_TLDS = new Set([
  "ac",
  "co",
  "com",
  "edu",
  "gov",
  "net",
  "org",
]);

const INTERNAL_PROTOCOLS = new Set([
  "about:",
  "brave:",
  "chrome:",
  "chrome-extension:",
  "devtools:",
  "edge:",
  "opera:",
  "vivaldi:",
]);

const MARKETPLACES = [
  "amazon.",
  "ebay.",
  "aliexpress.",
  "temu.",
  "etsy.",
  "walmart.",
  "bestbuy.",
  "target.",
  "newegg.",
  "kaspi.",
  "ozon.",
  "wildberries.",
  "market.yandex.",
  "shop.",
];

const PRODUCT_INTENTS = [
  {
    key: "laptops",
    terms: [
      "laptop",
      "notebook",
      "macbook",
      "ultrabook",
      "thinkpad",
      "ideapad",
      "vivobook",
      "ноутбук",
      "ноутбуки",
      "ультрабук",
      "макбук",
    ],
  },
  {
    key: "phones",
    terms: ["iphone", "android", "phone", "smartphone", "pixel", "galaxy", "телефон", "смартфон"],
  },
  {
    key: "monitors",
    terms: ["monitor", "display", "oled", "ips", "монитор", "дисплей"],
  },
  {
    key: "headphones",
    terms: ["headphones", "earbuds", "airpods", "наушники", "гарнитура"],
  },
  {
    key: "clothes",
    terms: ["shirt", "sneakers", "hoodie", "dress", "shoes", "одежда", "кроссовки", "рубашка"],
  },
];

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "all",
  "also",
  "and",
  "are",
  "best",
  "buy",
  "can",
  "com",
  "default",
  "doc",
  "docs",
  "for",
  "from",
  "google",
  "home",
  "how",
  "into",
  "login",
  "more",
  "new",
  "official",
  "online",
  "open",
  "page",
  "pages",
  "price",
  "sale",
  "search",
  "shop",
  "site",
  "store",
  "that",
  "the",
  "this",
  "with",
  "your",
  "авторизация",
  "главная",
  "купить",
  "магазин",
  "новый",
  "онлайн",
  "официальный",
  "поиск",
  "страница",
  "цена",
]);

let autoGroupTimer = null;
let lastAutoGroupAt = 0;
let groupingInProgress = false;
let contextMenuSetupPromise = null;
let lastFocusedWindowId = null;
const activeGroupByWindowId = new Map();
const preferredOpenGroupByWindowId = new Map();
const PREFERRED_OPEN_GROUP_MS = 1000;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function resolveDisplayLanguage(settings = {}) {
  return AntiChaosI18n.resolveLanguage(settings.language);
}

function tr(language, key, values) {
  return AntiChaosI18n.t(language, key, values);
}

function normalizeSettings(raw = {}) {
  const threshold = Number.parseInt(raw.threshold, 10);
  const minGroupSize = Number.parseInt(raw.minGroupSize, 10);

  return {
    autoGroup: Boolean(raw.autoGroup),
    threshold: Number.isFinite(threshold) ? clamp(threshold, 3, 80) : DEFAULT_SETTINGS.threshold,
    minGroupSize: Number.isFinite(minGroupSize)
      ? clamp(minGroupSize, 2, 12)
      : DEFAULT_SETTINGS.minGroupSize,
    scope: raw.scope === "allWindows" ? "allWindows" : "currentWindow",
    language:
      raw.language === "auto" ||
      AntiChaosI18n.SUPPORTED_LANGUAGES.includes(raw.language)
        ? raw.language
        : "auto",
    ignorePinned: raw.ignorePinned !== false,
    collapseGroups: Boolean(raw.collapseGroups),
  };
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return normalizeSettings({
    ...DEFAULT_SETTINGS,
    ...(stored[SETTINGS_KEY] || {}),
  });
}

async function saveSettings(partial) {
  const next = normalizeSettings({
    ...(await getSettings()),
    ...partial,
  });
  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  return next;
}

const groupLockKey = (groupId) => String(groupId);
const activeGroupStorage = () => chrome.storage.session || chrome.storage.local;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function rememberPreferredOpenGroup(windowId, groupId) {
  if (
    typeof windowId !== "number" ||
    typeof groupId !== "number" ||
    groupId === TAB_GROUP_ID_NONE
  ) {
    return;
  }

  preferredOpenGroupByWindowId.set(windowId, {
    groupId,
    at: Date.now(),
  });
}

function getFreshPreferredOpenGroup(windowId) {
  const entry = preferredOpenGroupByWindowId.get(windowId);
  if (!entry) return TAB_GROUP_ID_NONE;

  if (Date.now() - entry.at > PREFERRED_OPEN_GROUP_MS) {
    preferredOpenGroupByWindowId.delete(windowId);
    return TAB_GROUP_ID_NONE;
  }

  return entry.groupId;
}

async function getStoredActiveGroupsByWindow() {
  const stored = await activeGroupStorage().get(ACTIVE_GROUP_BY_WINDOW_KEY);
  return stored[ACTIVE_GROUP_BY_WINDOW_KEY] || {};
}

async function getStoredActiveGroupForWindow(windowId) {
  const groupsByWindow = await getStoredActiveGroupsByWindow();
  const value = groupsByWindow[String(windowId)];
  return typeof value === "number" ? value : undefined;
}

async function setStoredActiveGroupForWindow(windowId, groupId) {
  const groupsByWindow = await getStoredActiveGroupsByWindow();
  groupsByWindow[String(windowId)] =
    typeof groupId === "number" ? groupId : TAB_GROUP_ID_NONE;
  await activeGroupStorage().set({
    [ACTIVE_GROUP_BY_WINDOW_KEY]: groupsByWindow,
  });
}

async function getCollapseLockedGroupKeys() {
  const stored = await chrome.storage.local.get(COLLAPSE_LOCKED_GROUPS_KEY);
  return Array.isArray(stored[COLLAPSE_LOCKED_GROUPS_KEY])
    ? stored[COLLAPSE_LOCKED_GROUPS_KEY]
    : [];
}

async function setCollapseLockedGroupKeys(keys) {
  await chrome.storage.local.set({
    [COLLAPSE_LOCKED_GROUPS_KEY]: [...new Set(keys.map(String))],
  });
}

async function isGroupCollapseLocked(groupId) {
  const keys = await getCollapseLockedGroupKeys();
  return keys.includes(groupLockKey(groupId));
}

async function removeCollapseLock(groupId) {
  const key = groupLockKey(groupId);
  const keys = await getCollapseLockedGroupKeys();
  await setCollapseLockedGroupKeys(keys.filter((item) => item !== key));
}

async function shouldCollapseGroup(groupId, settings) {
  return settings.collapseGroups && !(await isGroupCollapseLocked(groupId));
}

async function applyCollapsePreferenceToVisibleGroups(settings) {
  if (!settings.collapseGroups || !chrome.tabGroups) return;

  const tabs = await queryTabsForSettings(settings);
  const windowIds = [
    ...new Set(
      tabs
        .map((tab) => tab.windowId)
        .filter((windowId) => typeof windowId === "number"),
    ),
  ];

  for (const windowId of windowIds) {
    const activeTab = await getActiveTabInWindow(windowId).catch(() => null);
    const keepGroupId =
      typeof activeTab?.groupId === "number" ? activeTab.groupId : TAB_GROUP_ID_NONE;
    await collapseGroupsInWindowExcept(windowId, keepGroupId, settings);
  }
}

async function collapseGroupIfAllowed(groupId, settings) {
  if (
    !chrome.tabGroups ||
    typeof groupId !== "number" ||
    groupId === TAB_GROUP_ID_NONE ||
    !(await shouldCollapseGroup(groupId, settings))
  ) {
    return;
  }

  try {
    await chrome.tabGroups.update(groupId, { collapsed: true });
  } catch (error) {
    console.warn("Anti-chaos tabs: failed to collapse a tab group", error);
  }
}

async function collapseGroupsInWindowExcept(windowId, keepGroupId, settings) {
  if (!settings.collapseGroups || !chrome.tabGroups || typeof windowId !== "number") {
    return;
  }

  const tabs = await chrome.tabs.query({ windowId });
  const groupIds = [
    ...new Set(
      tabs
        .map((tab) => tab.groupId)
        .filter((groupId) => typeof groupId === "number" && groupId !== TAB_GROUP_ID_NONE),
    ),
  ];

  for (const groupId of groupIds) {
    if (groupId === keepGroupId) continue;
    await collapseGroupIfAllowed(groupId, settings);
  }
}

async function getActiveTabInWindow(windowId) {
  const tabs = await chrome.tabs.query({ active: true, windowId });
  return tabs[0] || null;
}

async function rememberActiveGroupForWindow(windowId) {
  if (typeof windowId !== "number") return TAB_GROUP_ID_NONE;

  const activeTab = await getActiveTabInWindow(windowId).catch(() => null);
  const groupId =
    typeof activeTab?.groupId === "number" ? activeTab.groupId : TAB_GROUP_ID_NONE;

  activeGroupByWindowId.set(windowId, groupId);
  await setStoredActiveGroupForWindow(windowId, groupId);
  return groupId;
}

async function refreshActiveGroupSnapshot() {
  const windows = await chrome.windows.getAll({ windowTypes: ["normal"] });
  for (const win of windows) {
    if (typeof win.id === "number") {
      await rememberActiveGroupForWindow(win.id);
    }
  }

  const focused = await chrome.windows.getLastFocused({ windowTypes: ["normal"] }).catch(() => null);
  lastFocusedWindowId = typeof focused?.id === "number" ? focused.id : null;
}

async function handleActiveTabChanged(activeInfo) {
  await wait(80);

  const settings = await getSettings();
  const tab = await getActiveTabInWindow(activeInfo.windowId).catch(() => null);
  const nextGroupId =
    typeof tab?.groupId === "number" ? tab.groupId : TAB_GROUP_ID_NONE;
  const keepGroupId =
    nextGroupId === TAB_GROUP_ID_NONE
      ? getFreshPreferredOpenGroup(activeInfo.windowId)
      : nextGroupId;

  activeGroupByWindowId.set(activeInfo.windowId, nextGroupId);
  await setStoredActiveGroupForWindow(activeInfo.windowId, nextGroupId);

  if (nextGroupId !== TAB_GROUP_ID_NONE) {
    rememberPreferredOpenGroup(activeInfo.windowId, nextGroupId);
  }

  await collapseGroupsInWindowExcept(activeInfo.windowId, keepGroupId, settings);
}

async function handleWindowFocusChanged(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE || typeof windowId !== "number") {
    return;
  }

  lastFocusedWindowId = windowId;
  await rememberActiveGroupForWindow(windowId);
}

async function handleTabGroupUpdated(group) {
  if (!group || group.collapsed || typeof group.id !== "number") return;

  await wait(80);

  const settings = await getSettings();
  if (!settings.collapseGroups) return;

  rememberPreferredOpenGroup(group.windowId, group.id);
  await collapseGroupsInWindowExcept(group.windowId, group.id, settings);
}

async function setupContextMenus(settings = null) {
  if (!chrome.contextMenus) return;

  const normalized = settings ? normalizeSettings(settings) : await getSettings();
  const language = resolveDisplayLanguage(normalized);

  await new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => resolve());
  });

  await new Promise((resolve) => {
    chrome.contextMenus.create(
      {
        id: TOGGLE_COLLAPSE_LOCK_MENU_ID,
        title: tr(language, "context.toggleCollapseLock"),
        contexts: ["tab"],
      },
      () => resolve(),
    );
  });
}

function ensureContextMenus(settings = null) {
  if (!chrome.contextMenus) return Promise.resolve();

  if (!contextMenuSetupPromise) {
    contextMenuSetupPromise = setupContextMenus(settings).finally(() => {
      contextMenuSetupPromise = null;
    });
  }

  return contextMenuSetupPromise;
}

async function toggleCollapseLockForTab(tab) {
  if (!tab || typeof tab.groupId !== "number" || tab.groupId === TAB_GROUP_ID_NONE) {
    return;
  }

  const groupId = tab.groupId;
  const key = groupLockKey(groupId);
  const keys = await getCollapseLockedGroupKeys();
  const isLocked = keys.includes(key);
  const nextKeys = isLocked
    ? keys.filter((item) => item !== key)
    : [...keys, key];

  await setCollapseLockedGroupKeys(nextKeys);

  const settings = await getSettings();
  try {
    await chrome.tabGroups.update(groupId, {
      collapsed: !isLocked && settings.collapseGroups ? false : settings.collapseGroups,
    });
  } catch (error) {
    console.warn("Anti-chaos tabs: failed to update collapse lock state", error);
  }
}

async function setGroupCollapseLock(groupId, locked) {
  if (!Number.isFinite(groupId) || groupId === TAB_GROUP_ID_NONE) return;

  const key = groupLockKey(groupId);
  const keys = await getCollapseLockedGroupKeys();
  const nextKeys = locked
    ? [...keys, key]
    : keys.filter((item) => item !== key);

  await setCollapseLockedGroupKeys(nextKeys);

  const settings = await getSettings();
  if (!locked) {
    await collapseGroupIfAllowed(groupId, settings);
  } else {
    await chrome.tabGroups.update(groupId, { collapsed: false }).catch(() => null);
  }
}

async function getCurrentTabGroupLocks(settings = null) {
  const normalized = settings ? normalizeSettings(settings) : await getSettings();
  const tabs = await queryTabsForSettings(normalized);
  const groupCounts = new Map();

  for (const tab of tabs) {
    if (typeof tab.groupId !== "number" || tab.groupId === TAB_GROUP_ID_NONE) continue;
    groupCounts.set(tab.groupId, (groupCounts.get(tab.groupId) || 0) + 1);
  }

  const lockedKeys = await getCollapseLockedGroupKeys();
  const tabGroups = await chrome.tabGroups.query({});
  const tabGroupsById = new Map(tabGroups.map((group) => [group.id, group]));
  const groups = [];

  for (const [groupId, tabCount] of groupCounts.entries()) {
    const group = tabGroupsById.get(groupId);
    if (!group) continue;

    groups.push({
      id: groupId,
      title: group.title || `Group ${groupId}`,
      color: group.color || "grey",
      tabCount,
      locked: lockedKeys.includes(groupLockKey(groupId)),
    });
  }

  return groups.sort((a, b) => a.title.localeCompare(b.title));
}

async function getLastFocusedWindowId() {
  const win = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  return win?.id;
}

async function queryTabsForSettings(settings) {
  if (settings.scope === "allWindows") {
    return chrome.tabs.query({ windowType: "normal" });
  }

  const windowId = await getLastFocusedWindowId();
  if (typeof windowId !== "number") return [];
  return chrome.tabs.query({ windowId });
}

function parseTabUrl(tab) {
  if (!tab.url) return null;

  try {
    const url = new URL(tab.url);
    if (INTERNAL_PROTOCOLS.has(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

function rootDomainFromHost(hostname) {
  const cleanHost = hostname.toLowerCase().replace(/^www\./, "");
  if (!cleanHost || cleanHost === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(cleanHost)) {
    return cleanHost;
  }

  const parts = cleanHost.split(".").filter(Boolean);
  if (parts.length <= 2) return cleanHost;

  const second = parts[parts.length - 2];
  const top = parts[parts.length - 1];
  if (COMMON_SECOND_LEVEL_TLDS.has(second) && top.length <= 3) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

function titleCase(value) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

function prettyDomain(domain) {
  const base = domain.replace(/^www\./, "").split(".")[0] || domain;
  const known = {
    aliexpress: "AliExpress",
    amazon: "Amazon",
    apple: "Apple",
    asana: "Asana",
    atlassian: "Atlassian",
    azure: "Azure",
    bestbuy: "Best Buy",
    bing: "Bing",
    chatgpt: "ChatGPT",
    confluence: "Confluence",
    coursera: "Coursera",
    ebay: "eBay",
    figma: "Figma",
    github: "GitHub",
    gitlab: "GitLab",
    gmail: "Gmail",
    google: "Google",
    kaspi: "Kaspi",
    linkedin: "LinkedIn",
    microsoft: "Microsoft",
    miro: "Miro",
    netflix: "Netflix",
    notion: "Notion",
    office: "Office",
    outlook: "Outlook",
    ozon: "Ozon",
    perplexity: "Perplexity",
    reddit: "Reddit",
    sharepoint: "SharePoint",
    slack: "Slack",
    stackoverflow: "Stack Overflow",
    telegram: "Telegram",
    temu: "Temu",
    trello: "Trello",
    walmart: "Walmart",
    wildberries: "Wildberries",
    wikipedia: "Wikipedia",
    x: "X",
    youtube: "YouTube",
  };

  return known[base] || titleCase(base);
}

function textFor(tab, url) {
  const searchText = [];
  for (const key of ["q", "query", "search", "k", "p", "text"]) {
    const value = url.searchParams.get(key);
    if (value) searchText.push(value);
  }

  return `${tab.title || ""} ${url.hostname} ${url.pathname} ${searchText.join(" ")}`.toLowerCase();
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function findProductIntent(text) {
  return PRODUCT_INTENTS.find((intent) => hasAny(text, intent.terms)) || null;
}

function isMarketplace(hostname) {
  const host = hostname.toLowerCase();
  return MARKETPLACES.some((market) => host.includes(market));
}

function officeAppClassification(hostname, text, language) {
  const isOfficeHost =
    hostname.includes("office.com") ||
    hostname.includes("officeapps.live.com") ||
    hostname.includes("onedrive.live.com") ||
    hostname.includes("sharepoint.com") ||
    hostname.includes("microsoft365.com");

  if (!isOfficeHost) return null;

  if (hasAny(text, ["excel", "xlsx", "xlsm", "spreadsheet", "workbook", "таблиц"])) {
    return {
      key: "office:excel",
      title: tr(language, "group.office.excel"),
      color: COLORS.office,
      priority: 10,
      reason: tr(language, "reason.microsoftFileType"),
      strong: true,
    };
  }

  if (hasAny(text, ["word", "docx", "document", "документ"])) {
    return {
      key: "office:word",
      title: tr(language, "group.office.word"),
      color: "blue",
      priority: 11,
      reason: tr(language, "reason.microsoftFileType"),
      strong: true,
    };
  }

  if (hasAny(text, ["powerpoint", "pptx", "presentation", "презентац"])) {
    return {
      key: "office:powerpoint",
      title: tr(language, "group.office.powerpoint"),
      color: "orange",
      priority: 12,
      reason: tr(language, "reason.microsoftFileType"),
      strong: true,
    };
  }

  return {
    key: "office:onedrive",
    title: tr(language, "group.office.onedrive"),
    color: COLORS.docs,
    priority: 19,
    reason: tr(language, "reason.microsoftService"),
    strong: true,
  };
}

function googleDocsClassification(hostname, text, language) {
  if (!hostname.includes("docs.google.com")) return null;

  if (text.includes("/spreadsheets/") || hasAny(text, ["sheets", "spreadsheet"])) {
    return {
      key: "google:sheets",
      title: tr(language, "group.google.sheets"),
      color: "green",
      priority: 13,
      reason: tr(language, "reason.googleWorkspaceType"),
      strong: true,
    };
  }

  if (text.includes("/document/") || text.includes("docs")) {
    return {
      key: "google:docs",
      title: tr(language, "group.google.docs"),
      color: "blue",
      priority: 14,
      reason: tr(language, "reason.googleWorkspaceType"),
      strong: true,
    };
  }

  if (text.includes("/presentation/") || text.includes("slides")) {
    return {
      key: "google:slides",
      title: tr(language, "group.google.slides"),
      color: "orange",
      priority: 15,
      reason: tr(language, "reason.googleWorkspaceType"),
      strong: true,
    };
  }

  return null;
}

function semanticClassification(tab, url, rootDomain, text, language) {
  const hostname = url.hostname.toLowerCase();
  const office = officeAppClassification(hostname, text, language);
  if (office) return office;

  const googleDocs = googleDocsClassification(hostname, text, language);
  if (googleDocs) return googleDocs;

  const productIntent = findProductIntent(text);
  if (isMarketplace(hostname)) {
    if (productIntent) {
      return {
        key: `shopping:${productIntent.key}`,
        title: tr(language, "group.shoppingIntent", {
          intent: tr(language, `intent.${productIntent.key}`),
        }),
        color: COLORS.commerce,
        priority: 20,
        reason: tr(language, "reason.shoppingTopic"),
        strong: true,
      };
    }

    return {
      key: `shopping:${rootDomain}`,
      title: tr(language, "group.shoppingDomain", {
        domain: prettyDomain(rootDomain),
      }),
      color: COLORS.commerce,
      priority: 29,
      reason: tr(language, "reason.shoppingStore"),
      strong: true,
    };
  }

  if (
    hasAny(hostname, ["chat.openai.com", "chatgpt.com", "claude.ai", "gemini.google.com", "perplexity.ai"])
  ) {
    return {
      key: "ai:assistants",
      title: tr(language, "group.aiAssistants"),
      color: COLORS.ai,
      priority: 30,
      reason: tr(language, "reason.aiService"),
      strong: true,
    };
  }

  if (
    hasAny(hostname, ["github.com", "gitlab.com", "bitbucket.org", "stackoverflow.com", "stackexchange.com"]) ||
    hasAny(text, ["npm", "react", "typescript", "javascript", "python", "api docs", "sdk", "docker"])
  ) {
    return {
      key: "work:development",
      title: tr(language, "group.development"),
      color: COLORS.dev,
      priority: 35,
      reason: tr(language, "reason.technicalTopic"),
      strong: false,
    };
  }

  if (hasAny(hostname, ["jira", "atlassian", "trello.com", "asana.com", "linear.app", "monday.com"])) {
    return {
      key: "work:tasks",
      title: tr(language, "group.projectsTasks"),
      color: COLORS.project,
      priority: 36,
      reason: tr(language, "reason.workService"),
      strong: true,
    };
  }

  if (hasAny(hostname, ["notion.so", "confluence", "miro.com", "figma.com", "canva.com"])) {
    return {
      key: "work:boards-docs",
      title: tr(language, "group.workMaterials"),
      color: COLORS.docs,
      priority: 37,
      reason: tr(language, "reason.workDocs"),
      strong: false,
    };
  }

  if (hasAny(hostname, ["gmail.com", "mail.google.com", "outlook.live.com", "outlook.office.com", "mail.ru"])) {
    return {
      key: "communication:mail",
      title: tr(language, "group.mail"),
      color: COLORS.mail,
      priority: 40,
      reason: tr(language, "reason.communicationType"),
      strong: true,
    };
  }

  if (hasAny(hostname, ["calendar.google.com", "teams.microsoft.com", "zoom.us", "meet.google.com"])) {
    return {
      key: "communication:meetings",
      title: tr(language, "group.meetings"),
      color: COLORS.meetings,
      priority: 41,
      reason: tr(language, "reason.communicationType"),
      strong: true,
    };
  }

  if (hasAny(hostname, ["youtube.com", "netflix.com", "spotify.com", "music.youtube.com", "twitch.tv"])) {
    return {
      key: "media:watch-listen",
      title: tr(language, "group.media"),
      color: COLORS.media,
      priority: 50,
      reason: tr(language, "reason.mediaService"),
      strong: true,
    };
  }

  if (hasAny(hostname, ["linkedin.com", "facebook.com", "instagram.com", "x.com", "twitter.com", "reddit.com", "t.me", "telegram.org"])) {
    return {
      key: "social:feeds",
      title: tr(language, "group.social"),
      color: COLORS.social,
      priority: 51,
      reason: tr(language, "reason.socialService"),
      strong: true,
    };
  }

  if (hasAny(hostname, ["wikipedia.org", "coursera.org", "udemy.com", "khanacademy.org", "edx.org"])) {
    return {
      key: "learning:research",
      title: tr(language, "group.learning"),
      color: COLORS.education,
      priority: 55,
      reason: tr(language, "reason.learningTopic"),
      strong: false,
    };
  }

  if (hasAny(hostname, ["booking.com", "airbnb.", "tripadvisor.", "skyscanner.", "avia", "kayak.", "maps.google."])) {
    return {
      key: "travel:planning",
      title: tr(language, "group.travel"),
      color: COLORS.travel,
      priority: 60,
      reason: tr(language, "reason.travelTopic"),
      strong: false,
    };
  }

  if (hasAny(hostname, ["finance.yahoo.", "tradingview.", "coinmarketcap.", "binance.", "investing.com"])) {
    return {
      key: "finance:markets",
      title: tr(language, "group.finance"),
      color: COLORS.finance,
      priority: 61,
      reason: tr(language, "reason.financeTopic"),
      strong: false,
    };
  }

  if (hasAny(hostname, ["news.google.", "bbc.", "cnn.", "nytimes.", "meduza.", "tengrinews.", "informburo."])) {
    return {
      key: "news:reading",
      title: tr(language, "group.news"),
      color: COLORS.news,
      priority: 62,
      reason: tr(language, "reason.siteType"),
      strong: false,
    };
  }

  if (productIntent) {
    return {
      key: `topic:${productIntent.key}`,
      title: tr(language, "group.topic", {
        topic: tr(language, `intent.${productIntent.key}`),
      }),
      color: COLORS.topic,
      priority: 70,
      reason: tr(language, "reason.titleTopic"),
      strong: false,
    };
  }

  return {
    key: `domain:${rootDomain}`,
    title: prettyDomain(rootDomain),
    color: COLORS.domain,
    priority: 100,
    reason: tr(language, "reason.domain"),
    strong: false,
  };
}

function tokensFromTab(tab, url, rootDomain) {
  const domainParts = rootDomain.split(".").map((part) => part.toLowerCase());
  const searchText = [];
  for (const key of ["q", "query", "search", "k", "p", "text"]) {
    const value = url.searchParams.get(key);
    if (value) searchText.push(value);
  }

  const source = `${tab.title || ""} ${url.pathname} ${searchText.join(" ")}`.toLowerCase();
  const matches = source.match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) || [];
  const unique = new Set();

  for (const raw of matches) {
    const token = raw.replace(/^-+|-+$/g, "");
    if (token.length < 4 || token.length > 28) continue;
    if (/^\d+$/.test(token)) continue;
    if (STOP_WORDS.has(token)) continue;
    if (domainParts.includes(token)) continue;
    unique.add(token);
  }

  return [...unique];
}

function makeTabMeta(tab, settings) {
  if (settings.ignorePinned && tab.pinned) return null;

  const url = parseTabUrl(tab);
  if (!url || typeof tab.id !== "number" || typeof tab.windowId !== "number") return null;

  const rootDomain = rootDomainFromHost(url.hostname);
  if (!rootDomain) return null;

  const language = resolveDisplayLanguage(settings);
  const text = textFor(tab, url);
  const classification = semanticClassification(tab, url, rootDomain, text, language);

  return {
    tab,
    url,
    rootDomain,
    language,
    classification,
    tokens: tokensFromTab(tab, url, rootDomain),
  };
}

function applyTopicOverrides(metas, minGroupSize) {
  const tokenCounts = new Map();

  for (const meta of metas) {
    if (meta.classification.strong) continue;
    for (const token of meta.tokens) {
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    }
  }

  for (const meta of metas) {
    if (meta.classification.strong || meta.tokens.length === 0) continue;

    const sharedTokens = meta.tokens
      .map((token) => ({ token, count: tokenCounts.get(token) || 0 }))
      .filter((item) => item.count >= minGroupSize)
      .sort((a, b) => b.count - a.count || a.token.localeCompare(b.token));

    const best = sharedTokens[0];
    if (!best) continue;

    meta.classification = {
      key: `topic:${best.token}`,
      title: tr(meta.language, "group.topic", { topic: titleCase(best.token) }),
      color: COLORS.topic,
      priority: 65,
      reason: tr(meta.language, "reason.repeatedTitle"),
      strong: false,
    };
  }
}

function buildClusters(tabs, settings) {
  const metas = tabs
    .map((tab) => makeTabMeta(tab, settings))
    .filter(Boolean);

  applyTopicOverrides(metas, settings.minGroupSize);

  const byKey = new Map();
  for (const meta of metas) {
    const key = `${meta.tab.windowId}:${meta.classification.key}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.tabs.push(meta.tab);
      existing.samples.push(sampleFromTab(meta.tab, meta.rootDomain));
    } else {
      byKey.set(key, {
        key: meta.classification.key,
        windowId: meta.tab.windowId,
        title: meta.classification.title,
        color: meta.classification.color,
        priority: meta.classification.priority,
        reason: meta.classification.reason,
        tabs: [meta.tab],
        samples: [sampleFromTab(meta.tab, meta.rootDomain)],
      });
    }
  }

  return [...byKey.values()]
    .filter((cluster) => cluster.tabs.length >= settings.minGroupSize)
    .sort((a, b) => a.windowId - b.windowId || a.priority - b.priority || a.title.localeCompare(b.title));
}

function sampleFromTab(tab, rootDomain) {
  return {
    title: (tab.title || prettyDomain(rootDomain)).replace(/\s+/g, " ").trim(),
    domain: rootDomain,
  };
}

function groupClustersForPreview(clusters) {
  const merged = new Map();

  for (const cluster of clusters) {
    const key = cluster.key;
    const existing = merged.get(key);
    if (existing) {
      existing.count += cluster.tabs.length;
      existing.windows += 1;
      existing.samples.push(...cluster.samples);
    } else {
      merged.set(key, {
        key,
        title: cluster.title,
        color: cluster.color,
        reason: cluster.reason,
        count: cluster.tabs.length,
        windows: 1,
        samples: [...cluster.samples],
      });
    }
  }

  return [...merged.values()]
    .map((group) => ({
      ...group,
      samples: group.samples.slice(0, 4),
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

async function analyzeTabs(settings = null) {
  const normalized = settings ? normalizeSettings(settings) : await getSettings();
  const tabs = await queryTabsForSettings(normalized);
  const eligibleTabs = tabs.filter((tab) => makeTabMeta(tab, normalized));
  const clusters = buildClusters(tabs, normalized);
  const previewGroups = groupClustersForPreview(clusters);

  return {
    settings: normalized,
    displayLanguage: resolveDisplayLanguage(normalized),
    totalTabs: tabs.length,
    eligibleTabs: eligibleTabs.length,
    groupCount: previewGroups.length,
    groupedTabs: previewGroups.reduce((sum, group) => sum + group.count, 0),
    canSuggest: tabs.length >= normalized.threshold && previewGroups.length > 0,
    groups: previewGroups,
  };
}

async function rememberManagedGroups(groupIds) {
  const stored = await chrome.storage.local.get(MANAGED_GROUPS_KEY);
  const known = Array.isArray(stored[MANAGED_GROUPS_KEY]) ? stored[MANAGED_GROUPS_KEY] : [];
  const next = [...new Set([...known, ...groupIds].filter((id) => typeof id === "number"))];
  await chrome.storage.local.set({ [MANAGED_GROUPS_KEY]: next });
}

async function groupTabsNow(settings = null) {
  const normalized = settings ? normalizeSettings(settings) : await getSettings();
  const language = resolveDisplayLanguage(normalized);

  if (!chrome.tabGroups) {
    throw new Error(tr(language, "error.tabGroupsUnavailable"));
  }

  if (groupingInProgress) {
    return analyzeTabs(normalized);
  }

  groupingInProgress = true;
  const groupIds = [];

  try {
    const tabs = await queryTabsForSettings(normalized);
    const byWindow = new Map();

    for (const tab of tabs) {
      if (!byWindow.has(tab.windowId)) byWindow.set(tab.windowId, []);
      byWindow.get(tab.windowId).push(tab);
    }

    for (const windowTabs of byWindow.values()) {
      const clusters = buildClusters(windowTabs, normalized);
      if (!clusters.length) continue;

      const eligibleIndexes = windowTabs
        .filter((tab) => !(normalized.ignorePinned && tab.pinned))
        .map((tab) => tab.index);
      let insertionIndex = eligibleIndexes.length ? Math.min(...eligibleIndexes) : 0;

      for (const cluster of clusters) {
        const tabIds = cluster.tabs
          .filter((tab) => typeof tab.id === "number")
          .sort((a, b) => a.index - b.index)
          .map((tab) => tab.id);

        if (tabIds.length < normalized.minGroupSize) continue;

        try {
          await chrome.tabs.move(tabIds, { index: insertionIndex });
          const groupId = await chrome.tabs.group({ tabIds });
          const collapsed = await shouldCollapseGroup(groupId, normalized);
          await chrome.tabGroups.update(groupId, {
            title: cluster.title.slice(0, 36),
            color: cluster.color,
            collapsed,
          });
          groupIds.push(groupId);
          insertionIndex += tabIds.length;
        } catch (error) {
          console.warn("Anti-chaos tabs: failed to group a cluster", error);
        }
      }
    }

    if (groupIds.length) {
      await rememberManagedGroups(groupIds);
      await refreshActiveGroupSnapshot();
    }

    const status = await analyzeTabs(normalized);
    await updateBadge(status);
    return status;
  } finally {
    groupingInProgress = false;
  }
}

async function ungroupManagedTabs() {
  const stored = await chrome.storage.local.get(MANAGED_GROUPS_KEY);
  const groupIds = Array.isArray(stored[MANAGED_GROUPS_KEY]) ? stored[MANAGED_GROUPS_KEY] : [];
  const tabs = await chrome.tabs.query({});
  const tabIds = tabs
    .filter((tab) => groupIds.includes(tab.groupId))
    .map((tab) => tab.id)
    .filter((id) => typeof id === "number");

  if (tabIds.length) {
    await chrome.tabs.ungroup(tabIds);
  }

  await chrome.storage.local.set({ [MANAGED_GROUPS_KEY]: [] });
  const status = await analyzeTabs();
  await updateBadge(status);
  return status;
}

async function updateBadge(existingStatus = null) {
  const status = existingStatus || (await analyzeTabs());
  const settings = status.settings;
  const language = resolveDisplayLanguage(settings);

  if (settings.autoGroup) {
    await chrome.action.setBadgeText({ text: "Auto" });
    await chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
    await chrome.action.setTitle({ title: tr(language, "badge.autoTitle") });
    return;
  }

  if (status.canSuggest) {
    await chrome.action.setBadgeText({ text: "Sort" });
    await chrome.action.setBadgeBackgroundColor({ color: "#f97316" });
    await chrome.action.setTitle({
      title: tr(language, "badge.suggestionsTitle", { count: status.groupCount }),
    });
    return;
  }

  await chrome.action.setBadgeText({ text: "" });
  await chrome.action.setTitle({ title: "Anti-chaos tabs" });
}

function scheduleAutoGroup() {
  if (autoGroupTimer) clearTimeout(autoGroupTimer);

  autoGroupTimer = setTimeout(async () => {
    try {
      const settings = await getSettings();
      const status = await analyzeTabs(settings);

      if (!settings.autoGroup) {
        await updateBadge(status);
        return;
      }

      const now = Date.now();
      if (now - lastAutoGroupAt < 5000) {
        await updateBadge(status);
        return;
      }

      if (status.totalTabs >= settings.threshold && status.groupCount > 0) {
        lastAutoGroupAt = now;
        await groupTabsNow(settings);
      } else {
        await updateBadge(status);
      }
    } catch (error) {
      console.warn("Anti-chaos tabs: auto grouping failed", error);
    }
  }, 1200);
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await saveSettings(await getSettings());
  await ensureContextMenus(settings);
  await refreshActiveGroupSnapshot();
  scheduleAutoGroup();
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenus().catch((error) =>
    console.warn("Anti-chaos tabs: failed to set up context menus", error),
  );
  refreshActiveGroupSnapshot().catch((error) =>
    console.warn("Anti-chaos tabs: failed to refresh active group snapshot", error),
  );
  scheduleAutoGroup();
});

ensureContextMenus().catch((error) =>
  console.warn("Anti-chaos tabs: failed to set up context menus", error),
);

chrome.tabs.onCreated.addListener(() => scheduleAutoGroup());
chrome.tabs.onRemoved.addListener(() => scheduleAutoGroup());
chrome.tabs.onAttached.addListener(() => scheduleAutoGroup());
chrome.tabs.onDetached.addListener(() => scheduleAutoGroup());
chrome.tabs.onActivated.addListener((activeInfo) => {
  handleActiveTabChanged(activeInfo).catch((error) =>
    console.warn("Anti-chaos tabs: failed to handle active tab change", error),
  );
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete" || changeInfo.title || changeInfo.url) {
    scheduleAutoGroup();
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  handleWindowFocusChanged(windowId).catch((error) =>
    console.warn("Anti-chaos tabs: failed to handle focused window change", error),
  );
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes[SETTINGS_KEY]) {
    ensureContextMenus().catch((error) =>
      console.warn("Anti-chaos tabs: failed to refresh context menus", error),
    );
    scheduleAutoGroup();
  }
});

if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== TOGGLE_COLLAPSE_LOCK_MENU_ID) return;
    toggleCollapseLockForTab(tab).catch((error) =>
      console.warn("Anti-chaos tabs: failed to toggle collapse lock", error),
    );
  });
}

if (chrome.tabGroups?.onRemoved) {
  chrome.tabGroups.onRemoved.addListener((group) => {
    removeCollapseLock(group.id).catch((error) =>
      console.warn("Anti-chaos tabs: failed to remove a collapse lock", error),
    );
  });
}

if (chrome.tabGroups?.onUpdated) {
  chrome.tabGroups.onUpdated.addListener((group) => {
    handleTabGroupUpdated(group).catch((error) =>
      console.warn("Anti-chaos tabs: failed to handle tab group update", error),
    );
  });
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "group-tabs-now") {
    groupTabsNow().catch((error) => console.warn("Anti-chaos tabs: command failed", error));
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "GET_STATUS") {
      return analyzeTabs();
    }

    if (message?.type === "GROUP_NOW") {
      return groupTabsNow();
    }

    if (message?.type === "UNGROUP_MANAGED") {
      return ungroupManagedTabs();
    }

    if (message?.type === "GET_GROUP_LOCKS") {
      return getCurrentTabGroupLocks();
    }

    if (message?.type === "SET_GROUP_COLLAPSE_LOCK") {
      await setGroupCollapseLock(Number(message.groupId), Boolean(message.locked));
      return getCurrentTabGroupLocks();
    }

    if (message?.type === "SET_SETTINGS") {
      const settings = await saveSettings(message.settings || {});
      await ensureContextMenus(settings);
      await refreshActiveGroupSnapshot();
      await applyCollapsePreferenceToVisibleGroups(settings);
      const status = await analyzeTabs(settings);
      await updateBadge(status);
      return status;
    }

    throw new Error("Unknown message type.");
  })()
    .then((payload) => sendResponse({ ok: true, payload }))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));

  return true;
});
