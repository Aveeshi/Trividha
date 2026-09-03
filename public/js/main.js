/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — app shell
 * View switching, clock, text-size, language grid, emergency button.
 * ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  buildLanguageGrid();
  initClock();
  initTextSize();
  initLanguagePill();
  initEmergencyButton();
  initLangBackButton();

  // Returning visitor who already picked a language: skip straight to home.
  // Checks both localStorage and the trividha_lang cookie, since the cookie
  // is what keeps the choice alive if localStorage ever gets cleared.
  const stored = hasStoredLanguage();

  applyLanguage(getCurrentLanguage());

  // ?change=1 means the user deliberately opened the language picker again
  // (top-nav "English" pill) — never auto-redirect them away from it.
  const wantsLanguageChange = new URLSearchParams(window.location.search).get("change") === "1";

  if (window.location.pathname === "/") {
    if (stored && !wantsLanguageChange) {
      // Returning visitor landing on "/" with no explicit intent to change: skip ahead.
      window.location.href = "/home";
    } else {
      showView("view-language");
      // Only show "Back" when there's somewhere sensible to go back to —
      // i.e. this is a language *change*, not a brand-new visitor's first pick.
      const backBtn = document.getElementById("lang-back-btn");
      if (backBtn) backBtn.hidden = !stored;
    }
  } else if (!stored) {
    // First-time visitor landed directly on an inner page (e.g. a bookmark
    // or a shared link) without ever picking a language — send them to pick one first.
    window.location.href = "/";
  }
});

function showView(viewId) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("is-active"));
  const target = document.getElementById(viewId);
  if (target) target.classList.add("is-active");
}

function buildLanguageGrid() {
  const grid = document.getElementById("lang-grid");
  if (!grid) return;

  grid.innerHTML = "";
  LANGUAGES.forEach((lang) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lang-tile";
    btn.dataset.langCode = lang.code;
    btn.innerHTML = `${lang.native}<span class="lang-english-name">${lang.english}</span>`;
    btn.addEventListener("click", () => selectLanguage(lang.code));
    grid.appendChild(btn);
  });
}

function selectLanguage(langCode) {
  document.querySelectorAll(".lang-tile").forEach((t) => {
    t.classList.toggle("is-selected", t.dataset.langCode === langCode);
  });
  applyLanguage(langCode);

  // brief pause so the selection highlight is visible before advancing
  setTimeout(() => {
    window.location.href = "/home";
  }, 250);
}

// "Back" button shown on the language picker when it was opened mid-flow
// (via the top-nav language pill) rather than as a first-time visitor.
function initLangBackButton() {
  const btn = document.getElementById("lang-back-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (document.referrer && document.referrer.indexOf(window.location.origin) === 0) {
      window.location.href = document.referrer;
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/home";
    }
  });
}

function initClock() {
  const timeEl = document.getElementById("clock-time");
  const dateEl = document.getElementById("clock-date");
  if (!timeEl || !dateEl) return;

  function tick() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  }
  tick();
  setInterval(tick, 1000 * 15);
}

function initTextSize() {
  const buttons = document.querySelectorAll("[data-text-step]");
  if (!buttons.length) return;

  const MIN = 0.9;
  const MAX = 1.3;
  const STEP = 0.1;

  function applyStep(step) {
    document.documentElement.style.setProperty("--step", step.toFixed(2));
  }

  let current = 1;
  applyStep(current);

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const delta = parseFloat(btn.dataset.textStep);
      current = Math.min(MAX, Math.max(MIN, current + delta));
      applyStep(current);
    });
  });
}

function initLanguagePill() {
  const pill = document.getElementById("lang-pill-btn");
  if (!pill) return;
  pill.addEventListener("click", () => {
    if (window.location.pathname === "/") {
      showView("view-language");
      const backBtn = document.getElementById("lang-back-btn");
      if (backBtn) backBtn.hidden = false;
    } else {
      window.location.href = "/?change=1";
    }
  });
}

function initEmergencyButton() {
  const btn = document.getElementById("emergency-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    // Placeholder: hook up to the real emergency flow when it exists.
    window.alert(getTranslation(getCurrentLanguage(), "emergency") + "\n1800-103-2043");
  });
}
