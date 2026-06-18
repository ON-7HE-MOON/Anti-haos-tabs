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
  scope: document.querySelector("#scope"),
  threshold: document.querySelector("#threshold"),
  minGroupSize: document.querySelector("#minGroupSize"),
  ignorePinned: document.querySelector("#ignorePinned"),
  collapseGroups: document.querySelector("#collapseGroups"),
};

let currentSettings = null;
let savingTimer = null;

function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload }).then((response) => {
    if (!response?.ok) {
      throw new Error(response?.error || "Не удалось выполнить действие");
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
    scope: nodes.scope.value,
    threshold: Number.parseInt(nodes.threshold.value, 10),
    minGroupSize: Number.parseInt(nodes.minGroupSize.value, 10),
    ignorePinned: nodes.ignorePinned.checked,
    collapseGroups: nodes.collapseGroups.checked,
  };
}

function applySettings(settings) {
  currentSettings = settings;
  nodes.autoGroup.checked = settings.autoGroup;
  nodes.scope.value = settings.scope;
  nodes.threshold.value = settings.threshold;
  nodes.minGroupSize.value = settings.minGroupSize;
  nodes.ignorePinned.checked = settings.ignorePinned;
  nodes.collapseGroups.checked = settings.collapseGroups;
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
    empty.textContent = "Пока нет групп из двух и более вкладок.";
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
                `<div class="sample" title="${escapeText(sample.title)}">${escapeText(sample.title)} · ${escapeText(sample.domain)}</div>`,
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
  nodes.statusPill.textContent = status.groupCount ? `${status.groupCount} найдено` : "пусто";

  if (status.settings.autoGroup) {
    nodes.subtitle.textContent = `Авто-режим включен, порог: ${status.settings.threshold}`;
  } else if (status.canSuggest) {
    nodes.subtitle.textContent = "Есть вкладки, которые можно собрать в группы.";
  } else {
    nodes.subtitle.textContent = "Откройте больше похожих вкладок или снизьте порог.";
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
  nodes.subtitle.textContent = "Группирую вкладки...";
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
  nodes.subtitle.textContent = "Разгруппировываю созданные группы...";
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
  nodes.scope,
  nodes.threshold,
  nodes.minGroupSize,
  nodes.ignorePinned,
  nodes.collapseGroups,
]) {
  input.addEventListener("change", scheduleSave);
}

refreshStatus();
