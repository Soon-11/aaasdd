const ADMIN_STORAGE_KEY = "game_calendar_admin_v1";
const ADMIN_BASE_CACHE_KEY = "game_calendar_base_cache_v1";

const adminState = {
  baseGames: [],
  search: "",
  customGames: [],
  hiddenGameIds: [],
};

const adminEls = {
  search: document.getElementById("admin-search"),
  status: document.getElementById("admin-status"),
  addForm: document.getElementById("admin-add-form"),
  customGamesList: document.getElementById("custom-games-list"),
  hiddenGamesList: document.getElementById("hidden-games-list"),
  allGamesList: document.getElementById("all-games-list"),
  openStandaloneButton: document.getElementById("open-admin-standalone"),
  exportButton: document.getElementById("export-admin-data"),
  importFile: document.getElementById("import-admin-file"),
  clearButton: document.getElementById("clear-admin-data"),
};

loadAdminPage();

async function loadAdminPage() {
  try {
    let data = readEmbeddedBaseDataset();
    if (!data) {
      try {
        data = await fetchDatasetJson();
      } catch {
        try {
          data = await fetchEmbeddedDataset();
        } catch {
          data = readBaseDatasetCache();
        }
      }
    }

    if (!data) {
      throw new Error("기본 데이터를 찾지 못했습니다.");
    }

    adminState.baseGames = Array.isArray(data.games) ? data.games : [];
    writeBaseDatasetCache(data);
    hydrateAdminStorage();
    bindAdminEvents();
    renderAdmin();
  } catch (error) {
    adminEls.status.textContent = `관리자 데이터를 불러오지 못했습니다. (${error.message})`;
  }
}

function readEmbeddedBaseDataset() {
  const script = document.getElementById("admin-base-data");
  if (script) {
    try {
      const parsed = JSON.parse(script.textContent || "null");
      if (parsed && Array.isArray(parsed.games)) {
        return parsed;
      }
    } catch {
      // fall through to global
    }
  }
  const embedded = window.__GAME_CALENDAR_BASE_DATA__;
  if (embedded && Array.isArray(embedded.games)) {
    return embedded;
  }
  return null;
}

async function fetchDatasetJson() {
  const url = new URL("./data/inven_dataset.json", window.location.href);
  const response = await fetch(url.href, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchEmbeddedDataset() {
  const url = new URL("./index.html", window.location.href);
  const response = await fetch(url.href, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const html = await response.text();
  const match = html.match(/<script id="embedded-calendar-data" type="application\/json">\s*([\s\S]*?)\s*<\/script>/);
  if (!match) {
    throw new Error("embedded data not found");
  }
  return JSON.parse(match[1]);
}

function bindAdminEvents() {
  adminEls.search.addEventListener("input", (event) => {
    adminState.search = event.target.value.trim().toLowerCase();
    renderAdmin();
  });

  if (adminEls.openStandaloneButton) {
    adminEls.openStandaloneButton.addEventListener("click", () => {
      window.open("./admin.html", "_blank", "noopener,noreferrer");
    });
  }

  adminEls.addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addCustomGame(new FormData(adminEls.addForm));
  });

  adminEls.exportButton.addEventListener("click", exportAdminData);
  adminEls.importFile.addEventListener("change", importAdminData);
  adminEls.clearButton.addEventListener("click", clearAdminData);
}

function hydrateAdminStorage() {
  const stored = readAdminStorage();
  adminState.customGames = stored.games;
  adminState.hiddenGameIds = stored.hiddenGameIds;
}

function readAdminStorage() {
  try {
    const raw = window.localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) {
      return { games: [], hiddenGameIds: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      games: Array.isArray(parsed.games) ? parsed.games : [],
      hiddenGameIds: Array.isArray(parsed.hiddenGameIds) ? parsed.hiddenGameIds.map(String) : [],
    };
  } catch {
    return { games: [], hiddenGameIds: [] };
  }
}

function readBaseDatasetCache() {
  try {
    const raw = window.localStorage.getItem(ADMIN_BASE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeBaseDatasetCache(data) {
  try {
    window.localStorage.setItem(ADMIN_BASE_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage failures
  }
}

function writeAdminStorage() {
  const payload = {
    games: adminState.customGames,
    hiddenGameIds: adminState.hiddenGameIds,
  };
  window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(payload));
}

async function addCustomGame(formData) {
  const title = String(formData.get("title") || "").trim();
  const releaseDate = String(formData.get("release_date") || "").trim();
  if (!title || !releaseDate) {
    adminEls.status.textContent = "게임명과 출시일은 필수입니다.";
    return;
  }

  const image = normalizeAdminImagePath(String(formData.get("image") || "").trim());

  const date = new Date(`${releaseDate}T00:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = String(date.getDate()).padStart(2, "0");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const dateText = `${String(month).padStart(2, "0")}/${day}(${weekdays[date.getDay()]})`;
  const status = String(formData.get("status") || "출시").trim();
  const platforms = formData.getAll("platforms").map((value) => String(value));
  const tags = String(formData.get("tags") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const customGame = {
    game_idx: `custom-${Date.now()}`,
    title,
    subtitle: String(formData.get("subtitle") || "").trim(),
    title_ko: title,
    title_en: String(formData.get("subtitle") || "").trim(),
    developer: String(formData.get("developer") || "").trim(),
    publisher: String(formData.get("publisher") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    tags,
    image,
    homepage: String(formData.get("homepage") || "").trim(),
    wishlist: "",
    youtube_embed: String(formData.get("youtube_embed") || "").trim(),
    schedules: [
      {
        year,
        month,
        status,
        dates: [dateText],
        platforms,
        url: "",
        source_types: [mapStatusToSourceType(status), ...platforms],
      },
    ],
    release_schedule: platforms.map((platform) => ({
      platform: platform.toUpperCase(),
      date: releaseDate,
    })),
    is_custom: true,
  };

  adminState.customGames.unshift(customGame);
  try {
    writeAdminStorage();
  } catch {
    adminState.customGames.shift();
    adminEls.status.textContent = "관리자 데이터를 저장하지 못했습니다.";
    return;
  }
  adminEls.addForm.reset();
  adminEls.status.textContent = "새 게임이 추가되었습니다. 사이트나 노션 페이지를 새로고침하면 반영됩니다.";
  renderAdmin();
}

function normalizeAdminImagePath(value) {
  if (!value) {
    return "";
  }

  if (value.startsWith("./") || value.startsWith("../") || value.startsWith("/")) {
    return value;
  }

  return `./assets/images/${value}`;
}

function mapStatusToSourceType(status) {
  if (status.includes("테스트")) return "test";
  if (status.includes("얼리")) return "early";
  if (status.includes("행사")) return "event";
  return "release";
}

function renderAdmin() {
  renderCustomGames();
  renderHiddenGames();
  renderAllGames();
}

function renderCustomGames() {
  const games = filterGames(adminState.customGames);
  adminEls.customGamesList.innerHTML = games.length
    ? games.map((game) => renderAdminCard(game, "custom")).join("")
    : `<div class="admin-empty">직접 추가한 게임이 없습니다.</div>`;

  adminEls.customGamesList.querySelectorAll("[data-delete-custom]").forEach((button) => {
    button.addEventListener("click", () => {
      const gameId = button.dataset.deleteCustom;
      adminState.customGames = adminState.customGames.filter((game) => String(game.game_idx) !== gameId);
      writeAdminStorage();
      renderAdmin();
    });
  });
}

function renderHiddenGames() {
  const hiddenGames = adminState.baseGames.filter((game) => adminState.hiddenGameIds.includes(String(game.game_idx)));
  const games = filterGames(hiddenGames);
  adminEls.hiddenGamesList.innerHTML = games.length
    ? games.map((game) => renderAdminCard(game, "hidden")).join("")
    : `<div class="admin-empty">숨긴 게임이 없습니다.</div>`;

  adminEls.hiddenGamesList.querySelectorAll("[data-restore-game]").forEach((button) => {
    button.addEventListener("click", () => {
      const gameId = button.dataset.restoreGame;
      adminState.hiddenGameIds = adminState.hiddenGameIds.filter((id) => id !== gameId);
      writeAdminStorage();
      renderAdmin();
    });
  });
}

function renderAllGames() {
  const hiddenSet = new Set(adminState.hiddenGameIds);
  const combined = [
    ...adminState.customGames,
    ...adminState.baseGames.filter((game) => !hiddenSet.has(String(game.game_idx))),
  ];
  const games = filterGames(combined).slice(0, 200);

  adminEls.allGamesList.innerHTML = games.length
    ? games.map((game) => renderAdminCard(game, game.is_custom ? "custom" : "base")).join("")
    : `<div class="admin-empty">검색 결과가 없습니다.</div>`;

  adminEls.allGamesList.querySelectorAll("[data-hide-game]").forEach((button) => {
    button.addEventListener("click", () => {
      const gameId = button.dataset.hideGame;
      if (!adminState.hiddenGameIds.includes(gameId)) {
        adminState.hiddenGameIds.push(gameId);
        writeAdminStorage();
        renderAdmin();
      }
    });
  });

  adminEls.allGamesList.querySelectorAll("[data-delete-custom]").forEach((button) => {
    button.addEventListener("click", () => {
      const gameId = button.dataset.deleteCustom;
      adminState.customGames = adminState.customGames.filter((game) => String(game.game_idx) !== gameId);
      writeAdminStorage();
      renderAdmin();
    });
  });
}

function filterGames(games) {
  if (!adminState.search) {
    return games;
  }

  return games.filter((game) => {
    const schedule = game.schedules?.[0];
    const haystack = [
      game.title,
      game.subtitle,
      game.developer,
      game.publisher,
      ...(game.tags || []),
      ...((schedule?.platforms || []).map((platform) => platform.toUpperCase())),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(adminState.search);
  });
}

function renderAdminCard(game, mode) {
  const schedule = game.schedules?.[0];
  const dateText = schedule?.dates?.join(" ~ ") || "-";
  const platformText = (schedule?.platforms || []).map((platform) => platform.toUpperCase()).join(", ") || "-";
  const action = mode === "hidden"
    ? `<button type="button" class="ghost-button" data-restore-game="${escapeHtml(game.game_idx)}">복원</button>`
    : mode === "custom"
      ? `<button type="button" class="ghost-button" data-delete-custom="${escapeHtml(game.game_idx)}">삭제</button>`
      : `<button type="button" class="ghost-button" data-hide-game="${escapeHtml(game.game_idx)}">숨기기</button>`;

  return `
    <article class="admin-card">
      <div class="admin-card__body">
        <h3>${escapeHtml(game.title_ko || game.title || "-")}</h3>
        <p>${escapeHtml(game.title_en || game.subtitle || "")}</p>
        <div class="admin-card__meta">${escapeHtml(dateText)} · ${escapeHtml(platformText)}</div>
      </div>
      <div class="admin-actions">
        ${action}
      </div>
    </article>
  `;
}

function exportAdminData() {
  const blob = new Blob([JSON.stringify(readAdminStorage(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "game-calendar-admin-backup.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importAdminData(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      adminState.customGames = Array.isArray(parsed.games) ? parsed.games : [];
      adminState.hiddenGameIds = Array.isArray(parsed.hiddenGameIds) ? parsed.hiddenGameIds.map(String) : [];
      writeAdminStorage();
      adminEls.status.textContent = "백업 파일을 가져왔습니다.";
      renderAdmin();
    } catch {
      adminEls.status.textContent = "백업 파일 형식이 올바르지 않습니다.";
    }
  };
  reader.readAsText(file, "utf-8");
  event.target.value = "";
}

function clearAdminData() {
  if (!window.confirm("직접 추가한 게임과 숨김 목록을 모두 초기화할까요?")) {
    return;
  }

  adminState.customGames = [];
  adminState.hiddenGameIds = [];
  writeAdminStorage();
  adminEls.status.textContent = "관리자 데이터를 초기화했습니다.";
  renderAdmin();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
