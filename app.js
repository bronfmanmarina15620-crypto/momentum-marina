/* מומנטום — מערכת הפעלה אישית (Marina) */
(function () {
  "use strict";

  const TZ = "Asia/Jerusalem";
  const STORAGE_KEY = "momentum-marina-v1";
  const BASE = (() => {
    const p = location.pathname;
    if (p.includes("/momentum-marina")) return "/momentum-marina/";
    return "./";
  })();

  /* ---------- PWA install helpers ---------- */
  let deferredInstallPrompt = null;
  let installUiReady = false;
  let relatedAppsInstalled = false;

  function isStandaloneDisplay() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      // iOS Safari "Add to Home Screen"
      window.navigator.standalone === true
    );
  }

  function isInAppBrowser() {
    if (isStandaloneDisplay()) return false;
    const ua = navigator.userAgent || "";
    // Common in-app WebViews (WhatsApp, Facebook, Instagram, etc.)
    if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|Twitter|LinkedInApp|Snapchat|Messenger|TikTok|BytedanceWebview|MicroMessenger|Pinterest|Discord/i.test(ua)) {
      return true;
    }
    // Android WebView marker
    if (/;\s*wv\)/i.test(ua) || /\bwv\b/i.test(ua)) return true;
    if (/WebView/i.test(ua)) return true;
    // Android Chrome-like UA without Safari token often means WebView
    if (/Android/i.test(ua) && /Version\/\d+\.?\d*/i.test(ua) && /Chrome\//i.test(ua) && !/Safari\//i.test(ua)) {
      return true;
    }
    return false;
  }

  function canShowInstallUi() {
    if (isStandaloneDisplay() || relatedAppsInstalled) return false;
    return true;
  }

  function installInstructionsText() {
    return (
      "התקנה למסך הבית:\n\n" +
      "1. פתחי את הקישור ב־Chrome (לא בוואטסאפ / אינסטגרם).\n" +
      "2. תפריט ⋮ ← «הוסף למסך הבית» או «התקן אפליקציה».\n\n" +
      "ב־iPhone (Safari): שתף ← הוסף למסך הבית.\n\n" +
      "אם אין כפתור התקן — ודאי שנפתח ב־Chrome מהכתובת github.io."
    );
  }

  async function promptInstall() {
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        if (choice && choice.outcome === "accepted") {
          toast("הותקן! חפשי את מומנטום במסך הבית");
          updateInstallUi();
          return;
        }
      } catch (_) {
        /* fall through to instructions */
      }
    }
    alert(installInstructionsText());
  }

  function updateInstallUi() {
    const show = canShowInstallUi();
    const headerBtn = document.getElementById("header-install-btn");
    if (headerBtn) {
      headerBtn.hidden = !show;
      headerBtn.onclick = show ? () => promptInstall() : null;
    }
    const banner = document.getElementById("webview-banner");
    if (banner) {
      banner.hidden = !(show && isInAppBrowser());
    }
    // Re-render current screen so install cards stay in sync
    if (installUiReady && (currentScreen === "today" || currentScreen === "settings")) {
      // Avoid recursion during first boot: only refresh install widgets in-place when possible
      const todayBtn = document.getElementById("today-install-btn");
      const settingsBtn = document.getElementById("settings-install-btn");
      const todayCard = document.getElementById("today-install-card");
      const settingsCard = document.getElementById("settings-install-card");
      if (todayCard) todayCard.hidden = !show;
      if (settingsCard) settingsCard.hidden = !show;
      if (todayBtn) todayBtn.hidden = !show;
      if (settingsBtn) settingsBtn.hidden = !show;
    }
  }

  function installCardHtml(idPrefix) {
    if (!canShowInstallUi()) return "";
    const hasPrompt = !!deferredInstallPrompt;
    const fallback = hasPrompt
      ? ""
      : `<p class="install-fallback">אם הכפתור לא פותח התקנה (Samsung/Chrome): תפריט <kbd>⋮</kbd> ← <strong>הוסף למסך הבית</strong> / <strong>התקן אפליקציה</strong>. חובה לפתוח ב־Chrome, לא בוואטסאפ.</p>`;
    return `<section class="card install-card" id="${idPrefix}-install-card">
      <h2>התקנה למסך הבית</h2>
      <p class="muted">לחיצה אחת — מומנטום כקיצור במסך הבית, במסך מלא בלי שורת כתובת.</p>
      <button type="button" class="btn install-btn block" id="${idPrefix}-install-btn">התקן למסך הבית</button>
      ${fallback}
    </section>`;
  }

  function bindInstallButtons() {
    ["today-install-btn", "settings-install-btn", "header-install-btn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.hidden) el.onclick = () => promptInstall();
    });
  }

  /* ---------- Date helpers (Asia/Jerusalem) ---------- 
  function jerusalemParts(d = new Date()) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
    return parts;
  }

  function todayKey(d = new Date()) {
    const p = jerusalemParts(d);
    return `${p.year}-${p.month}-${p.day}`;
  }

  function parseKey(key) {
    const [y, m, day] = key.split("-").map(Number);
    return { y, m, day };
  }

  function addDaysKey(key, n) {
    const { y, m, day } = parseKey(key);
    // Use noon UTC to avoid DST edge issues when shifting
    const dt = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
    dt.setUTCDate(dt.getUTCDate() + n);
    return todayKey(dt);
  }

  function formatHebrewDate(key) {
    const { y, m, day } = parseKey(key);
    const dt = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat("he-IL", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(dt);
  }

  function weekdayIndexSun0(key) {
    // Return 0=Sunday … 6=Saturday in Jerusalem
    const { y, m, day } = parseKey(key);
    const dt = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(dt);
    return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd];
  }

  function isSunday(key) {
    return weekdayIndexSun0(key) === 0;
  }

  function weekStartKey(key) {
    const idx = weekdayIndexSun0(key);
    return addDaysKey(key, -idx);
  }

  /* ---------- Habits catalog ---------- */
  const HABITS = [
    {
      id: 1,
      title: "מנצחים את המחר בלילה",
      short: "תכנון לילה, Brain Dump, שינה",
      layer: "תשתית ביולוגית",
      color: "#c45c26",
      checks: [
        { key: "brainDump", label: "Brain Dump ליד המיטה", hint: "כל המחשבות והלולאות הפתוחות על הדף" },
        { key: "tomorrowTasks", label: "משימות המחר מסונכרנות", hint: "העברת משימות פתוחות ליומן/רשימת המחר" },
        { key: "sleepReminder", label: "שעון מעורר לשינה", hint: "התראה שמכריחה לסגור את היום" },
        { key: "weeklyPlan", label: "תכנון שבועי (יום ראשון)", hint: "רק ביום ראשון — תכנון השבוע הקרוב", sundayOnly: true },
      ],
      fields: [
        { key: "dumpText", type: "textarea", label: "Brain Dump", placeholder: "מה רץ בראש עכשיו…" },
        { key: "tomorrowText", type: "textarea", label: "משימות למחר", placeholder: "3–5 דברים חשובים למחר…" },
        { key: "weeklyText", type: "textarea", label: "תכנון שבועי", placeholder: "יעדי השבוע…", sundayOnly: true },
      ],
    },
    {
      id: 2,
      title: "הגנת 60 דקות ראשונות",
      short: "Input Fasting, מים, תנועה",
      layer: "תשתית ביולוגית",
      checks: [
        { key: "inputFast", label: "Input Fasting", hint: "בלי מייל / חדשות / רשתות ב־60 הדקות הראשונות" },
        { key: "hydrate", label: "הידרציה מיידית", hint: "בקבוק מים שלם מיד אחרי ההשכמה" },
        { key: "move", label: "הנעת הגוף", hint: "הליכה / כוח / שבירת זיעה מוקדמת" },
      ],
      fields: [],
    },
    {
      id: 3,
      title: "משפך 1-2-3",
      short: "ריקון → 2 עדיפויות → 3 תודות",
      layer: "מנוע קוגניטיבי",
      checks: [
        { key: "funnelDump", label: "ריקון בוקר", hint: "שפיכת עומס ודאגות על הדף" },
        { key: "priorities", label: "2 עדיפויות בלבד", hint: "שני פרויקטים משמעותיים להיום" },
        { key: "gratitudes", label: "3 תודות", hint: "כולל דבר אחד בנאלי לגמרי" },
      ],
      fields: [
        { key: "funnelDumpText", type: "textarea", label: "ריקון", placeholder: "מה מעמיס עליי הבוקר…" },
        { key: "p1", type: "text", label: "עדיפות 1", placeholder: "הדבר החשוב ביותר היום" },
        { key: "p2", type: "text", label: "עדיפות 2", placeholder: "הדבר השני בחשיבותו" },
        { key: "g1", type: "text", label: "תודה 1", placeholder: "…" },
        { key: "g2", type: "text", label: "תודה 2", placeholder: "…" },
        { key: "g3", type: "text", label: "תודה 3 (בנאלי)", placeholder: "למשל: כוס הקפה של הבוקר" },
      ],
    },
    {
      id: 4,
      title: "Just-in-Time learning",
      short: "בעיה בוערת + למידה + יישום JFDI",
      layer: "מנוע קוגניטיבי",
      checks: [
        { key: "burning", label: "זיהיתי בעיה בוערת", hint: "מה הצריך פתרון היום?" },
        { key: "learned", label: "למדתי משהו ממוקד", hint: "ידע ספציפי לפתרון — לא Just-in-Case" },
        { key: "jfdi", label: "יישום מיידי (JFDI)", hint: "עצרתי ויישמתי בשטח" },
      ],
      fields: [
        { key: "burningText", type: "text", label: "הבעיה הבוערת", placeholder: "מה חייב פתרון היום?" },
        { key: "learnText", type: "textarea", label: "מה למדתי", placeholder: "תובנה / מקור / עמוד…" },
        { key: "applyText", type: "textarea", label: "איך יישמתי", placeholder: "מה עשיתי בפועל…" },
      ],
    },
    {
      id: 5,
      title: "עיצוב סביבה",
      short: "מסננים: עוזרים מול שואבים",
      layer: "ארכיטקטורה חיצונית",
      checks: [
        { key: "envHelp", label: "חיזקתי סביבה תומכת", hint: "אנשים/מקומות שמרימים אותי" },
        { key: "envDrain", label: "צמצמתי שואבי אנרגיה", hint: "פחות חיכוך, פחות הסחות" },
        { key: "envEasy", label: "הפעולה הנכונה = הקלה ביותר", hint: "עיצוב מרחב בלי חיכוך" },
      ],
      fields: [
        { key: "helpPeople", type: "text", label: "מי/מה עוזר היום", placeholder: "אנשים, מקומות, כלים…" },
        { key: "drainPeople", type: "text", label: "מי/מה שואב", placeholder: "להקטין חשיפה…" },
        { key: "frictionFix", type: "text", label: "תיקון חיכוך", placeholder: "מה הפכתי לקל יותר?" },
      ],
    },
    {
      id: 6,
      title: "מדדים",
      short: "מספר אחד + מבט יומי + סקירה שבועית",
      layer: "ארכיטקטורה חיצונית",
      checks: [
        { key: "northstarLogged", label: "רשמתי מדד כוכב הצפון", hint: "המספר האחד שבחרת בהגדרות — האם השבוע זז לכיוון הנכון" },
        { key: "scorecard", label: "מילאתי כרטיס יומי (Scorecard)", hint: "מבט קצר: המספר + איך את מרגישה לגביו — לא אקסל" },
        { key: "constraint", label: "סקירה שבועית (פונקציית אילוץ)", hint: "שיחה קבועה עם עצמך על המספרים — מחויבות שלא מדלגים" },
      ],
      fields: [
        { key: "northstarValue", type: "number", label: "המספר של היום", placeholder: "לפי המדד שבחרת בהגדרות" },
        { key: "scoreNote", type: "textarea", label: "מה המספר אומר לי היום", placeholder: "איך את מרגישה לגביו? מה הוא מספר לך…" },
      ],
    },
    {
      id: 7,
      title: "מומנטום",
      short: "עשוי > מושלם · רצף · חגיגה",
      layer: "מכפילי כוח",
      checks: [
        { key: "doneOverPerfect", label: "עשוי עדיף ממושלם", hint: "אימון גרוע עדיף על אפס אימון" },
        { key: "noTwoMiss", label: "לא הפסדתי יומיים ברצף", hint: "מותר יום אחד — אסור שניים" },
        { key: "celebrate", label: "חגגתי ניצחון קטן", hint: "תדלוק המומנטום להמשך" },
      ],
      fields: [
        { key: "winText", type: "text", label: "הניצחון של היום", placeholder: "מה עשיתי למרות…" },
      ],
    },
    {
      id: 8,
      title: "בחירה בקושי",
      short: "אתגר קשה + מחויבות",
      layer: "מכפילי כוח",
      checks: [
        { key: "hardChoice", label: "בחרתי בקושי היום", hint: "החלטה קשה במקום הקלה" },
        { key: "challengeActive", label: "עבדתי על האתגר שלי", hint: "אתגר שמפחיד ובונה אופי" },
        { key: "embraceWall", label: "אימצתי את הקיר", hint: "כשהיה קשה — אמרתי: מצוין" },
      ],
      fields: [
        { key: "challengeText", type: "text", label: "האתגר הנוכחי", placeholder: "למשל: 10 ק״מ / פרויקט קשה…" },
        { key: "commitNote", type: "textarea", label: "הצהרת מחויבות", placeholder: "למה אני מתחייבת — בכתב…" },
      ],
    },
  ];

  const ALL_CHECK_KEYS = HABITS.flatMap((h) =>
    h.checks.map((c) => ({ habitId: h.id, ...c }))
  );

  const BLOCKER_TAGS = [
    { id: "time", label: "זמן" },
    { id: "energy", label: "אנרגיה" },
    { id: "distract", label: "הסחות" },
    { id: "forgot", label: "שכחתי" },
    { id: "easy", label: "בחרתי בקל" },
    { id: "other", label: "אחר" },
  ];

  const MIN_ACTIONS = {
    1: "מינימום: 2 דקות Brain Dump ליד המיטה לפני השינה.",
    2: "מינימום: מים + 5 דקות בלי מסך. זה כבר Input Fasting.",
    3: "מינימום: עדיפות אחת + תודה אחת. משפך מצומצם עדיין משפך.",
    4: "מינימום: שאלה אחת בוערת + יישום קצר אחד.",
    5: "מינימום: הסרת הסחה אחת קטנה מהסביבה.",
    6: "מינימום: רשמי מספר אחד של כוכב הצפון — בלי סיפור ארוך.",
    7: "מינימום: ניצחון קטן אחד. עשוי עדיף ממושלם.",
    8: "מינימום: בחירה קשה אחת קטנה היום — ואמרי: מצוין.",
  };


  function relevantChecks(habit, dayKey) {
    return habit.checks.filter((c) => !c.sundayOnly || isSunday(dayKey));
  }

  function relevantFields(habit, dayKey) {
    return habit.fields.filter((f) => !f.sundayOnly || isSunday(dayKey));
  }

  function totalChecksForDay(dayKey) {
    return HABITS.reduce((n, h) => n + relevantChecks(h, dayKey).length, 0);
  }

  /* ---------- Storage ---------- */
  function defaultState() {
    return {
      version: 1,
      settings: {
        northstarName: "מדד כוכב הצפון שלי",
        northstarTarget: "",
        sleepAlarm: "22:30",
        challenge: "",
        helpList: [],
        drainList: [],
      },
      days: {}, // key -> day record
      weekly: {}, // weekStartKey -> { notes, wins, lessons, nextFocus, completed }
    };
  }

  function emptyDay(dayKey) {
    return {
      key: dayKey,
      checks: {},
      fields: {},
      reflections: {}, // habitId -> { how, blocker, tags[] }
      dailyScore: null, // 1-10 subjective
      note: "",
      updatedAt: null,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, settings: { ...defaultState().settings, ...(parsed.settings || {}) } };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    state.savedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  let state = loadState();

  function getDay(dayKey) {
    if (!state.days[dayKey]) state.days[dayKey] = emptyDay(dayKey);
    const day = state.days[dayKey];
    if (!day.reflections || typeof day.reflections !== "object") day.reflections = {};
    return day;
  }

  function getReflection(day, habitId) {
    const id = String(habitId);
    if (!day.reflections[id]) day.reflections[id] = { how: "", blocker: "", tags: [] };
    const r = day.reflections[id];
    if (!Array.isArray(r.tags)) r.tags = [];
    if (r.how == null) r.how = "";
    if (r.blocker == null) r.blocker = "";
    return r;
  }

  function setReflection(habitId, patch) {
    const day = getDay(todayKey());
    const r = getReflection(day, habitId);
    if (patch.how !== undefined) r.how = patch.how;
    if (patch.blocker !== undefined) r.blocker = patch.blocker;
    if (patch.tags !== undefined) r.tags = patch.tags;
    day.updatedAt = new Date().toISOString();
    saveState();
  }

  function reflectionHasContent(r) {
    if (!r) return false;
    return !!(String(r.how || "").trim() || String(r.blocker || "").trim() || (r.tags && r.tags.length));
  }

  function dayCompletion(dayKey) {
    const day = state.days[dayKey];
    if (!day) return { done: 0, total: totalChecksForDay(dayKey), ratio: 0 };
    const total = totalChecksForDay(dayKey);
    let done = 0;
    HABITS.forEach((h) => {
      relevantChecks(h, dayKey).forEach((c) => {
        if (day.checks[`${h.id}:${c.key}`]) done++;
      });
    });
    return { done, total, ratio: total ? done / total : 0 };
  }

  function isDayActive(dayKey) {
    const day = state.days[dayKey];
    if (!day) return false;
    const hasCheck = Object.values(day.checks).some(Boolean);
    const hasField = Object.values(day.fields).some((v) => v !== "" && v != null);
    const hasRef =
      day.reflections &&
      Object.values(day.reflections).some((r) => reflectionHasContent(r));
    return hasCheck || hasField || hasRef || !!(day.note && String(day.note).trim()) || day.dailyScore != null;
  }

  function heatLevel(ratio) {
    if (ratio <= 0) return 0;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  }

  /** Streak: consecutive days (ending today or yesterday) with ratio >= 0.3 OR any check */
  function computeStreak(uptoKey = todayKey()) {
    let streak = 0;
    let key = uptoKey;
    const todayComp = dayCompletion(uptoKey);
    // If today has nothing yet, start from yesterday for "current streak" display
    if (todayComp.done === 0 && !isDayActive(uptoKey)) {
      key = addDaysKey(uptoKey, -1);
    }
    for (let i = 0; i < 400; i++) {
      const c = dayCompletion(key);
      if (c.done === 0 && !isDayActive(key)) break;
      if (c.ratio < 0.15 && c.done < 2) break;
      streak++;
      key = addDaysKey(key, -1);
    }
    return streak;
  }

  function missStreakInfo(uptoKey = todayKey()) {
    // How many consecutive missed days ending yesterday (or today if past evening and empty)
    let misses = 0;
    let key = addDaysKey(uptoKey, -1);
    for (let i = 0; i < 14; i++) {
      const c = dayCompletion(key);
      if (c.done > 0 || isDayActive(key)) break;
      // only count days that existed after first ever use
      const oldest = Object.keys(state.days).sort()[0];
      if (oldest && key < oldest) break;
      if (!oldest) break;
      misses++;
      key = addDaysKey(key, -1);
    }
    return misses;
  }

  function cumulativeStats() {
    const keys = Object.keys(state.days).sort();
    let activeDays = 0;
    let totalChecks = 0;
    let sumRatio = 0;
    let bestStreak = 0;
    let cur = 0;
    keys.forEach((k) => {
      const c = dayCompletion(k);
      if (c.done > 0 || isDayActive(k)) {
        activeDays++;
        totalChecks += c.done;
        sumRatio += c.ratio;
        if (c.ratio >= 0.15 || c.done >= 2) {
          cur++;
          bestStreak = Math.max(bestStreak, cur);
        } else cur = 0;
      } else {
        cur = 0;
      }
    });
    const avg = activeDays ? Math.round((sumRatio / activeDays) * 100) : 0;
    return { activeDays, totalChecks, avg, bestStreak, currentStreak: computeStreak() };
  }

  /* ---------- Insights engine (client-side) ---------- */
  function habitDayDone(habit, dayKey) {
    const day = state.days[dayKey];
    if (!day) return false;
    const checks = relevantChecks(habit, dayKey);
    if (!checks.length) return false;
    const done = checks.filter((ch) => day.checks[`${habit.id}:${ch.key}`]).length;
    return done === checks.length;
  }

  function habitDayPartial(habit, dayKey) {
    const day = state.days[dayKey];
    if (!day) return { done: 0, total: 0, ratio: 0 };
    const checks = relevantChecks(habit, dayKey);
    const total = checks.length;
    let done = 0;
    checks.forEach((ch) => {
      if (day.checks[`${habit.id}:${ch.key}`]) done++;
    });
    return { done, total, ratio: total ? done / total : 0 };
  }

  function gatherReflectionWindow(daysBack = 14) {
    const today = todayKey();
    const rows = [];
    for (let i = 0; i < daysBack; i++) {
      const dk = addDaysKey(today, -i);
      const day = state.days[dk];
      if (!day) continue;
      HABITS.forEach((h) => {
        const partial = habitDayPartial(h, dk);
        const ref = day.reflections && day.reflections[String(h.id)];
        rows.push({
          dayKey: dk,
          habit: h,
          partial,
          fullyDone: partial.total > 0 && partial.done === partial.total,
          skipped: partial.total > 0 && partial.done === 0 && (isDayActive(dk) || !!day.updatedAt),
          ref: ref || null,
        });
      });
    }
    return rows;
  }

  function blockerTip(tagId, habit) {
    if (tagId === "distract") {
      if (habit.id === 2) {
        return "הסחות חוזרות בבוקר? הגני את הטלפון בחדר אחר ב־60 הדקות הראשונות — Input Fasting בלי משא ומתן.";
      }
      return `הסחות חוזרות ב«${habit.title}»? עצבי מראש את הסביבה (הרגל 5) כדי שהפעולה הנכונה תהיה הקלה ביותר.`;
    }
    if (tagId === "time") {
      return "חוזרת תחושת «אין זמן»? הקטיני את המינימום — כמה דקות עדיפות על אפס. מומנטום נבנה מניצחונות קטנים (הרגל 7).";
    }
    if (tagId === "energy") {
      return "אנרגיה נמוכה חוזרת? בדקי שינה ותכנון לילה (הרגל 1) — התשתית הביולוגית מזינה את כל השאר.";
    }
    if (tagId === "forgot") {
      return "שוכחת שוב ושוב? קשרי את ההרגל לטריגר קיים (אחרי קפה / אחרי צחצוח) או תזכורת אחת עדינה.";
    }
    if (tagId === "easy") {
      return "«בחרתי בקל» חוזר? זה בדיוק הרגל 8 — בחירה בקושי. התחילי בקושי קטן אחד ביום, בכתב.";
    }
    return null;
  }

  function encouragementCopy(todayComp, misses) {
    const yesterday = addDaysKey(todayKey(), -1);
    const yComp = dayCompletion(yesterday);
    const recovered = (yComp.done === 0 && !isDayActive(yesterday)) && (todayComp.done > 0 || isDayActive(todayKey()));
    if (recovered) {
      return {
        kind: "recovered",
        title: "חזרת — זה המומנטום",
        body: "אתמול היה ריק והיום יש סימון. מותר יום אחד; אסור שני ימים ברצף. עשוי עדיף ממושלם.",
      };
    }
    if (misses >= 2) {
      return {
        kind: "two_miss",
        title: "שני ימים — נגיעה עדינה",
        body: "שני ימים ברצף שוברים מומנטום. מספיק מינימום קטן אחד היום (הרגל 7) כדי לחזור — בלי בושה.",
      };
    }
    if (misses === 1) {
      return {
        kind: "one_miss",
        title: "יום אחד — בסדר גמור",
        body: "החמצה אחת לא מוחקת התקדמות. היום בוחרים פעולה קטנה וחוזרים לרצף.",
      };
    }
    if (todayComp.ratio >= 0.7 && todayComp.done > 0) {
      return {
        kind: "strong",
        title: "יום חזק",
        body: `את על ${Math.round(todayComp.ratio * 100)}% היום. חגגי ניצחון קטן (הרגל 7) ושמרי על בחירה בקושי אחת (הרגל 8).`,
      };
    }
    if (todayComp.done > 0) {
      return {
        kind: "building",
        title: "בתנועה",
        body: "יש סימונים היום — ממשיכים בצעדים קטנים. המומנטום נשמר במפה גם אחרי מעידה.",
      };
    }
    return {
      kind: "fresh",
      title: "יום חדש",
      body: "בחרי הרגל אחד להתחיל בו. מינימום קטן עדיף על תוכנית מושלמת שלא קורה.",
    };
  }

  function computeInsights(opts = {}) {
    const windowDays = opts.windowDays || 14;
    const maxCards = opts.maxCards || 4;
    const rows = gatherReflectionWindow(windowDays);
    const cards = [];
    const todayComp = dayCompletion(todayKey());
    const misses = missStreakInfo(todayKey());
    const encour = encouragementCopy(todayComp, misses);
    cards.push({
      id: "encouragement",
      tone: encour.kind === "strong" || encour.kind === "recovered" ? "celebrate" : encour.kind === "two_miss" ? "warn" : "soft",
      title: encour.title,
      body: encour.body,
      habitIds: [7, 8],
    });

    // Repeated blockers per habit (tag counts)
    const tagCounts = {}; // habitId -> tagId -> count
    rows.forEach((row) => {
      if (!row.ref || !row.ref.tags) return;
      row.ref.tags.forEach((tid) => {
        const hid = row.habit.id;
        if (!tagCounts[hid]) tagCounts[hid] = {};
        tagCounts[hid][tid] = (tagCounts[hid][tid] || 0) + 1;
      });
    });
    const blockerHits = [];
    Object.entries(tagCounts).forEach(([hid, tags]) => {
      Object.entries(tags).forEach(([tid, count]) => {
        if (count >= 3) blockerHits.push({ habitId: Number(hid), tagId: tid, count });
      });
    });
    blockerHits.sort((a, b) => b.count - a.count);
    blockerHits.slice(0, 2).forEach((hit) => {
      const habit = HABITS.find((h) => h.id === hit.habitId);
      if (!habit) return;
      const tip = blockerTip(hit.tagId, habit);
      const tagLabel = (BLOCKER_TAGS.find((t) => t.id === hit.tagId) || {}).label || hit.tagId;
      if (!tip) return;
      cards.push({
        id: `blocker-${hit.habitId}-${hit.tagId}`,
        tone: "coach",
        title: `דפוס: ${tagLabel} ב«${habit.title}»`,
        body: `${tip} (${hit.count}× ב־${windowDays} הימים האחרונים)`,
        habitIds: [habit.id, habit.id === 2 ? 5 : 7],
      });
    });

    // Often skipped habits (among active days in window)
    const activeDayKeys = new Set();
    for (let i = 0; i < windowDays; i++) {
      const dk = addDaysKey(todayKey(), -i);
      if (isDayActive(dk) || dayCompletion(dk).done > 0) activeDayKeys.add(dk);
    }
    const activeN = activeDayKeys.size;
    if (activeN >= 4) {
      const skipStats = HABITS.map((h) => {
        let considered = 0;
        let full = 0;
        let any = 0;
        activeDayKeys.forEach((dk) => {
          const p = habitDayPartial(h, dk);
          if (p.total === 0) return;
          considered++;
          if (p.done === p.total) full++;
          if (p.done > 0) any++;
        });
        const skipRate = considered ? 1 - any / considered : 0;
        const fullRate = considered ? full / considered : 0;
        return { habit: h, considered, full, any, skipRate, fullRate };
      });
      const skipped = skipStats
        .filter((s) => s.considered >= 4 && s.skipRate >= 0.5)
        .sort((a, b) => b.skipRate - a.skipRate);
      skipped.slice(0, 1).forEach((s) => {
        cards.push({
          id: `skip-${s.habit.id}`,
          tone: "soft",
          title: `«${s.habit.title}» מחכה למינימום קטן`,
          body: `${MIN_ACTIONS[s.habit.id] || "הקטיני את הרף."} עשוי עדיף ממושלם — הרגל 7.`,
          habitIds: [s.habit.id, 7],
        });
      });
      const wins = skipStats
        .filter((s) => s.considered >= 5 && s.fullRate >= 0.7)
        .sort((a, b) => b.fullRate - a.fullRate);
      wins.slice(0, 1).forEach((s) => {
        cards.push({
          id: `win-${s.habit.id}`,
          tone: "celebrate",
          title: `עקביות ב«${s.habit.title}»`,
          body: `השלמת מלאה ב־${Math.round(s.fullRate * 100)}% מהימים הפעילים. זה מומנטום אמיתי — תמשיכי לחגוג ניצחונות קטנים.`,
          habitIds: [s.habit.id, 7],
        });
      });
    }

    // Free-text blockers mentioning patterns (light)
    const textBlockers = [];
    rows.forEach((row) => {
      const b = row.ref && String(row.ref.blocker || "").trim();
      if (b) textBlockers.push({ habit: row.habit, text: b, dayKey: row.dayKey });
    });
    if (textBlockers.length >= 3 && cards.length < maxCards) {
      const recent = textBlockers.slice(0, 3).map((x) => x.habit.title);
      const unique = [...new Set(recent)];
      cards.push({
        id: "notes-pattern",
        tone: "coach",
        title: "יש לך תשובות — בואי נלמד מהן",
        body: `כתבת «מה עצר אותי» על ${textBlockers.length} הרגלים לאחרונה (${unique.slice(0, 2).join(", ")}…). בסקירה השבועית אפשר לזקק לקח אחד ולתרגם לבחירה בקושי (הרגל 8).`,
        habitIds: [8, 7],
      });
    }

    // Dedupe by id, limit
    const seen = new Set();
    const out = [];
    for (const c of cards) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      if (out.length >= maxCards) break;
    }
    return out;
  }

  function renderInsightCardsHtml(insights, opts = {}) {
    if (!insights || !insights.length) return "";
    const heading = opts.heading || "תובנות מהימים האחרונים";
    const sub = opts.sub || "בלי בושה — דפוסים + צעד קטן אחד קדימה";
    const cards = insights
      .map((c) => {
        const tone = c.tone || "soft";
        return `<article class="insight-card tone-${escapeHtml(tone)}">
          <h3>${escapeHtml(c.title)}</h3>
          <p>${escapeHtml(c.body)}</p>
        </article>`;
      })
      .join("");
    return `<section class="card insights-block">
      <h2>${escapeHtml(heading)}</h2>
      <p class="muted" style="margin-bottom:10px">${escapeHtml(sub)}</p>
      <div class="insights-grid">${cards}</div>
    </section>`;
  }

  function weeklyAutoSuggestions(weekDays) {
    const tagCount = {};
    const wins = [];
    const howNotes = [];
    weekDays.forEach((dk) => {
      if (dk > todayKey()) return;
      const day = state.days[dk];
      if (!day) return;
      HABITS.forEach((h) => {
        const p = habitDayPartial(h, dk);
        const ref = day.reflections && day.reflections[String(h.id)];
        if (p.total && p.done === p.total) {
          const how = ref && String(ref.how || "").trim();
          wins.push(how ? `${h.title}: ${how}` : h.title);
        }
        if (ref) {
          (ref.tags || []).forEach((tid) => {
            tagCount[tid] = (tagCount[tid] || 0) + 1;
          });
          const b = String(ref.blocker || "").trim();
          if (b) howNotes.push(`${h.title}: ${b}`);
        }
      });
    });
    const topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tid, n]) => {
        const label = (BLOCKER_TAGS.find((t) => t.id === tid) || {}).label || tid;
        return `${label} (${n}×)`;
      });
    const winSample = [...new Set(wins)].slice(0, 5);
    const lessonBits = [];
    if (topTags.length) lessonBits.push("חוסמים חוזרים: " + topTags.join(", "));
    howNotes.slice(0, 4).forEach((n) => lessonBits.push(n));
    return {
      winsSuggest: winSample.length ? winSample.map((w) => "• " + w).join("\n") : "",
      lessonsSuggest: lessonBits.length ? lessonBits.map((w) => "• " + w).join("\n") : "",
    };
  }

  /* ---------- UI helpers ---------- */
  const main = document.getElementById("main");
  const toastEl = document.getElementById("toast");
  let currentScreen = "today";
  let toastTimer = null;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2400);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateHeader() {
    const key = todayKey();
    document.getElementById("today-label").textContent = formatHebrewDate(key);
    const streak = computeStreak();
    const badge = document.getElementById("streak-badge");
    badge.textContent = streak > 0 ? `🔥 ${streak} ימים` : "התחלי היום";
  }

  function setCheck(habitId, checkKey, val) {
    const day = getDay(todayKey());
    day.checks[`${habitId}:${checkKey}`] = !!val;
    day.updatedAt = new Date().toISOString();
    saveState();
    maybeCelebrate();
  }

  function setField(habitId, fieldKey, val) {
    const day = getDay(todayKey());
    day.fields[`${habitId}:${fieldKey}`] = val;
    day.updatedAt = new Date().toISOString();
    saveState();
  }

  function maybeCelebrate() {
    const key = todayKey();
    const c = dayCompletion(key);
    if (c.ratio >= 1) toast("כל ההרגלים להיום ✓ מומנטום מלא!");
    else if (c.done > 0 && c.done % 5 === 0) toast(`יפה! ${c.done} סימונים היום`);
  }

  /* ---------- Screens ---------- */
  function renderToday() {
    const key = todayKey();
    const day = getDay(key);
    const c = dayCompletion(key);
    const misses = missStreakInfo(key);
    const pct = Math.round(c.ratio * 100);

    let nudge = "";
    if (misses >= 2) {
      nudge = `<div class="nudge"><strong>נגיעה עדינה:</strong> היו ${misses} ימים ברצף בלי סימון. מותר יום אחד — שני ימים ברצף שוברים מומנטום. מספיק סימון אחד קטן היום כדי לחזור.</div>`;
    } else if (misses === 1) {
      nudge = `<div class="nudge"><strong>יום אחד החמצה — בסדר.</strong> היום חוזרים. עשוי עדיף ממושלם.</div>`;
    } else if (c.ratio >= 0.7 && c.done > 0) {
      nudge = `<div class="nudge celebrate"><strong>מומנטום!</strong> את על ${pct}% היום. תמשיכי — גם אחרי מעידה ההתקדמות נשמרת במפה.</div>`;
    }

    const ring = `
      <div class="progress-ring-wrap">
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r="30" fill="none" stroke="#f3ebe3" stroke-width="8"/>
          <circle cx="36" cy="36" r="30" fill="none" stroke="#c45c26" stroke-width="8"
            stroke-linecap="round"
            stroke-dasharray="${2 * Math.PI * 30}"
            stroke-dashoffset="${2 * Math.PI * 30 * (1 - c.ratio)}"
            transform="rotate(-90 36 36)"/>
          <text x="36" y="40" text-anchor="middle" font-size="14" font-weight="700" fill="#9a3f14">${pct}%</text>
        </svg>
        <div class="ring-meta">
          <strong>${c.done} / ${c.total}</strong>
          <span>סימונים היום · אזור זמן ירושלים</span>
          <div class="done-bar"><i style="width:${pct}%"></i></div>
        </div>
      </div>`;

    let habitsHtml = HABITS.map((h) => {
      const checks = relevantChecks(h, key);
      const fields = relevantFields(h, key);
      const doneH = checks.filter((ch) => day.checks[`${h.id}:${ch.key}`]).length;
      const chip =
        doneH === checks.length && checks.length
          ? `<span class="chip ok">הושלם</span>`
          : doneH > 0
          ? `<span class="chip warn">${doneH}/${checks.length}</span>`
          : `<span class="chip">${checks.length} פריטים</span>`;

      const sunday = isSunday(key);
      const checksHtml = checks
        .map((ch) => {
          let label = ch.label;
          let hint = ch.hint;
          if (h.id === 6 && ch.key === "constraint") {
            if (sunday) {
              label = "עשיתי סקירה שבועית";
              hint = "שיחה קבועה עם עצמך (או מישהי) על המספרים — לא מדלגים";
            } else {
              label = "סקירה שבועית (רלוונטי ליום ראשון)";
              hint = "בימי חול מספיק המספר והתחושה — ביום ראשון עושים את השיחה השבועית";
            }
          }
          const id = `c-${h.id}-${ch.key}`;
          const checked = day.checks[`${h.id}:${ch.key}`] ? "checked" : "";
          return `<div class="check-row">
            <input type="checkbox" id="${id}" data-habit="${h.id}" data-check="${ch.key}" ${checked}/>
            <label for="${id}">${escapeHtml(label)}<span class="hint">${escapeHtml(hint)}</span></label>
          </div>`;
        })
        .join("");

      const fieldsHtml = fields
        .map((f) => {
          const val = day.fields[`${h.id}:${f.key}`] ?? "";
          const common = `data-habit="${h.id}" data-field="${f.key}"`;
          let label = f.label;
          let placeholder = f.placeholder || "";
          if (h.id === 6 && f.key === "northstarValue") {
            const ns = state.settings.northstarName || "המדד שבחרת בהגדרות";
            label = `המספר של היום לפי «${ns}»`;
            placeholder = "למשל: 4 · לפי המדד שבחרת בהגדרות";
          }
          if (h.id === 6 && f.key === "scoreNote") {
            label = "מה המספר אומר לי היום";
            placeholder = "איך את מרגישה לגביו? מה הוא מספר לך…";
          }
          if (f.type === "textarea") {
            return `<div class="field"><label>${escapeHtml(label)}</label>
              <textarea ${common} placeholder="${escapeHtml(placeholder)}">${escapeHtml(val)}</textarea></div>`;
          }
          return `<div class="field"><label>${escapeHtml(label)}</label>
            <input type="${f.type === "number" ? "number" : "text"}" ${common}
              value="${escapeHtml(val)}" placeholder="${escapeHtml(placeholder)}"/></div>`;
        })
        .join("");

      // Habit 6: explainer + northstar name from settings
      let extra = "";
      if (h.id === 6) {
        const nsName = state.settings.northstarName || "עדיין לא נבחר — לך להגדרות";
        const nsTarget = state.settings.northstarTarget
          ? ` · יעד: ${escapeHtml(state.settings.northstarTarget)}`
          : "";
        const dayNote = sunday
          ? `<p class="metrics-day-note"><button type="button" class="linkish" data-go-weekly>פתחי את הסקירה השבועית ←</button></p>`
          : `<p class="metrics-day-note muted">הסקירה השבועית רלוונטית בעיקר ליום ראשון. היום מספיק לרשום את המספר ואיך את מרגישה.</p>`;
        extra = `
          <details class="explainer">
            <summary>מה זה אומר?</summary>
            <ul>
              <li><strong>מדד כוכב הצפון</strong> (Northstar) — מספר אחד שבוחרים שמסמן אם השבוע או החודש זז לכיוון הנכון. לא עשרות מדדים. את קובעת את השם ב«הגדרות».</li>
              <li><strong>כרטיס יומי</strong> (Scorecard) — מבט קצר על המספר + איך את מרגישה לגביו. לא טבלת אקסל.</li>
              <li><strong>סקירה שבועית</strong> (פונקציית אילוץ) — שיחה קבועה עם עצמך (או מישהי) על המספרים. מחויבות שלא מדלגים.</li>
            </ul>
            <p class="explainer-example"><strong>דוגמה ליום:</strong> «היום כוכב הצפון שלי = 4 (ימי הרגלים שהשלמתי). המספר אומר לי שאני בכיוון, גם אם הייתי עייפה. ביום ראשון אשב 10 דקות עם המספרים.»</p>
          </details>
          <p class="muted ns-line">המדד שלך: <strong>${escapeHtml(nsName)}</strong>${nsTarget}</p>
          ${dayNote}`;
      }
      if (h.id === 8 && state.settings.challenge) {
        extra = `<p class="muted" style="margin-bottom:8px">האתגר השמור: <strong>${escapeHtml(state.settings.challenge)}</strong></p>`;
      }
      if (h.id === 1 && state.settings.sleepAlarm) {
        extra = `<p class="muted" style="margin-bottom:8px">תזכורת שינה מוגדרת: <strong>${escapeHtml(state.settings.sleepAlarm)}</strong></p>`;
      }

      return `<section class="card" data-habit-card="${h.id}">
        <div class="card-header-row">
          <h2><span class="habit-num">${h.id}</span> ${escapeHtml(h.title)}</h2>
          ${chip}
        </div>
        <p class="muted">${escapeHtml(h.short)} · ${escapeHtml(h.layer)}</p>
        ${extra}
        ${checksHtml}
        ${fieldsHtml}
      </section>`;
    }).join("");

    // End-of-day reflection per habit
    const reflectionRows = HABITS.map((h) => {
      const r = getReflection(day, h.id);
      const checks = relevantChecks(h, key);
      const doneH = checks.filter((ch) => day.checks[`${h.id}:${ch.key}`]).length;
      const incomplete = checks.length > 0 && doneH < checks.length;
      const tagsHtml = BLOCKER_TAGS.map((t) => {
        const on = (r.tags || []).includes(t.id) ? "on" : "";
        return `<button type="button" class="blocker-tag ${on}" data-ref-habit="${h.id}" data-tag="${t.id}">${escapeHtml(t.label)}</button>`;
      }).join("");
      return `<div class="reflect-habit" data-reflect="${h.id}">
        <div class="reflect-habit-head">
          <strong><span class="habit-num">${h.id}</span> ${escapeHtml(h.title)}</strong>
          ${incomplete ? '<span class="chip warn">לא הושלם</span>' : doneH === checks.length && checks.length ? '<span class="chip ok">הושלם</span>' : ""}
        </div>
        <div class="field">
          <label>איך היה</label>
          <textarea data-ref-habit="${h.id}" data-ref-field="how" rows="2" placeholder="בקצרה — מה עבד / איך הרגשת…">${escapeHtml(r.how || "")}</textarea>
        </div>
        <div class="field ${incomplete ? "" : "optional-blocker"}">
          <label>מה עצר אותי ${incomplete ? "" : '<span class="muted">(אופציונלי)</span>'}</label>
          <div class="blocker-tags" role="group" aria-label="תגיות חוסמים">${tagsHtml}</div>
          <textarea data-ref-habit="${h.id}" data-ref-field="blocker" rows="2" placeholder="זמן? אנרגיה? הסחות?…">${escapeHtml(r.blocker || "")}</textarea>
        </div>
      </div>`;
    }).join("");

    const lightInsights = computeInsights({ windowDays: 14, maxCards: 2 });
    const lightInsightsHtml =
      lightInsights.length > 1
        ? renderInsightCardsHtml(lightInsights.slice(0, 2), {
            heading: "תובנה קצרה להיום",
            sub: "מבוסס על הסימונים והסיכומים שלך",
          })
        : lightInsights.length === 1
        ? renderInsightCardsHtml(lightInsights, {
            heading: "תובנה קצרה להיום",
            sub: "מבוסס על הסימונים והסיכומים שלך",
          })
        : "";

    // Daily score
    const score = day.dailyScore;
    const scoreCard = `
      <section class="card">
        <h2>ציון יום אישי</h2>
        <p class="muted">איך הרגשת את היום? (1–10) — נשמר גם אחרי ימים חסרים</p>
        <div class="score-slider-wrap">
          <input type="range" id="daily-score" min="1" max="10" value="${score ?? 5}" />
          <div>ציון: <span class="score-val" id="score-val">${score ?? "—"}</span></div>
        </div>
        <div class="field">
          <label>הערת יום</label>
          <textarea id="day-note" placeholder="מה לקחת מהיום…">${escapeHtml(day.note || "")}</textarea>
        </div>
      </section>`;

    const eodCard = `
      <section class="card eod-card" id="eod-reflection">
        <h2>סיכום יום</h2>
        <p class="muted">לכל הרגל — כמה מילים בסוף היום. נשמר בהיסטוריה ועוזר לזהות דפוסים.</p>
        ${reflectionRows}
      </section>`;

    main.innerHTML = nudge + installCardHtml("today") + ring + lightInsightsHtml + habitsHtml + eodCard + scoreCard;
    bindInstallButtons();
    bindTodayEvents();
  }

  function bindTodayEvents() {
    main.querySelectorAll("[data-go-weekly]").forEach((el) => {
      el.addEventListener("click", () => switchScreen("weekly"));
    });
    main.querySelectorAll('input[type="checkbox"][data-check]').forEach((el) => {
      el.addEventListener("change", () => {
        // flush in-progress reflection text before re-render
        main.querySelectorAll("textarea[data-ref-field]").forEach((ta) => {
          setReflection(Number(ta.dataset.refHabit), { [ta.dataset.refField]: ta.value });
        });
        setCheck(Number(el.dataset.habit), el.dataset.check, el.checked);
        renderToday();
        updateHeader();
      });
    });
    main.querySelectorAll("[data-field]").forEach((el) => {
      const handler = () => setField(Number(el.dataset.habit), el.dataset.field, el.value);
      el.addEventListener("change", handler);
      el.addEventListener("blur", handler);
    });
    const score = document.getElementById("daily-score");
    const scoreVal = document.getElementById("score-val");
    if (score) {
      const day = getDay(todayKey());
      if (day.dailyScore != null) scoreVal.textContent = day.dailyScore;
      score.addEventListener("input", () => {
        scoreVal.textContent = score.value;
      });
      score.addEventListener("change", () => {
        const d = getDay(todayKey());
        d.dailyScore = Number(score.value);
        d.updatedAt = new Date().toISOString();
        saveState();
        toast("ציון היום נשמר");
      });
    }
    const note = document.getElementById("day-note");
    if (note) {
      note.addEventListener("change", () => {
        const d = getDay(todayKey());
        d.note = note.value;
        saveState();
      });
    }

    main.querySelectorAll("textarea[data-ref-field]").forEach((el) => {
      const save = () => {
        const hid = Number(el.dataset.refHabit);
        const field = el.dataset.refField;
        setReflection(hid, { [field]: el.value });
      };
      el.addEventListener("change", save);
      el.addEventListener("blur", save);
    });

    main.querySelectorAll("button.blocker-tag").forEach((btn) => {
      btn.addEventListener("click", () => {
        const hid = Number(btn.dataset.refHabit);
        const tag = btn.dataset.tag;
        const day = getDay(todayKey());
        const r = getReflection(day, hid);
        const set = new Set(r.tags || []);
        if (set.has(tag)) set.delete(tag);
        else set.add(tag);
        setReflection(hid, { tags: [...set] });
        btn.classList.toggle("on");
      });
    });
  }

  function renderProgress() {
    const stats = cumulativeStats();
    const today = todayKey();
    // Build 12 weeks heatmap ending this week
    const weeks = 12;
    const end = today;
    const start = addDaysKey(weekStartKey(end), -7 * (weeks - 1));
    const cells = [];
    // pad to Sunday
    const pad = weekdayIndexSun0(start);
    for (let i = 0; i < pad; i++) cells.push({ empty: true });

    let k = start;
    const last = end;
    while (k <= last) {
      const c = dayCompletion(k);
      const active = isDayActive(k) || c.done > 0;
      const level = active ? heatLevel(c.ratio) : Object.keys(state.days).includes(k) ? 0 : 0;
      cells.push({
        key: k,
        level: active ? level : 0,
        ratio: c.ratio,
        done: c.done,
        total: c.total,
        isToday: k === today,
      });
      k = addDaysKey(k, 1);
    }

    const heatHtml = cells
      .map((cell) => {
        if (cell.empty) return `<div class="hm-cell empty"></div>`;
        const cls = `hm-cell ${cell.level ? "l" + cell.level : ""} ${cell.isToday ? "today" : ""}`;
        const title = `${formatHebrewDate(cell.key)} — ${cell.done}/${cell.total}`;
        return `<div class="${cls}" title="${escapeHtml(title)}" data-day="${cell.key}"></div>`;
      })
      .join("");

    // Per-habit completion over last 30 days
    const habitBars = HABITS.map((h) => {
      let possible = 0;
      let done = 0;
      for (let i = 0; i < 30; i++) {
        const dk = addDaysKey(today, -i);
        const checks = relevantChecks(h, dk);
        const day = state.days[dk];
        possible += checks.length;
        if (day) {
          checks.forEach((ch) => {
            if (day.checks[`${h.id}:${ch.key}`]) done++;
          });
        }
      }
      const pct = possible ? Math.round((done / possible) * 100) : 0;
      return `<div style="margin:8px 0">
        <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:3px">
          <span>${h.id}. ${escapeHtml(h.title)}</span><strong>${pct}%</strong>
        </div>
        <div class="done-bar"><i style="width:${pct}%"></i></div>
      </div>`;
    }).join("");

    // Northstar sparkline-ish list last 14 days
    let nsRows = "";
    for (let i = 13; i >= 0; i--) {
      const dk = addDaysKey(today, -i);
      const day = state.days[dk];
      const v = day?.fields?.["6:northstarValue"];
      if (v !== undefined && v !== "" && v != null) {
        nsRows += `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bg-soft);font-size:0.85rem">
          <span>${escapeHtml(formatHebrewDate(dk))}</span><strong>${escapeHtml(v)}</strong></div>`;
      }
    }

    main.innerHTML = `
      <h2 class="section-title">התקדמות מצטברת</h2>
      <p class="muted" style="margin-bottom:12px">המפה והסטטיסטיקות נשמרות גם אחרי ימים חסרים — המומנטום לא נמחק.</p>
      <div class="stats-grid">
        <div class="stat-box"><div class="val">${stats.currentStreak}</div><div class="lbl">רצף נוכחי</div></div>
        <div class="stat-box"><div class="val">${stats.bestStreak}</div><div class="lbl">רצף שיא</div></div>
        <div class="stat-box"><div class="val">${stats.activeDays}</div><div class="lbl">ימים פעילים</div></div>
        <div class="stat-box"><div class="val">${stats.totalChecks}</div><div class="lbl">סימונים סה״כ</div></div>
        <div class="stat-box"><div class="val">${stats.avg}%</div><div class="lbl">ממוצע השלמה</div></div>
        <div class="stat-box"><div class="val">${Object.keys(state.days).length}</div><div class="lbl">ימים במעקב</div></div>
      </div>

      <section class="card" style="margin-top:12px">
        <h2>מפת חום — 12 שבועות</h2>
        <div class="weekdays">
          <span>א</span><span>ב</span><span>ג</span><span>ד</span><span>ה</span><span>ו</span><span>ש</span>
        </div>
        <div class="heatmap">${heatHtml}</div>
        <div class="hm-legend">
          פחות
          <span class="sw" style="background:#f3ebe3"></span>
          <span class="sw" style="background:#f0d5c4"></span>
          <span class="sw" style="background:#e8a87c"></span>
          <span class="sw" style="background:#d4783a"></span>
          <span class="sw" style="background:#c45c26"></span>
          יותר
        </div>
      </section>

      <section class="card">
        <h2>השלמה לפי הרגל (30 יום)</h2>
        ${habitBars}
      </section>

      <section class="card">
        <h2>כוכב הצפון — 14 יום</h2>
        <p class="muted">${escapeHtml(state.settings.northstarName || "מדד כוכב הצפון")}</p>
        ${nsRows || '<div class="empty-state">עדיין אין ערכים — מלאי בהרגל 6 במסך היום</div>'}
      </section>

      ${renderInsightCardsHtml(computeInsights({ windowDays: 14, maxCards: 4 }), {
        heading: "תובנות ודפוסים",
        sub: "מסיכומי היום והסימונים · בלי בושה · צעד קטן אחד",
      })}
    `;

    main.querySelectorAll(".hm-cell[data-day]").forEach((el) => {
      el.addEventListener("click", () => {
        const dk = el.dataset.day;
        const c = dayCompletion(dk);
        toast(`${formatHebrewDate(dk)}: ${c.done}/${c.total}`);
      });
    });
  }

  function renderHabits() {
    const list = HABITS.map(
      (h) => `
      <div class="habit-list-item" data-open-habit="${h.id}">
        <span class="habit-num">${h.id}</span>
        <div class="body">
          <h3>${escapeHtml(h.title)}</h3>
          <p class="muted">${escapeHtml(h.short)} · ${escapeHtml(h.layer)}</p>
        </div>
      </div>`
    ).join("");

    main.innerHTML = `
      <h2 class="section-title">8 ההרגלים</h2>
      <section class="card" style="padding-top:4px;padding-bottom:4px">${list}</section>

      <section class="card ref-section">
        <h2>פירמידת 4 השכבות</h2>
        <p class="muted">שדרוג מערכת ההפעלה האישית</p>
        <div class="pyramid">
          <div class="pyramid-layer">מכפילי כוח — מומנטום, בחירה בקושי</div>
          <div class="pyramid-layer">ארכיטקטורה חיצונית — סביבה ומדדים</div>
          <div class="pyramid-layer">מנוע קוגניטיבי — ארגון והזנת המוח</div>
          <div class="pyramid-layer">תשתית ביולוגית — זמן ואנרגיה</div>
        </div>
      </section>

      <section class="card">
        <h2>Eustress מול Distress</h2>
        <div class="compare">
          <div class="col good">
            <h4>סטרס חיובי (Eustress)</h4>
            <p>יזום ומתוכנן · בחירה בקושי · בונה זהות ומחשל אופי</p>
          </div>
          <div class="col bad">
            <h4>סטרס שלילי (Distress)</h4>
            <p>כפוי מהעולם · הימנעות · יוצר קורבנות וחוסר אונים</p>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>ארכיטקטורת 1%</h2>
        <p class="muted">ריבית דריבית של שיפור יומי קטן</p>
        <div class="arch-steps">
          <div class="arch-step"><span class="n">1</span><span><strong>התנעה</strong> — לילה + 60 דקות ראשונות</span></div>
          <div class="arch-step"><span class="n">2</span><span><strong>מיקוד</strong> — משפך 1-2-3 + JIT learning</span></div>
          <div class="arch-step"><span class="n">3</span><span><strong>האצה</strong> — סביבה בלי חיכוך + מדדים</span></div>
          <div class="arch-step"><span class="n">4</span><span><strong>פריצה</strong> — מומנטום + בחירה בקושי</span></div>
        </div>
      </section>
    `;

    main.querySelectorAll("[data-open-habit]").forEach((el) => {
      el.addEventListener("click", () => showHabitDetail(Number(el.dataset.openHabit)));
    });
  }

  function showHabitDetail(id) {
    const h = HABITS.find((x) => x.id === id);
    if (!h) return;
    const checks = h.checks
      .map((c) => `<li><strong>${escapeHtml(c.label)}</strong> — ${escapeHtml(c.hint)}</li>`)
      .join("");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <button type="button" class="close-x" aria-label="סגור">×</button>
        <h2><span class="habit-num">${h.id}</span> ${escapeHtml(h.title)}</h2>
        <p class="muted">${escapeHtml(h.short)}</p>
        <p style="margin:8px 0;font-size:0.85rem">שכבה: ${escapeHtml(h.layer)}</p>
        ${h.id === 6 ? `<div class="explainer open-plain"><ul>
          <li><strong>מדד כוכב הצפון</strong> — מספר אחד שמסמן אם את בכיוון הנכון (נקבע בהגדרות).</li>
          <li><strong>כרטיס יומי</strong> — המספר + איך את מרגישה לגביו.</li>
          <li><strong>סקירה שבועית</strong> — שיחה קבועה על המספרים, בעיקר ביום ראשון.</li>
        </ul></div>` : ""}
        <h3>מה לעשות</h3>
        <ul style="padding-inline-start:18px;font-size:0.9rem;line-height:1.6">${checks}</ul>
        <div class="btn-row"><button type="button" class="btn block" id="go-today">לסמן במסך היום</button></div>
      </div>`;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.querySelector(".close-x").onclick = close;
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
    backdrop.querySelector("#go-today").onclick = () => {
      close();
      switchScreen("today");
      setTimeout(() => {
        const card = main.querySelector(`[data-habit-card="${id}"]`);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    };
  }

  function renderWeekly() {
    const today = todayKey();
    const ws = weekStartKey(today);
    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDaysKey(ws, i));
    const review = state.weekly[ws] || { notes: "", wins: "", lessons: "", nextFocus: "", completed: false };
    const auto = weeklyAutoSuggestions(days);
    const winsValue = review.wins || auto.winsSuggest || "";
    const lessonsValue = review.lessons || auto.lessonsSuggest || "";
    const autoHint =
      (!review.wins && auto.winsSuggest) || (!review.lessons && auto.lessonsSuggest)
        ? `<p class="muted auto-suggest-hint">מילאתי הצעות מסיכומי השבוע — אפשר לערוך לפני השמירה.</p>`
        : "";

    const dayRows = days
      .map((dk) => {
        const c = dayCompletion(dk);
        const future = dk > today;
        const chip = future
          ? `<span class="chip">עתיד</span>`
          : c.done === 0
          ? `<span class="chip miss">ריק</span>`
          : c.ratio >= 0.7
          ? `<span class="chip ok">${c.done}/${c.total}</span>`
          : `<span class="chip warn">${c.done}/${c.total}</span>`;
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bg-soft);font-size:0.9rem">
          <span>${escapeHtml(formatHebrewDate(dk))}${dk === today ? " · היום" : ""}</span>${chip}
        </div>`;
      })
      .join("");

    const weekDone = days.reduce((s, dk) => s + dayCompletion(dk).done, 0);
    const weekTotal = days.reduce((s, dk) => s + (dk <= today ? dayCompletion(dk).total : 0), 0);
    const weekPct = weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0;

    main.innerHTML = `
      <h2 class="section-title">סקירה שבועית</h2>
      <p class="muted" style="margin-bottom:10px">שבוע שמתחיל ביום ראשון · ${escapeHtml(formatHebrewDate(ws))}</p>

      <section class="card">
        <div class="card-header-row">
          <h2>סיכום השבוע</h2>
          <span class="chip ${weekPct >= 60 ? "ok" : "warn"}">${weekPct}%</span>
        </div>
        <div class="done-bar"><i style="width:${weekPct}%"></i></div>
        <p class="muted" style="margin-top:8px">${weekDone} סימונים מתוך ${weekTotal} עד היום</p>
        ${dayRows}
      </section>

      <section class="card">
        <h2>סקירה שבועית</h2>
        <p class="muted">שיחה קבועה עם עצמך (או מישהי) על המספרים — מחויבות שלא מדלגים. זה מה שקוראים לפעמים «פונקציית אילוץ».</p>
        ${autoHint}
        <div class="field"><label>ניצחונות השבוע</label>
          <textarea id="w-wins" placeholder="מה עבד…">${escapeHtml(winsValue)}</textarea></div>
        <div class="field"><label>לקחים</label>
          <textarea id="w-lessons" placeholder="מה ללמוד…">${escapeHtml(lessonsValue)}</textarea></div>
        <div class="field"><label>מיקוד לשבוע הבא</label>
          <textarea id="w-next" placeholder="עדיפות אחת ברורה…">${escapeHtml(review.nextFocus || "")}</textarea></div>
        <div class="field"><label>הערות נוספות</label>
          <textarea id="w-notes" placeholder="…">${escapeHtml(review.notes || "")}</textarea></div>
        <div class="check-row">
          <input type="checkbox" id="w-done" ${review.completed ? "checked" : ""}/>
          <label for="w-done">השלמתי סקירה שבועית<span class="hint">סימון שסגרת את השבוע במודע</span></label>
        </div>
        <div class="btn-row"><button type="button" class="btn block" id="save-weekly">שמירת סקירה</button></div>
      </section>
    `;

    document.getElementById("save-weekly").onclick = () => {
      state.weekly[ws] = {
        wins: document.getElementById("w-wins").value,
        lessons: document.getElementById("w-lessons").value,
        nextFocus: document.getElementById("w-next").value,
        notes: document.getElementById("w-notes").value,
        completed: document.getElementById("w-done").checked,
        updatedAt: new Date().toISOString(),
      };
      saveState();
      toast("הסקירה השבועית נשמרה");
    };
  }

  function renderSettings() {
    const s = state.settings;
    main.innerHTML = `
      <h2 class="section-title">הגדרות</h2>

      <section class="card">
        <h2>מדד כוכב הצפון</h2>
        <p class="help-blurb">בחרי <strong>מספר אחד</strong> שחשוב לך — לא רשימה של עשרות. כל יום תרשמי רק אותו, כדי לראות אם השבוע זז לכיוון הנכון. אפשר לשנות את השם בכל רגע.</p>
        <div class="field"><label>שם המדד שלי</label>
          <input type="text" id="ns-name" value="${escapeHtml(s.northstarName)}" placeholder="למשל: מספר ימי הרגלים שהשלמתי"/></div>
        <p class="muted suggest-label">רעיונות — לחצי להעתיק לשם המדד:</p>
        <div class="suggest-chips" id="ns-suggestions">
          <button type="button" class="suggest-chip" data-ns-suggest="מספר ימי הרגלים שהשלמתי">מספר ימי הרגלים שהשלמתי</button>
          <button type="button" class="suggest-chip" data-ns-suggest="דקות תנועה">דקות תנועה</button>
          <button type="button" class="suggest-chip" data-ns-suggest="דקות יצירה ממוקדות">דקות יצירה ממוקדות</button>
          <button type="button" class="suggest-chip" data-ns-suggest="שעות שינה איכותית">שעות שינה איכותית</button>
        </div>
        <div class="field"><label>יעד שבועי/חודשי (אופציונלי)</label>
          <input type="text" id="ns-target" value="${escapeHtml(s.northstarTarget || "")}" placeholder="למשל: 5 ימים בשבוע / 90 דקות"/></div>
      </section>

      <section class="card">
        <h2>שינה ואתגר</h2>
        <div class="field"><label>שעת תזכורת שינה</label>
          <input type="text" id="sleep-alarm" value="${escapeHtml(s.sleepAlarm || "")}" placeholder="22:30"/></div>
        <div class="field"><label>האתגר הקשה שלי</label>
          <input type="text" id="challenge" value="${escapeHtml(s.challenge || "")}" placeholder="אתגר שמפחיד קצת…"/></div>
      </section>

      <section class="card">
        <h2>מסנני סביבה (רשימות קבועות)</h2>
        <div class="field"><label>עוזרים / מעצימים</label>
          <div class="tag-list" id="help-tags"></div>
          <div class="btn-row" style="margin-top:6px">
            <input type="text" id="help-input" placeholder="הוסיפי שם או מקום" style="flex:1;margin:0"/>
            <button type="button" class="btn secondary" id="add-help">+</button>
          </div>
        </div>
        <div class="field"><label>שואבי אנרגיה</label>
          <div class="tag-list" id="drain-tags"></div>
          <div class="btn-row" style="margin-top:6px">
            <input type="text" id="drain-input" placeholder="להקטין חשיפה ל…" style="flex:1;margin:0"/>
            <button type="button" class="btn secondary" id="add-drain">+</button>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>גיבוי ושחזור</h2>
        <p class="muted">כל הנתונים נשמרים מקומית במכשיר (localStorage). ייצוא/ייבוא JSON לשמירה בענן או מעבר מכשיר.</p>
        <div class="btn-row">
          <button type="button" class="btn" id="export-json">ייצוא JSON</button>
          <button type="button" class="btn secondary" id="import-json">ייבוא JSON</button>
        </div>
        <input type="file" id="import-file" accept="application/json,.json" hidden />
        <div class="btn-row">
          <button type="button" class="btn danger" id="reset-data">איפוס כל הנתונים</button>
        </div>
      </section>

      ${installCardHtml("settings")}
      ${canShowInstallUi() ? `<section class="card" id="settings-install-fallback-card">
        <h2>איך להתקין (אם אין כפתור)</h2>
        <p class="install-fallback">פתחי ב־<strong>Chrome</strong> (לא בוואטסאפ): תפריט <kbd>⋮</kbd> ← <strong>הוסף למסך הבית</strong> / <strong>התקן אפליקציה</strong>.</p>
        <p class="install-fallback">ב־iPhone (Safari): שתף ← הוסף למסך הבית.</p>
        <div class="btn-row">
          <button type="button" class="btn ghost" id="install-hint">הצג הוראות מלאות</button>
        </div>
      </section>` : ""}

      <section class="card">
        <h2>אודות</h2>
        <p class="muted">מומנטום — מערכת הפעלה אישית. אפליקציה אישית ללא חשבונות וללא רשת חברתית. אזור זמן: Asia/Jerusalem.</p>
        <p class="muted" style="margin-top:6px">גרסה 1.3 · התקנה למסך הבית · נשמר לאחרונה: ${escapeHtml(state.savedAt ? new Date(state.savedAt).toLocaleString("he-IL", { timeZone: TZ }) : "—")}</p>
      </section>
    `;

    renderTags("help-tags", s.helpList || [], "help");
    renderTags("drain-tags", s.drainList || [], "drain");

    document.getElementById("add-help").onclick = () => {
      const v = document.getElementById("help-input").value.trim();
      if (!v) return;
      state.settings.helpList = state.settings.helpList || [];
      state.settings.helpList.push(v);
      document.getElementById("help-input").value = "";
      saveState();
      renderTags("help-tags", state.settings.helpList, "help");
    };
    document.getElementById("add-drain").onclick = () => {
      const v = document.getElementById("drain-input").value.trim();
      if (!v) return;
      state.settings.drainList = state.settings.drainList || [];
      state.settings.drainList.push(v);
      document.getElementById("drain-input").value = "";
      saveState();
      renderTags("drain-tags", state.settings.drainList, "drain");
    };

    const persistSettings = () => {
      state.settings.northstarName = document.getElementById("ns-name").value.trim() || "מדד כוכב הצפון שלי";
      state.settings.northstarTarget = document.getElementById("ns-target").value.trim();
      state.settings.sleepAlarm = document.getElementById("sleep-alarm").value.trim();
      state.settings.challenge = document.getElementById("challenge").value.trim();
      saveState();
    };
    ["ns-name", "ns-target", "sleep-alarm", "challenge"].forEach((id) => {
      document.getElementById(id).addEventListener("change", () => {
        persistSettings();
        toast("נשמר");
      });
    });

    document.querySelectorAll("[data-ns-suggest]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-ns-suggest");
        const input = document.getElementById("ns-name");
        if (!input || !name) return;
        input.value = name;
        persistSettings();
        toast("שם המדד עודכן");
      });
    });

    document.getElementById("export-json").onclick = exportJson;
    document.getElementById("import-json").onclick = () => document.getElementById("import-file").click();
    document.getElementById("import-file").onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || typeof data !== "object") throw new Error("invalid");
          state = { ...defaultState(), ...data, settings: { ...defaultState().settings, ...(data.settings || {}) } };
          saveState();
          toast("הייבוא הצליח");
          updateHeader();
          renderSettings();
        } catch {
          toast("קובץ לא תקין");
        }
      };
      reader.readAsText(file);
    };

    bindInstallButtons();
    const hintBtn = document.getElementById("install-hint");
    if (hintBtn) {
      hintBtn.onclick = () => alert(installInstructionsText());
    };

    document.getElementById("reset-data").onclick = () => {
      if (confirm("למחוק את כל הנתונים? פעולה זו בלתי הפיכה (אלא אם יש לך קובץ ייצוא).")) {
        state = defaultState();
        saveState();
        toast("הנתונים אופסו");
        updateHeader();
        renderSettings();
      }
    };
  }

  function renderTags(elId, list, kind) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = (list || [])
      .map(
        (t, i) =>
          `<span class="tag">${escapeHtml(t)}<button type="button" data-kind="${kind}" data-i="${i}" aria-label="הסר">×</button></span>`
      )
      .join("") || '<span class="muted" style="font-size:0.8rem">אין עדיין</span>';
    el.querySelectorAll("button[data-kind]").forEach((btn) => {
      btn.onclick = () => {
        const k = btn.dataset.kind;
        const i = Number(btn.dataset.i);
        if (k === "help") state.settings.helpList.splice(i, 1);
        else state.settings.drainList.splice(i, 1);
        saveState();
        renderTags(elId, k === "help" ? state.settings.helpList : state.settings.drainList, k);
      };
    });
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `momentum-marina-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("הקובץ הורד");
  }

  /* ---------- Navigation ---------- */
  function switchScreen(name) {
    currentScreen = name;
    document.querySelectorAll(".tab").forEach((t) => {
      const on = t.dataset.screen === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    const map = {
      today: renderToday,
      progress: renderProgress,
      habits: renderHabits,
      weekly: renderWeekly,
      settings: renderSettings,
    };
    (map[name] || renderToday)();
    window.scrollTo(0, 0);
  }

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchScreen(tab.dataset.screen));
  });

  /* ---------- PWA ---------- */
  // Eager SW registration (do not wait for window load)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => {});
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallUi();
    if (currentScreen === "today") renderToday();
    else if (currentScreen === "settings") renderSettings();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    relatedAppsInstalled = true;
    toast("מומנטום הותקן במסך הבית");
    updateInstallUi();
    if (currentScreen === "today") renderToday();
    else if (currentScreen === "settings") renderSettings();
  });

  // getInstalledRelatedApps (Chrome/Android) — hide install if already present
  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then((apps) => {
      if (apps && apps.length) {
        relatedAppsInstalled = true;
        updateInstallUi();
      }
    }).catch(() => {});
  }

  /* ---------- Boot ---------- */
  updateHeader();
  updateInstallUi();
  installUiReady = true;
  switchScreen("today");
  // Refresh header at midnight Jerusalem roughly every minute near day change
  setInterval(() => {
    const label = document.getElementById("today-label");
    if (label && label.textContent !== formatHebrewDate(todayKey())) {
      updateHeader();
      if (currentScreen === "today") renderToday();
    }
  }, 60000);
})();
