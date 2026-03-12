const state = {
  dataset: null,
  filters: {
    query: "",
    year: "all",
    month: "all",
    platform: "all",
  },
  viewMode: "month",
  selectedDateKey: null,
  selectedWeekStartKey: null,
  selectedGameId: null,
  filteredGames: [],
  dayItems: [],
};

const IS_NOTION_COMPACT = document.body.classList.contains("notion-compact");

const els = {
  loading: document.getElementById("loading-state"),
  error: document.getElementById("error-state"),
  empty: document.getElementById("empty-state"),
  yearSelect: document.getElementById("year-select"),
  platformFilters: document.getElementById("platform-filters"),
  viewModeFilters: document.getElementById("view-mode-filters"),
  highlightsList: document.getElementById("highlights-list"),
  search: document.getElementById("search-input"),
  reset: document.getElementById("reset-filters"),
  resultCount: document.getElementById("result-count"),
  totalGames: document.getElementById("total-games"),
  prevMonth: document.getElementById("prev-month"),
  nextMonth: document.getElementById("next-month"),
  toggleHighlights: document.getElementById("toggle-highlights"),
  calendarTitle: document.getElementById("calendar-title"),
  calendarGrid: document.getElementById("calendar-grid"),
  dayTitle: document.getElementById("day-title"),
  daySummary: document.getElementById("day-summary"),
  dayList: document.getElementById("day-list"),
  detailModal: document.getElementById("detail-modal"),
  closeModal: document.getElementById("close-modal"),
  detailImageSlot: document.getElementById("detail-image-slot"),
  detailKicker: document.getElementById("detail-kicker"),
  detailTitle: document.getElementById("detail-title"),
  detailSubtitle: document.getElementById("detail-subtitle"),
  detailPrimaryMeta: document.getElementById("detail-primary-meta"),
  detailDeveloper: document.getElementById("detail-developer"),
  detailPublisher: document.getElementById("detail-publisher"),
  detailReleaseDate: document.getElementById("detail-release-date"),
  detailTags: document.getElementById("detail-tags"),
  detailDescription: document.getElementById("detail-description"),
  detailDescriptionToggle: document.getElementById("detail-description-toggle"),
  detailHomepage: document.getElementById("detail-homepage"),
  detailVideoSection: document.getElementById("detail-video-section"),
  detailVideoEmbed: document.getElementById("detail-video-embed"),
};

async function loadDataset() {
  try {
    const embedded = readJsonScript("embedded-calendar-data");
    const manual = readJsonScript("manual-calendar-data") || { games: [], events: [] };
    let dataset = embedded;

    if (!dataset || !Array.isArray(dataset.games)) {
      try {
        const response = await fetch("./data/inven_dataset.json");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        dataset = await response.json();
      } catch {
        dataset = {
          meta: { total_games: 0, total_events: 0, source_files: [], months: {} },
          games: [],
          events: [],
        };
      }
    }

    state.dataset = mergeManualEntries(dataset, manual);
    initView();
  } catch (error) {
    els.loading.classList.add("hidden");
    els.error.classList.remove("hidden");
    setText(els.error, `데이터를 불러오지 못했습니다. (${error.message})`);
  }
}

function readJsonScript(id) {
  const node = document.getElementById(id);
  if (!node) return null;
  const raw = node.textContent.trim();
  if (!raw || raw === "null") return null;
  return JSON.parse(raw);
}

function mergeManualEntries(dataset, manual) {
  const base = structuredClone(dataset);
  base.games = Array.isArray(base.games) ? base.games : [];
  base.events = Array.isArray(base.events) ? base.events : [];
  base.games.push(...(Array.isArray(manual.games) ? manual.games : []));
  base.events.push(...(Array.isArray(manual.events) ? manual.events : []));
  base.meta = buildMeta(base.games, base.events, base.meta?.source_files || []);
  return base;
}

function buildMeta(games, events, sourceFiles) {
  const months = {};
  for (const game of games) {
    for (const schedule of game.schedules || []) {
      const monthKey = `${schedule.year}-${String(schedule.month).padStart(2, "0")}`;
      months[monthKey] = { count: (months[monthKey]?.count || 0) + 1 };
    }
  }

  return {
    total_games: games.length,
    total_events: events.length,
    source_files: sourceFiles,
    months,
  };
}

function initView() {
  const monthKeys = getAllMonthKeys();
  const years = getAllYears();
  const initial = getInitialYearMonth(monthKeys, years);

  els.loading.classList.add("hidden");
  setText(els.totalGames, String(state.dataset.meta?.total_games ?? 0));

  state.filters.year = initial.year;
  state.filters.month = initial.month;
  state.selectedWeekStartKey = initial.month !== "all" ? `${initial.month}-01` : null;

  renderYearSelect();
  renderPlatformFilters();
  renderViewModeFilters();

  els.search.addEventListener("input", (event) => {
    state.filters.query = event.target.value.trim().toLowerCase();
    updateView();
  });

  els.yearSelect.addEventListener("change", () => {
    state.filters.year = els.yearSelect.value;
    const months = getMonthsForYear(state.filters.year);
    const currentMonth = `${state.filters.year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    state.filters.month = months.find((item) => item.value === currentMonth)?.value || months[0]?.value || "all";
    state.selectedWeekStartKey = state.filters.month !== "all" ? `${state.filters.month}-01` : null;
    updateView();
  });

  els.reset.addEventListener("click", () => {
    state.filters.query = "";
    state.filters.platform = "all";
    state.filters.year = initial.year;
    state.filters.month = initial.month;
    state.viewMode = "month";
    state.selectedWeekStartKey = initial.month !== "all" ? `${initial.month}-01` : null;
    els.search.value = "";
    renderYearSelect();
    renderPlatformFilters();
    renderViewModeFilters();
    updateView();
  });

  els.prevMonth.addEventListener("click", () => shiftCalendar(-1));
  els.nextMonth.addEventListener("click", () => shiftCalendar(1));
  els.toggleHighlights.addEventListener("click", toggleHighlights);
  els.closeModal.addEventListener("click", closeModal);
  els.detailDescriptionToggle.addEventListener("click", toggleDescription);
  document.querySelectorAll("[data-close-modal='true']").forEach((node) => {
    node.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });

  updateView();
}

function getAllMonthKeys() {
  return Object.keys(state.dataset.meta?.months || {}).sort();
}

function getAllYears() {
  return [...new Set(getAllMonthKeys().map((value) => value.slice(0, 4)))].sort();
}

function getMonthsForYear(year) {
  return getAllMonthKeys()
    .filter((value) => value.startsWith(`${year}-`))
    .map((value) => ({
      label: `${Number(value.slice(5))}월`,
      value,
    }));
}

function getInitialYearMonth(monthKeys, years) {
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const year = years.includes(currentYear) ? currentYear : (years[0] || "all");
  const targetMonth = `${year}-${currentMonth}`;
  const available = monthKeys.filter((value) => value.startsWith(`${year}-`));
  const month = available.includes(targetMonth) ? targetMonth : (available[0] || "all");
  return { year, month };
}

function renderYearSelect() {
  els.yearSelect.innerHTML = getAllYears()
    .map((year) => {
      const selected = state.filters.year === year ? " selected" : "";
      return `<option value="${year}"${selected}>${year}년</option>`;
    })
    .join("");
}

function renderPlatformFilters() {
  const values = new Set();
  for (const game of state.dataset.games || []) {
    for (const schedule of game.schedules || []) {
      for (const platform of schedule.platforms || []) {
        values.add(String(platform).toLowerCase());
      }
    }
  }

  const items = [
    { label: "전체", value: "all" },
    ...[...values].sort().map((platform) => ({
      label: platform.toUpperCase(),
      value: platform,
    })),
  ];

  els.platformFilters.innerHTML = "";
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip platform-chip";
    button.innerHTML = renderPlatformChipContent(item.value, item.label);
    button.classList.toggle("is-active", state.filters.platform === item.value);
    button.addEventListener("click", () => {
      state.filters.platform = item.value;
      renderPlatformFilters();
      updateView();
    });
    els.platformFilters.appendChild(button);
  });
}

function renderPlatformChipContent(value, label) {
  const icon = renderPlatformIcon(value);
  return `
    <span class="platform-chip__icon">${icon}</span>
    <span class="platform-chip__label">${escapeHtml(label)}</span>
  `;
}

function renderPlatformIcon(value) {
  const icons = {
    all: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="7" cy="7" r="3"></circle>
        <circle cx="17" cy="7" r="3"></circle>
        <circle cx="7" cy="17" r="3"></circle>
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5"></rect>
      </svg>
    `,
    mobile: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="7" y="3" width="10" height="18" rx="2"></rect>
        <circle cx="12" cy="17.5" r="1"></circle>
      </svg>
    `,
    pc: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="11" rx="1.5"></rect>
        <path d="M9 20h6"></path>
        <path d="M12 16v4"></path>
      </svg>
    `,
    ps: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5v11.5c0 1.2-.7 2-1.8 2.4l-2.2.7"></path>
        <path d="M9 5c3 .2 5 1.2 5 3.2 0 1.8-1.8 2.8-4 3.4l6 2.1c1.8.6 3 .6 3 .1 0-.6-1-1.1-2.2-1.5L12 11"></path>
      </svg>
    `,
    switch: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="7" height="16" rx="2"></rect>
        <rect x="13" y="4" width="7" height="16" rx="2"></rect>
        <circle cx="8" cy="9" r="1.2"></circle>
        <circle cx="16" cy="14" r="1.2"></circle>
      </svg>
    `,
    xbox: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8"></circle>
        <path d="M8 7.5c1.2.3 2.5 1.1 4 2.8 1.5-1.7 2.8-2.5 4-2.8"></path>
        <path d="M8.5 16.5c1-1.5 2.1-3 3.5-4.3 1.4 1.3 2.5 2.8 3.5 4.3"></path>
      </svg>
    `,
  };
  return icons[value] || `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7"></circle>
    </svg>
  `;
}

function renderViewModeFilters() {
  const items = [
    { label: "월간", value: "month" },
    { label: "주간", value: "week" },
  ];

  els.viewModeFilters.innerHTML = "";
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = item.label;
    button.classList.toggle("is-active", state.viewMode === item.value);
    button.addEventListener("click", () => {
      state.viewMode = item.value;
      if (item.value === "week" && state.selectedDateKey) {
        state.selectedWeekStartKey = state.selectedDateKey;
      }
      renderViewModeFilters();
      updateView();
    });
    els.viewModeFilters.appendChild(button);
  });
}

function updateView() {
  state.filteredGames = (state.dataset.games || []).filter(matchesFilters);
  const grouped = groupItemsByDate();
  const keys = [...grouped.keys()].sort(compareDateKeys);
  const todayKey = getTodayKeyForSelectedMonth();

  if (!state.selectedDateKey || !grouped.has(state.selectedDateKey)) {
    state.selectedDateKey = todayKey && grouped.has(todayKey) ? todayKey : (keys[0] || null);
  }

  state.dayItems = state.selectedDateKey ? (grouped.get(state.selectedDateKey) || []) : [];
  if (!state.dayItems.some((item) => item.game.game_idx === state.selectedGameId)) {
    state.selectedGameId = state.dayItems[0]?.game.game_idx || null;
  }

  renderHighlights(grouped);
  renderCalendar(grouped);
  renderDayList();
  renderDetail();
  syncNavButtons();

  setText(els.resultCount, `${state.filteredGames.length}개 게임`);
  els.empty.classList.toggle("hidden", state.filteredGames.length !== 0);
}

function matchesFilters(game) {
  const haystack = [
    game.title,
    game.subtitle,
    game.title_ko,
    game.title_en,
    game.developer,
    game.publisher,
    ...(game.tags || []),
  ]
    .join(" ")
    .toLowerCase();

  if (state.filters.query && !haystack.includes(state.filters.query)) {
    return false;
  }

  return (game.schedules || []).some((schedule) => {
    const monthKey = `${schedule.year}-${String(schedule.month).padStart(2, "0")}`;
    if (state.filters.month !== "all" && monthKey !== state.filters.month) {
      return false;
    }
    if (state.filters.platform !== "all" && !(schedule.platforms || []).includes(state.filters.platform)) {
      return false;
    }
    return true;
  });
}

function groupItemsByDate() {
  const grouped = new Map();

  for (const game of state.filteredGames) {
    for (const schedule of game.schedules || []) {
      const monthKey = `${schedule.year}-${String(schedule.month).padStart(2, "0")}`;
      if (state.filters.month !== "all" && monthKey !== state.filters.month) {
        continue;
      }

      for (const key of extractDateKeys(schedule, monthKey)) {
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key).push({ game, schedule });
      }
    }
  }

  for (const items of grouped.values()) {
    items.sort(compareItemsByTimePriority);
  }

  return grouped;
}

function extractDateKeys(schedule, monthKey) {
  const keys = [];
  for (const text of schedule.dates || []) {
    const match = String(text).match(/(\d{2})\/(\d{2})/);
    if (match) {
      keys.push(`${monthKey}-${match[2]}`);
    }
  }
  return [...new Set(keys)];
}

function compareDateKeys(left, right) {
  return parseDateKey(left) - parseDateKey(right);
}

function getScheduleRange(schedule) {
  const parsed = [];
  for (const text of schedule.dates || []) {
    const match = String(text).match(/(\d{2})\/(\d{2})/);
    if (match) {
      parsed.push(new Date(schedule.year, Number(match[1]) - 1, Number(match[2])));
    }
  }

  parsed.sort((a, b) => a - b);
  if (!parsed.length) {
    const fallback = new Date(schedule.year, schedule.month - 1, 1);
    return { start: fallback, end: fallback };
  }

  return {
    start: parsed[0],
    end: parsed[parsed.length - 1],
  };
}

function todayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isPastSchedule(schedule) {
  return getScheduleRange(schedule).end < todayStart();
}

function compareItemsByTimePriority(left, right) {
  const today = todayStart();
  const leftRange = getScheduleRange(left.schedule);
  const rightRange = getScheduleRange(right.schedule);
  const leftPast = leftRange.end < today;
  const rightPast = rightRange.end < today;

  if (leftPast !== rightPast) {
    return leftPast ? 1 : -1;
  }

  const leftDistance = Math.abs(leftRange.start - today);
  const rightDistance = Math.abs(rightRange.start - today);
  if (leftDistance !== rightDistance) {
    return leftDistance - rightDistance;
  }

  return (left.game.title_ko || left.game.title || "").localeCompare(
    right.game.title_ko || right.game.title || "",
    "ko"
  );
}

function compareItemsChronologically(left, right) {
  const leftRange = getScheduleRange(left.schedule);
  const rightRange = getScheduleRange(right.schedule);

  if (leftRange.start.getTime() !== rightRange.start.getTime()) {
    return leftRange.start - rightRange.start;
  }

  return (left.game.title_ko || left.game.title || "").localeCompare(
    right.game.title_ko || right.game.title || "",
    "ko"
  );
}

function compareItemsFromAnchor(left, right, anchorDate) {
  const leftRange = getScheduleRange(left.schedule);
  const rightRange = getScheduleRange(right.schedule);
  const leftBeforeAnchor = leftRange.start < anchorDate;
  const rightBeforeAnchor = rightRange.start < anchorDate;

  if (leftBeforeAnchor !== rightBeforeAnchor) {
    return leftBeforeAnchor ? 1 : -1;
  }

  if (leftRange.start.getTime() !== rightRange.start.getTime()) {
    return leftRange.start - rightRange.start;
  }

  return (left.game.title_ko || left.game.title || "").localeCompare(
    right.game.title_ko || right.game.title || "",
    "ko"
  );
}

function renderHighlights(grouped) {
  if (els.highlightsList.classList.contains("hidden")) {
    return;
  }

  const allItems = [];
  for (const [dateKey, items] of grouped.entries()) {
    for (const item of items) {
      allItems.push({ ...item, dateKey });
    }
  }

  const anchorDate = getHighlightAnchorDate();
  allItems.sort((left, right) => compareItemsFromAnchor(left, right, anchorDate));

  const picked = [];
  const seen = new Set();
  for (const item of allItems) {
    const key = `${item.game.game_idx}:${item.dateKey}`;
    if (seen.has(key) || picked.length >= 7) {
      continue;
    }
    seen.add(key);
    picked.push(item);
  }

  els.highlightsList.innerHTML = picked
    .map((item) => {
      const title = item.game.title_ko || item.game.title || "-";
      const subtitle = item.game.title_en || item.game.subtitle || "";
      const dateText = (item.schedule.dates || []).join(" ~ ") || "-";
      return `
        <button type="button" class="highlight-card${isPastSchedule(item.schedule) ? " is-past" : ""}" data-date-key="${escapeHtml(item.dateKey)}" data-game-id="${escapeHtml(item.game.game_idx)}">
          ${renderImageMarkup(item.game.image || "", title, "highlight-card__image")}
          <div class="highlight-card__body">
            <div class="highlight-card__meta">
              <span class="meta-badge ${statusClass(item.schedule)}">${escapeHtml(item.schedule.status || "-")}</span>
            </div>
            <h4 class="highlight-card__title">${escapeHtml(title)}</h4>
            <p class="highlight-card__subtitle">${escapeHtml(subtitle)}</p>
            <p class="highlight-card__date">${escapeHtml(dateText)}</p>
          </div>
        </button>
      `;
    })
    .join("");

  els.highlightsList.querySelectorAll("[data-date-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const groupedNow = groupItemsByDate();
      selectDate(button.dataset.dateKey, groupedNow, false);
      state.selectedGameId = button.dataset.gameId;
      renderDayList();
      renderDetail();
      openModal();
    });
  });
}

function getHighlightAnchorDate() {
  if (state.filters.month === "all") {
    return todayStart();
  }

  const [year, month] = state.filters.month.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const today = todayStart();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  if (state.filters.month === currentMonthKey) {
    return today;
  }

  if (monthStart > today) {
    return monthStart;
  }

  return monthStart;
}

function renderCalendar(grouped) {
  els.calendarGrid.innerHTML = "";
  if (state.filters.month === "all") {
    setText(els.calendarTitle, "-");
    return;
  }

  if (state.viewMode === "week") {
    renderWeekCalendar(grouped);
    return;
  }

  setText(els.calendarTitle, formatMonthLabel(state.filters.month));
  const [year, month] = state.filters.month.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const todayKey = getTodayKeyForSelectedMonth();

  for (let index = 0; index < totalCells; index += 1) {
    const dayNumber = index - firstDay + 1;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calendar-cell";

    if (dayNumber < 1 || dayNumber > daysInMonth) {
      cell.classList.add("is-empty");
      cell.disabled = true;
      els.calendarGrid.appendChild(cell);
      continue;
    }

    const dateKey = `${state.filters.month}-${String(dayNumber).padStart(2, "0")}`;
    const items = grouped.get(dateKey) || [];
    const dayClass = getDayClass(dateKey);
    cell.classList.toggle("is-selected", dateKey === state.selectedDateKey);
    cell.classList.toggle("is-today", dateKey === todayKey);
    cell.innerHTML = `
      ${items.length ? `<div class="calendar-cell__count">${items.length}</div>` : ""}
      <div class="calendar-cell__day ${dayClass}">${dayNumber}</div>
      <div class="calendar-cell__items">
        ${items
          .slice(0, 2)
          .map((item) => {
            const classes = [
              "calendar-chip",
              statusClass(item.schedule),
              isPastSchedule(item.schedule) ? "is-past" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return `<div class="${classes}">${escapeHtml(truncateText(item.game.title_ko || item.game.title || "-", 12))}</div>`;
          })
          .join("")}
        ${items.length > 2 ? `<div class="calendar-cell__more">+${items.length - 2} more</div>` : ""}
      </div>
    `;
    cell.addEventListener("click", () => selectDate(dateKey, grouped, true));
    els.calendarGrid.appendChild(cell);
  }
}

function renderWeekCalendar(grouped) {
  const anchor = parseDateKey(state.selectedWeekStartKey || state.selectedDateKey || `${state.filters.month}-01`);
  const days = [];
  for (let index = 0; index < 7; index += 1) {
    const current = new Date(anchor);
    current.setDate(anchor.getDate() + index);
    days.push(current);
  }

  const todayKey = getTodayKeyForSelectedMonth();
  setText(els.calendarTitle, `${formatDateLabel(toDateKey(days[0]))} ~ ${formatDateLabel(toDateKey(days[6]))}`);

  days.forEach((date) => {
    const dateKey = toDateKey(date);
    const items = grouped.get(dateKey) || [];
    const dayClass = getDayClass(dateKey);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calendar-cell";
    cell.classList.toggle("is-selected", dateKey === state.selectedDateKey);
    cell.classList.toggle("is-today", dateKey === todayKey);
    cell.innerHTML = `
      ${items.length ? `<div class="calendar-cell__count">${items.length}</div>` : ""}
      <div class="calendar-cell__day ${dayClass}">${date.getDate()}</div>
      <div class="calendar-cell__items">
        ${items
          .slice(0, 2)
          .map((item) => {
            const classes = [
              "calendar-chip",
              statusClass(item.schedule),
              isPastSchedule(item.schedule) ? "is-past" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return `<div class="${classes}">${escapeHtml(truncateText(item.game.title_ko || item.game.title || "-", 12))}</div>`;
          })
          .join("")}
        ${items.length > 2 ? `<div class="calendar-cell__more">+${items.length - 2} more</div>` : ""}
      </div>
    `;
    cell.addEventListener("click", () => {
      state.selectedWeekStartKey = toDateKey(days[0]);
      selectDate(dateKey, grouped, true);
    });
    els.calendarGrid.appendChild(cell);
  });
}

function selectDate(dateKey, grouped, shouldScroll) {
  state.selectedDateKey = dateKey;
  state.dayItems = grouped.get(dateKey) || [];
  state.selectedGameId = state.dayItems[0]?.game.game_idx || null;
  renderCalendar(grouped);
  renderDayList();
  renderDetail();
  if (IS_NOTION_COMPACT && state.dayItems.length) {
    openModal();
    return;
  }
  if (shouldScroll) {
    scrollToDayList();
  }
}

function renderDayList() {
  els.dayList.innerHTML = "";
  if (!state.selectedDateKey) {
    setText(els.dayTitle, "날짜를 선택하세요");
    setText(els.daySummary, "캘린더에서 날짜를 누르면 해당 일정이 나옵니다.");
    return;
  }

  setText(els.dayTitle, formatDateLabel(state.selectedDateKey));
  setText(els.daySummary, `${state.dayItems.length}개의 일정`);

  state.dayItems.forEach((item) => {
    const title = item.game.title_ko || item.game.title || "-";
    const subtitle = item.game.title_en || item.game.subtitle || "";
    const platforms = (item.schedule.platforms || []).map((value) => value.toUpperCase()).join(", ") || "-";
    const dates = (item.schedule.dates || []).join(" ~ ") || "-";
    const summary = truncateText(item.game.description || item.game.subtitle || "", 120);
    const actions = buildCardActions(item.game);
    const actionsClass = actions ? "item-card__actions" : "item-card__actions is-empty";
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "item-card",
      item.game.game_idx === state.selectedGameId ? "is-selected" : "",
      isPastSchedule(item.schedule) ? "is-past" : "",
    ]
      .filter(Boolean)
      .join(" ");
    button.innerHTML = `
      ${renderImageMarkup(item.game.image || "", title, "item-card__image")}
      <div class="item-card__body">
        <div class="item-card__meta">
          <span class="meta-badge ${statusClass(item.schedule)}">${escapeHtml(item.schedule.status || "-")}</span>
          <span class="meta-badge">${escapeHtml(platforms)}</span>
        </div>
        <h4>${escapeHtml(title)}</h4>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
        <div class="item-card__dates">${escapeHtml(dates)}</div>
        ${summary ? `<div class="item-card__summary">${escapeHtml(summary)}</div>` : ""}
        <div class="${actionsClass}">${actions}</div>
      </div>
    `;
    button.addEventListener("click", () => {
      state.selectedGameId = item.game.game_idx;
      renderDayList();
      renderDetail();
      openModal();
    });
    button.querySelectorAll(".item-card__action").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    });
    els.dayList.appendChild(button);
  });
}

function renderDetail() {
  const selected = state.dayItems.find((item) => item.game.game_idx === state.selectedGameId);
  if (!selected) {
    return;
  }

  const { game, schedule } = selected;
  const title = game.title_ko || game.title || "-";
  applyDetailImage(game.image || "", title);
  setText(els.detailKicker, `게임 #${game.game_idx}`);
  setText(els.detailTitle, title);
  setText(els.detailSubtitle, game.title_en || game.subtitle || "");
  els.detailPrimaryMeta.innerHTML = `
    <span class="meta-badge ${statusClass(schedule)}">${escapeHtml(schedule.status || "-")}</span>
    <span class="meta-badge">${escapeHtml((schedule.platforms || []).map((value) => value.toUpperCase()).join(", ") || "-")}</span>
  `;
  setText(els.detailDeveloper, game.developer || "-");
  setText(els.detailPublisher, game.publisher || "-");
  setText(els.detailReleaseDate, (schedule.dates || []).join(" ~ ") || "-");
  setText(els.detailDescription, game.description || "설명이 없습니다.");
  els.detailDescription.classList.add("is-collapsed");
  setText(els.detailDescriptionToggle, "더보기");
  els.detailTags.innerHTML = (game.tags || [])
    .map((tag) => `<span class="schedule-pill">${escapeHtml(tag)}</span>`)
    .join("");
  toggleLink(els.detailHomepage, game.homepage);
  toggleVideoEmbed(game.youtube_embed);
}

function shiftCalendar(offset) {
  if (state.viewMode === "week") {
    shiftWeek(offset);
    return;
  }

  const months = getAllMonthKeys();
  const currentIndex = months.indexOf(state.filters.month);
  const nextIndex = currentIndex + offset;
  if (nextIndex < 0 || nextIndex >= months.length) {
    return;
  }

  state.filters.month = months[nextIndex];
  state.filters.year = state.filters.month.slice(0, 4);
  state.selectedWeekStartKey = `${state.filters.month}-01`;
  renderYearSelect();
  updateView();
}

function shiftWeek(offset) {
  const anchor = parseDateKey(state.selectedWeekStartKey || state.selectedDateKey || `${state.filters.month}-01`);
  anchor.setDate(anchor.getDate() + offset * 7);
  const nextKey = toDateKey(anchor);
  const nextMonth = nextKey.slice(0, 7);

  if (!getAllMonthKeys().includes(nextMonth)) {
    return;
  }

  state.filters.year = nextMonth.slice(0, 4);
  state.filters.month = nextMonth;
  state.selectedWeekStartKey = nextKey;
  renderYearSelect();
  updateView();
}

function syncNavButtons() {
  if (state.viewMode === "week") {
    const anchor = parseDateKey(state.selectedWeekStartKey || state.selectedDateKey || `${state.filters.month}-01`);
    const prev = new Date(anchor);
    const next = new Date(anchor);
    prev.setDate(prev.getDate() - 7);
    next.setDate(next.getDate() + 7);
    els.prevMonth.disabled = !getAllMonthKeys().includes(toDateKey(prev).slice(0, 7));
    els.nextMonth.disabled = !getAllMonthKeys().includes(toDateKey(next).slice(0, 7));
    return;
  }

  const months = getAllMonthKeys();
  const currentIndex = months.indexOf(state.filters.month);
  els.prevMonth.disabled = currentIndex <= 0;
  els.nextMonth.disabled = currentIndex === -1 || currentIndex >= months.length - 1;
}

function toggleHighlights() {
  const hidden = els.highlightsList.classList.toggle("hidden");
  setText(els.toggleHighlights, hidden ? "열기" : "접기");
}

function openModal() {
  els.detailModal.classList.remove("hidden");
  els.detailModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  els.closeModal.focus();
}

function closeModal() {
  els.detailModal.classList.add("hidden");
  els.detailModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function toggleDescription() {
  const collapsed = els.detailDescription.classList.toggle("is-collapsed");
  setText(els.detailDescriptionToggle, collapsed ? "더보기" : "접기");
}

function toggleLink(element, href) {
  if (href) {
    element.href = href;
    element.classList.remove("hidden");
  } else {
    element.removeAttribute("href");
    element.classList.add("hidden");
  }
}

function normalizeVideoUrl(href) {
  if (!href) {
    return "";
  }

  try {
    const url = new URL(href);
    if (!url.hostname.includes("youtube.com")) {
      return href;
    }

    if (url.pathname.startsWith("/embed/")) {
      const videoId = url.pathname.split("/embed/")[1]?.split("/")[0];
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    }

    return href;
  } catch {
    return href;
  }
}

function normalizeEmbedUrl(href) {
  if (!href) {
    return "";
  }

  try {
    const url = new URL(href);
    if (!url.hostname.includes("youtube.com")) {
      return "";
    }

    if (url.pathname.startsWith("/embed/")) {
      const videoId = url.pathname.split("/embed/")[1]?.split("/")[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (url.pathname === "/watch") {
      const videoId = url.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    return href;
  } catch {
    return "";
  }
}

function toggleVideoEmbed(href) {
  const embedUrl = normalizeEmbedUrl(href);
  if (embedUrl) {
    els.detailVideoSection.classList.remove("hidden");
    els.detailVideoEmbed.classList.remove("hidden");
    els.detailVideoEmbed.src = embedUrl;
    return;
  }

  els.detailVideoEmbed.removeAttribute("src");
  els.detailVideoEmbed.classList.add("hidden");
  els.detailVideoSection.classList.add("hidden");
}

function getTodayKeyForSelectedMonth() {
  if (state.filters.month === "all") {
    return null;
  }

  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return key.startsWith(`${state.filters.month}-`) ? key : null;
}

function parseDateKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(value) {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

function formatMonthLabel(value) {
  const [year, month] = value.split("-").map(Number);
  return `${year}년 ${month}월`;
}

function getDayClass(dateKey) {
  const day = parseDateKey(dateKey).getDay();
  if (day === 0) return "is-sunday";
  if (day === 6) return "is-saturday";
  return "";
}

function truncateText(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}…`;
}

function buildCardActions(game) {
  const actions = [];
  if (game.homepage) {
    actions.push(
      `<a class="item-card__action" href="${escapeHtml(game.homepage)}" target="_blank" rel="noopener noreferrer">홈페이지</a>`
    );
  }
  const videoUrl = normalizeVideoUrl(game.youtube_embed);
  if (videoUrl) {
    actions.push(
      `<a class="item-card__action" href="${escapeHtml(videoUrl)}" target="_blank" rel="noopener noreferrer">영상</a>`
    );
  }
  return actions.join("");
}

function statusClass(schedule) {
  const types = (schedule.source_types || []).map((value) => String(value).toLowerCase());
  const status = String(schedule.status || "").toLowerCase();
  if (types.includes("release") || status.includes("출시")) return "is-release";
  if (types.includes("test") || status.includes("테스트")) return "is-test";
  if (types.includes("early") || status.includes("얼리")) return "is-early";
  if (types.includes("event") || status.includes("행사")) return "is-event";
  return "";
}

function formatSourceTypes(values) {
  const filtered = values.filter((value) => value && value !== "all");
  return filtered.length ? filtered.join(", ").toUpperCase() : "ALL";
}

function renderImageMarkup(src, alt, className) {
  if (!src) {
    return `<div class="${className} image-fallback">NO IMAGE</div>`;
  }

  return `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" onerror="this.replaceWith(createImageFallback(this.className))">`;
}

function createImageFallback(className) {
  const fallback = document.createElement("div");
  fallback.className = `${className} image-fallback`;
  fallback.textContent = "NO IMAGE";
  return fallback;
}

function applyDetailImage(src, alt) {
  els.detailImageSlot.innerHTML = "";
  if (!src) {
    els.detailImageSlot.appendChild(createImageFallback("detail-content__image"));
    return;
  }

  const image = document.createElement("img");
  image.className = "detail-content__image";
  image.src = src;
  image.alt = alt;
  image.addEventListener("error", () => {
    image.replaceWith(createImageFallback("detail-content__image"));
  });
  els.detailImageSlot.appendChild(image);
}

function scrollToDayList() {
  const panel = els.dayList.closest(".day-panel");
  if (panel) {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

loadDataset();
