const nodes = {
  subtitle: document.querySelector("#subtitle"),
  totalTabs: document.querySelector("#totalTabs"),
  groupCount: document.querySelector("#groupCount"),
  groupedTabs: document.querySelector("#groupedTabs"),
  statusPill: document.querySelector("#statusPill"),
  groups: document.querySelector("#groups"),
  groupNow: document.querySelector("#groupNow"),
  refresh: document.querySelector("#refresh"),
  ungroup: document.querySelector("#ungroup"),
  autoGroup: document.querySelector("#autoGroup"),
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

function setBusy(isBusy) {
  nodes.groupNow.disabled = isBusy;
  nodes.refresh.disabled = isBusy;
  nodes.ungroup.disabled = isBusy;
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
}

function applySettings(settings) {
  currentSettings = settings;
  nodes.autoGroup.checked = settings.autoGroup;
  nodes.language.value = settings.language;
  nodes.scope.value = settings.scope;
  nodes.threshold.value = settings.threshold;
  nodes.minGroupSize.value = settings.minGroupSize;
  nodes.ignorePinned.checked = settings.ignorePinned;
  nodes.collapseGroups.checked = settings.collapseGroups;
  localizeStatic(settings);
}

function escapeText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderGroups(groups) {
  nodes.groups.innerHTML = "";

  if (!groups.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("popup.groups.empty");
    nodes.groups.append(empty);
    return;
  }

  for (const group of groups) {
    const card = document.createElement("article");
    card.className = "groupCard";
    card.innerHTML = `
      <span class="colorDot ${escapeText(group.color)}"></span>
      <div>
        <div class="groupTitle" title="${escapeText(group.title)}">${escapeText(group.title)}</div>
        <div class="groupReason">${escapeText(group.reason)}</div>
        <div class="samples">
          ${group.samples
            .map(
              (sample) =>
                `<div class="sample" title="${escapeText(sample.title)}">${escapeText(sample.title)} &middot; ${escapeText(sample.domain)}</div>`,
            )
            .join("")}
        </div>
      </div>
      <span class="countBadge">${group.count}</span>
    `;
    nodes.groups.append(card);
  }
}

function renderStatus(status) {
  applySettings(status.settings);
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

localizeStatic({ language: "auto" });
refreshStatus();
