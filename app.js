/* =========================
   Dov Fuchs Digital Art - app.js
   - Loads image_data.json
   - Filters: search + theme
   - Sort: Newest / Oldest / A→Z / Z→A
   - Lightbox
   ========================= */

const DATA_URL = "./image_data.json"; // <-- must match your file name exactly
const IMAGES_DIR = "./images/";       // folder that contains the jpg files

// Elements
const elSearch = document.getElementById("searchInput");
const elTheme = document.getElementById("themeSelect");
const elSort = document.getElementById("sortSelect");
const elGrid = document.getElementById("grid");
const elStatus = document.getElementById("status");
const elCount = document.getElementById("countLabel");

const elLightbox = document.getElementById("lightbox");
const elLightboxClose = document.getElementById("lightboxClose");
const elLightboxImg = document.getElementById("lightboxImg");
const elLightboxTitle = document.getElementById("lightboxTitle");

let ALL = [];
let FILTERED = [];

// ---------- Helpers ----------
function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function norm(s) {
  return safeText(s).trim().toLowerCase();
}

function parseYear(v) {
  const n = Number(String(v || "").trim());
  return Number.isFinite(n) ? n : null;
}

function splitThemes(v) {
  // Accept: "" | "A;B" | "A, B" | ["A","B"] | null
  if (Array.isArray(v)) return v.map(safeText).map(s => s.trim()).filter(Boolean);
  const s = safeText(v);
  if (!s) return [];
  return s
    .split(/[;,]/g)
    .map(t => t.trim())
    .filter(Boolean);
}

function buildSortKey(item) {
  // Priority:
  // 1) year (if exists)
  // 2) id (if numeric)
  // 3) file order index (we inject _idx)
  const y = parseYear(item.year);
  const id = Number(item.id);
  const idOk = Number.isFinite(id);

  return {
    year: y !== null ? y : -1,
    id: idOk ? id : -1,
    idx: Number.isFinite(item._idx) ? item._idx : 0,
  };
}

function compareNewest(a, b) {
  const ka = buildSortKey(a);
  const kb = buildSortKey(b);

  // Descending year, then descending id, then descending idx
  if (kb.year !== ka.year) return kb.year - ka.year;
  if (kb.id !== ka.id) return kb.id - ka.id;
  return kb.idx - ka.idx;
}

function compareOldest(a, b) {
  const ka = buildSortKey(a);
  const kb = buildSortKey(b);

  // Ascending year (but -1 should go last), then ascending id, then ascending idx
  const ay = ka.year === -1 ? Number.POSITIVE_INFINITY : ka.year;
  const by = kb.year === -1 ? Number.POSITIVE_INFINITY : kb.year;
  if (ay !== by) return ay - by;

  const aid = ka.id === -1 ? Number.POSITIVE_INFINITY : ka.id;
  const bid = kb.id === -1 ? Number.POSITIVE_INFINITY : kb.id;
  if (aid !== bid) return aid - bid;

  return ka.idx - kb.idx;
}

function compareAZ(a, b) {
  return safeText(a.name).localeCompare(safeText(b.name), undefined, { sensitivity: "base" });
}

function compareZA(a, b) {
  return safeText(b.name).localeCompare(safeText(a.name), undefined, { sensitivity: "base" });
}

function setStatus(msg) {
  if (elStatus) elStatus.textContent = msg || "";
}

function setCount(n, total) {
  if (!elCount) return;
  if (typeof total === "number") elCount.textContent = `${n} shown`;
  else elCount.textContent = `${n} shown`;
}

// ---------- Data loading ----------
async function loadData() {
  setStatus("Loading…");
  const res = await fetch(DATA_URL, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to load ${DATA_URL} (${res.status})`);
  }

  const json = await res.json();

  // Accept either {images:[...]} or direct array
  const arr = Array.isArray(json) ? json : Array.isArray(json.images) ? json.images : [];

  // Normalize items
  const normalized = arr.map((it, idx) => {
    const themesArr = splitThemes(it.themes);
    return {
      id: it.id,
      name: safeText(it.name),
      description: safeText(it.description),
      themes: themesArr,             // array
      year: safeText(it.year),
      filename: safeText(it.filename),
      _idx: idx,                     // file order
    };
  });

  ALL = normalized.filter(x => x.filename && x.name);
  if (ALL.length === 0) {
    setStatus("No items found in JSON.");
    setCount(0, 0);
    return;
  }

  populateThemeDropdown(ALL);
  setStatus("");
  applyFilters();
}

function populateThemeDropdown(items) {
  if (!elTheme) return;

  const set = new Set();
  for (const it of items) {
    for (const t of it.themes) set.add(t);
  }

  const themes = Array.from(set).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  // Keep existing first option (All Themes)
  const keepFirst = elTheme.querySelector("option[value='']");
  elTheme.innerHTML = "";
  if (keepFirst) elTheme.appendChild(keepFirst);
  else {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "All Themes";
    elTheme.appendChild(opt);
  }

  for (const t of themes) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    elTheme.appendChild(opt);
  }
}

// ---------- Filtering + sorting ----------
function applyFilters() {
  const q = norm(elSearch?.value);
  const theme = safeText(elTheme?.value).trim();
  const sortMode = safeText(elSort?.value).trim() || "newest";

  let out = ALL.slice();

  if (q) {
    out = out.filter(it => norm(it.name).includes(q));
  }

  if (theme) {
    out = out.filter(it => it.themes.includes(theme));
  }

  // Sort
  if (sortMode === "newest") out.sort(compareNewest);
  else if (sortMode === "oldest") out.sort(compareOldest);
  else if (sortMode === "az") out.sort(compareAZ);
  else if (sortMode === "za") out.sort(compareZA);
  else out.sort(compareNewest);

  FILTERED = out;
  renderGrid(FILTERED);
  setCount(FILTERED.length, ALL.length);
}

function renderGrid(items) {
  if (!elGrid) return;
  elGrid.innerHTML = "";

  for (const it of items) {
    const card = document.createElement("div");
    card.className = "card";
    card.tabIndex = 0;

    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = it.name;
    img.src = IMAGES_DIR + encodeURIComponent(it.filename);

    const cap = document.createElement("div");
    cap.className = "caption";
    cap.textContent = it.name;

    card.appendChild(img);
    card.appendChild(cap);

    card.addEventListener("click", () => openLightbox(it));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLightbox(it);
      }
    });

    elGrid.appendChild(card);
  }
}

// ---------- Lightbox ----------
function openLightbox(it) {
  if (!elLightbox) return;
  elLightbox.classList.add("open");
  elLightbox.setAttribute("aria-hidden", "false");

  if (elLightboxImg) {
    elLightboxImg.src = IMAGES_DIR + encodeURIComponent(it.filename);
    elLightboxImg.alt = it.name || "";
  }
  if (elLightboxTitle) {
    elLightboxTitle.textContent = it.name || "";
  }
}

function closeLightbox() {
  if (!elLightbox) return;
  elLightbox.classList.remove("open");
  elLightbox.setAttribute("aria-hidden", "true");

  if (elLightboxImg) {
    elLightboxImg.src = "";
    elLightboxImg.alt = "";
  }
  if (elLightboxTitle) elLightboxTitle.textContent = "";
}

// ---------- Wire events ----------
function wireUI() {
  if (elSearch) elSearch.addEventListener("input", applyFilters);
  if (elTheme) elTheme.addEventListener("change", applyFilters);
  if (elSort) elSort.addEventListener("change", applyFilters);

  if (elLightboxClose) elLightboxClose.addEventListener("click", closeLightbox);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });

  if (elLightbox) {
    elLightbox.addEventListener("click", (e) => {
      // click outside the image closes
      if (e.target === elLightbox) closeLightbox();
    });
  }
}

// ---------- Boot ----------
(async function init() {
  try {
    wireUI();
    await loadData();
  } catch (err) {
    setStatus("Load error. Check JSON file name and format.");
    console.error(err);
  }
})();