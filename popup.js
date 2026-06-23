const nodes = {
  mainView: document.querySelector("#mainView"),
  settingsView: document.querySelector("#settingsView"),
  subtitle: document.querySelector("#subtitle"),
  totalTabs: document.querySelector("#totalTabs"),
  groupCount: document.querySelector("#groupCount"),
  groupedTabs: document.querySelector("#groupedTabs"),
  statusPill: document.querySelector("#statusPill"),
  groups: document.querySelector("#groups"),
  groupLocks: document.querySelector("#groupLocks"),
  groupNow: document.querySelector("#groupNow"),
  refresh: document.querySelector("#refresh"),
  refreshGroupLocks: document.querySelector("#refreshGroupLocks"),
  ungroup: document.querySelector("#ungroup"),
  openSettings: document.querySelector("#openSettings"),
  backToMain: document.querySelector("#backToMain"),
  autoGroup: document.querySelector("#autoGroup"),
  notifySuggestions: document.querySelector("#notifySuggestions"),
  language: document.querySelector("#language"),
  scope: document.querySelector("#scope"),
  threshold: document.querySelector("#threshold"),
  minGroupSize: document.querySelector("#minGroupSize"),
  ignorePinned: document.querySelector("#ignorePinned"),
  collapseGroups: document.querySelector("#collapseGroups"),
};

let currentSettings = null;
let currentLanguage = AntiChaosI18n.getBrowserLanguage();
let savingTimer = null;

function t(key, values) {
  return AntiChaosI18n.t(currentLanguage, key, values);
}

function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload }).then((response) => {
    if (!response?.ok) {
      throw new Error(response?.error || t("popup.error.actionFailed"));
    }

    return response.payload;
  });
}

function requestExtensionPermission(permission) {
  return new Promise((resolve, reject) => {
    try {
      chrome.permissions.request({ permissions: [permission] }, (granted) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        resolve(Boolean(granted));
      });
    } catch (error) {
      reject(error);
    }
  });
}

function removeExtensionPermission(permission) {
  return new Promise((resolve) => {
    if (!chrome.permissions?.remove) {
      resolve(false);
      return;
    }

    try {
      chrome.permissions.remove({ permissions: [permission] }, (removed) => {
        resolve(Boolean(removed));
      });
    } catch {
      resolve(false);
    }
  });
}

function setBusy(isBusy) {
  nodes.groupNow.disabled = isBusy;
  nodes.refresh.disabled = isBusy;
  nodes.ungroup.disabled = isBusy;
}

function showMainView() {
  nodes.mainView.hidden = false;
  nodes.settingsView.hidden = true;
}

async function showSettingsView() {
  nodes.mainView.hidden = true;
  nodes.settingsView.hidden = false;
  await refreshGroupLocks();
}

function settingsFromInputs() {
  return {
    autoGroup: nodes.autoGroup.checked,
    language: nodes.language.value,
    scope: nodes.scope.value,
    threshold: Number.parseInt(nodes.threshold.value, 10),
    minGroupSize: Number.parseInt(nodes.minGroupSize.value, 10),
    ignorePinned: nodes.ignorePinned.checked,
    collapseGroups: nodes.collapseGroups.checked,
    notifySuggestions: nodes.notifySuggestions.checked,
  };
}

function localizeStatic(settings = currentSettings) {
  currentLanguage = AntiChaosI18n.resolveLanguage(settings?.language);
  document.documentElement.lang = currentLanguage;

  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }

  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  }

  for (const element of document.querySelectorAll("[data-i18n-title]")) {
    element.setAttribute("title", t(element.dataset.i18nTitle));
  }
}

function applySettings(settings, notificationPermissionGranted = true) {
  currentSettings = settings;
  nodes.autoGroup.checked = settings.autoGroup;
  nodes.notifySuggestions.checked = Boolean(
    settings.notifySuggestions && notificationPermissionGranted,
  );
  nodes.language.value = settings.language;
  nodes.scope.value = settings.scope;
  nodes.threshold.value = settings.threshold;
  nodes.minGroupSize.value = settings.minGroupSize;
  nodes.ignorePinned.checked = settings.ignorePinned;
  nodes.collapseGroups.checked = settings.collapseGroups;
  localizeStatic(settings);
}

const GROUP_COLOR_CLASSES = new Set([
  "blue",
  "orange",
  "red",
  "green",
  "purple",
  "pink",
  "cyan",
  "yellow",
  "grey",
]);

function emptyState(message) {
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.textContent = message;
  return empty;
}

function colorDot(color) {
  const dot = document.createElement("span");
  dot.className = "colorDot";

  if (GROUP_COLOR_CLASSES.has(color)) {
    dot.classList.add(color);
  }

  return dot;
}

function renderGroups(groups) {
  nodes.groups.replaceChildren();

  if (!groups.length) {
    nodes.groups.append(emptyState(t("popup.groups.empty")));
    return;
  }

  for (const group of groups) {
    const card = document.createElement("article");
    card.className = "groupCard";

    const body = document.createElement("div");

    const title = document.createElement("div");
    title.className = "groupTitle";
    title.title = group.title || "";
    title.textContent = group.title || "";

    const reason = document.createElement("div");
    reason.className = "groupReason";
    reason.textContent = group.reason || "";

    const samples = document.createElement("div");
    samples.className = "samples";

    for (const sample of group.samples || []) {
      const sampleNode = document.createElement("div");
      sampleNode.className = "sample";
      sampleNode.title = sample.title || "";
      sampleNode.textContent = [sample.title, sample.domain]
        .filter(Boolean)
        .join(" \u00b7 ");
      samples.append(sampleNode);
    }

    const count = document.createElement("span");
    count.className = "countBadge";
    count.textContent = String(group.count || 0);

    body.append(title, reason, samples);
    card.append(colorDot(group.color), body, count);
    nodes.groups.append(card);
  }
}

function renderGroupLocks(groups) {
  nodes.groupLocks.replaceChildren();

  if (!groups.length) {
    nodes.groupLocks.append(emptyState(t("popup.groupLocks.empty")));
    return;
  }

  for (const group of groups) {
    const row = document.createElement("label");
    row.className = "groupLockRow";

    const body = document.createElement("span");

    const title = document.createElement("span");
    title.className = "groupLockTitle";
    title.title = group.title || "";
    title.textContent = group.title || "";

    const meta = document.createElement("span");
    meta.className = "groupLockMeta";
    meta.textContent = t("popup.groupLocks.tabs", { count: group.tabCount });

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(group.locked);

    input.addEventListener("change", async () => {
      input.disabled = true;
      try {
        renderGroupLocks(
          await send("SET_GROUP_COLLAPSE_LOCK", {
            groupId: group.id,
            locked: input.checked,
          }),
        );
      } catch (error) {
        nodes.subtitle.textContent = error.message;
        input.disabled = false;
      }
    });

    body.append(title, meta);
    row.append(colorDot(group.color), body, input);
    nodes.groupLocks.append(row);
  }
}

async function refreshGroupLocks() {
  try {
    renderGroupLocks(await send("GET_GROUP_LOCKS"));
  } catch (error) {
    nodes.groupLocks.replaceChildren(emptyState(error.message));
  }
}

function renderStatus(status) {
  applySettings(status.settings, status.notificationPermissionGranted);
  nodes.totalTabs.textContent = status.totalTabs;
  nodes.groupCount.textContent = status.groupCount;
  nodes.groupedTabs.textContent = status.groupedTabs;
  nodes.statusPill.textContent = status.groupCount
    ? t("popup.status.found", { count: status.groupCount })
    : t("popup.status.empty");

  if (status.settings.autoGroup) {
    nodes.subtitle.textContent = t("popup.status.autoEnabled", {
      threshold: status.settings.threshold,
    });
  } else if (status.canSuggest) {
    nodes.subtitle.textContent = t("popup.status.canSuggest");
  } else {
    nodes.subtitle.textContent = t("popup.status.noSuggestion");
  }

  renderGroups(status.groups);
}

async function refreshStatus() {
  setBusy(true);
  try {
    renderStatus(await send("GET_STATUS"));
  } catch (error) {
    nodes.subtitle.textContent = error.message;
  } finally {
    setBusy(false);
  }
}

function scheduleSave() {
  if (!currentSettings) return;
  clearTimeout(savingTimer);
  localizeStatic(settingsFromInputs());

  savingTimer = setTimeout(async () => {
    setBusy(true);
    try {
      renderStatus(await send("SET_SETTINGS", { settings: settingsFromInputs() }));
    } catch (error) {
      nodes.subtitle.textContent = error.message;
    } finally {
      setBusy(false);
    }
  }, 250);
}

async function handleNotificationPreferenceChange() {
  if (!currentSettings) return;
  clearTimeout(savingTimer);

  const wantsNotifications = nodes.notifySuggestions.checked;
  let permissionDenied = false;
  nodes.notifySuggestions.disabled = true;
  setBusy(true);

  try {
    if (wantsNotifications) {
      if (!chrome.permissions?.request) {
        throw new Error(t("popup.error.notificationsUnavailable"));
      }

      const granted = await requestExtensionPermission("notifications");

      if (!granted) {
        permissionDenied = true;
        nodes.notifySuggestions.checked = false;
      }
    }

    const status = await send("SET_SETTINGS", { settings: settingsFromInputs() });

    if (!wantsNotifications && chrome.permissions?.remove) {
      await removeExtensionPermission("notifications");
    }

    renderStatus(status);

    if (permissionDenied) {
      nodes.subtitle.textContent = t("popup.status.notificationsDenied");
    }
  } catch (error) {
    nodes.notifySuggestions.checked = Boolean(currentSettings?.notifySuggestions);
    nodes.subtitle.textContent = error.message;
  } finally {
    nodes.notifySuggestions.disabled = false;
    setBusy(false);
  }
}

nodes.groupNow.addEventListener("click", async () => {
  setBusy(true);
  nodes.subtitle.textContent = t("popup.status.grouping");
  try {
    renderStatus(await send("GROUP_NOW"));
  } catch (error) {
    nodes.subtitle.textContent = error.message;
  } finally {
    setBusy(false);
  }
});

nodes.refresh.addEventListener("click", refreshStatus);

nodes.openSettings.addEventListener("click", () => {
  showSettingsView().catch((error) => {
    nodes.subtitle.textContent = error.message;
  });
});
nodes.backToMain.addEventListener("click", showMainView);
nodes.refreshGroupLocks.addEventListener("click", refreshGroupLocks);

nodes.ungroup.addEventListener("click", async () => {
  setBusy(true);
  nodes.subtitle.textContent = t("popup.status.ungrouping");
  try {
    renderStatus(await send("UNGROUP_MANAGED"));
  } catch (error) {
    nodes.subtitle.textContent = error.message;
  } finally {
    setBusy(false);
  }
});

for (const input of [
  nodes.autoGroup,
  nodes.language,
  nodes.scope,
  nodes.threshold,
  nodes.minGroupSize,
  nodes.ignorePinned,
  nodes.collapseGroups,
]) {
  input.addEventListener("change", scheduleSave);
}

nodes.notifySuggestions.addEventListener("change", handleNotificationPreferenceChange);

localizeStatic({ language: "auto" });
refreshStatus();
