"use strict";

const DATA_URL = "./image_data.json";

// Elements
const elGrid = document.getElementById("grid");
const elStatus = document.getElementById("status");
const elSearch = document.getElementById("searchInput");
const elTheme = document.getElementById("themeSelect");
const elSort = document.getElementById("sortSelect");
const elCount = document.getElementById("countLabel");

const elLightbox = document.getElementById("lightbox");
const elLightboxImg = document.getElementById("lightboxImg");
const elLightboxTitle = document.getElementById("lightboxTitle");
const elLightboxClose = document.getElementById("lightboxClose");

let ALL = [];
let FILTERED = [];

// ---------- helpers ----------
function normalizeText(s) {
  return String(s || "").toLowerCase().trim();
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseTs(s) {
  const t = Date.parse(String(s || ""));
  return Number.isFinite(t) ? t : 0;
}

/*
Sort key priority:
1) x.year if it's a real date/ISO ("2026-02-24", "2026-02-24T...")
2) x.year if it's "YYYY"
3) YYYY-MM-DD inside filename
4) numeric id fallback, but we invert it so higher id = newer (common case)
5) JSON generated timestamp
6) 0
*/
function deriveItemTs(x, jsonGeneratedTs) {
  const yearRaw = x && x.year != null ? String(x.year).trim() : "";

  // 1) ISO/date-like in year field
  const parsedYear = Date.parse(yearRaw);
  if (Number.isFinite(parsedYear)) return parsedYear;

  // 2) plain year "2024"
  if (/^\d{4}$/.test(yearRaw)) {
    const t = Date.parse(`${yearRaw}-01-01T00:00:00Z`);
    return Number.isFinite(t) ? t : 0;
  }

  // 3) try to find YYYY-MM-DD in filename
  const fn = x && x.filename != null ? String(x.filename) : "";
  const m = fn.match(/(19|20)\d{2}-\d{2}-\d{2}/);
  if (m) {
    const t = Date.parse(`${m[0]}T00:00:00Z`);
    if (Number.isFinite(t)) return t;
  }

  // 4) numeric id fallback:
  // Your IDs behave like "smaller = newer" (reverse of usual),
  // so we invert the number to make bigger = newer.
  const idNum = Number(x && x.id != null ? x.id : NaN);
  if (Number.isFinite(idNum)) return -idNum;

  // 5) JSON generated timestamp
  if (Number.isFinite(jsonGeneratedTs) && jsonGeneratedTs) return jsonGeneratedTs;

  return 0;
}

function coerceItems(data) {
  if (!data || !Array.isArray(data.images)) return [];

  const generatedTs = parseTs(data.generated);

  return data.images
    .map((x, i) => {
      const filename = x.filename ?? "";
      const clean = String(filename).replace(/^\.?\/?images\/?/i, "");

      return {
        id: x.id ?? i + 1,
        title: x.name ?? "Untitled",
        theme: x.themes ?? "",
        filename: clean,
        ts: deriveItemTs({ ...x, filename: clean }, generatedTs),
        url: "./images/" + clean,
        order: i, // stable tie-breaker
      };
    })
    .filter((it) => it.filename && it.title);
}

function uniqueThemes(items) {
  const set = new Set();
  items.forEach((it) => {
    const t = String(it.theme || "").trim();
    if (t) set.add(t);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function fillThemeDropdown(items) {
  const themes = uniqueThemes(items);
  elTheme.innerHTML =
    `<option value="">All Themes</option>` +
    themes.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
}

function fillSortDropdown() {
  elSort.innerHTML = `
    <option value="newest">Newest</option>
    <option value="oldest">Oldest</option>
    <option value="az">A → Z</option>
    <option value="za">Z → A</option>
  `;
}

function applyFilters() {
  const q = normalizeText(elSearch.value);
  const theme = elTheme.value;

  let out = ALL;

  if (theme) out = out.filter((it) => String(it.theme).trim() === theme);
  if (q) out = out.filter((it) => normalizeText(it.title).includes(q));

  const sortMode = elSort.value;

  out = out.slice().sort((a, b) => {
    if (sortMode === "newest") {
      const d = (b.ts || 0) - (a.ts || 0);
      return d !== 0 ? d : (b.order - a.order);
    }
    if (sortMode === "oldest") {
      const d = (a.ts || 0) - (b.ts || 0);
      return d !== 0 ? d : (a.order - b.order);
    }
    if (sortMode === "za") return b.title.localeCompare(a.title);
    return a.title.localeCompare(b.title); // az
  });

  FILTERED = out;
  render();
}

function render() {
  elGrid.innerHTML = "";
  elCount.textContent = `${FILTERED.length} shown`;

  if (!FILTERED.length) {
    elStatus.textContent = "No results.";
    return;
  }

  elStatus.textContent = "";

  const frag = document.createDocumentFragment();

  FILTERED.forEach((it) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.tabIndex = 0;

    const img = document.createElement("img");
    img.className = "tileImg";
    img.src = it.url;
    img.alt = it.title;
    img.loading = "lazy";

    const cap = document.createElement("div");
    cap.className = "tileCaption";
    cap.textContent = it.title;

    tile.appendChild(img);
    tile.appendChild(cap);

    tile.addEventListener("click", () => openLightbox(it));
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openLightbox(it);
    });

    frag.appendChild(tile);
  });

  elGrid.appendChild(frag);
}

function openLightbox(it) {
  elLightboxImg.src = it.url;
  elLightboxImg.alt = it.title;
  elLightboxTitle.textContent = it.title;

  elLightbox.classList.add("open");
  elLightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  elLightbox.classList.remove("open");
  elLightbox.setAttribute("aria-hidden", "true");
  elLightboxImg.src = "";
  elLightboxTitle.textContent = "";
}

// Lightbox events
elLightboxClose.addEventListener("click", closeLightbox);
elLightbox.addEventListener("click", (e) => {
  if (e.target === elLightbox) closeLightbox();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

// Filters events
elSearch.addEventListener("input", applyFilters);
elTheme.addEventListener("change", applyFilters);
elSort.addEventListener("change", applyFilters);

async function init() {
  try {
    elStatus.textContent = "Loading…";

    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);

    const data = await res.json();
    ALL = coerceItems(data);

    if (!ALL.length) {
      elStatus.textContent = "No items found in JSON.";
      return;
    }

    fillThemeDropdown(ALL);
    fillSortDropdown();

    elSort.value = "newest";
    applyFilters();
  } catch (err) {
    console.error(err);
    elStatus.textContent = "Load error. Check JSON file name and format.";
  }
}

init();