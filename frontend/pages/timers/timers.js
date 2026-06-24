const TIMER_TOOLS_TIMERS_KEY = "timerToolsTimers";

let timers = readJson(TIMER_TOOLS_TIMERS_KEY, []);
let keypadDigits = "";

const timerList = document.getElementById("timer-list");
const clearFinishedButton = document.getElementById("clear-finished");
const keypadDisplay = document.getElementById("keypad-display");
const keypadClearButton = document.getElementById("keypad-clear");
const keypadBackspaceButton = document.getElementById("keypad-backspace");
const keypadStartButton = document.getElementById("keypad-start");

document.addEventListener("DOMContentLoaded", () => {
  hydrateExpiredTimers();
  bindPresetButtons();
  bindKeypad();
  bindTimerActions();
  render();
  setInterval(tickTimers, 250);
});

window.addEventListener("timerToolsUpdated", () => {
  timers = readJson(TIMER_TOOLS_TIMERS_KEY, []);
  renderTimers();
});

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(value) ? value : fallback;
  } catch (error) {
    console.warn(`Failed to read ${key}:`, error);
    return fallback;
  }
}

function saveTimers() {
  localStorage.setItem(TIMER_TOOLS_TIMERS_KEY, JSON.stringify(timers));
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function bindPresetButtons() {
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const minutes = Number(button.dataset.preset);
      addTimer(minutes * 60 * 1000);
    });
  });
}

function bindKeypad() {
  document.querySelectorAll("[data-digit]").forEach((button) => {
    button.addEventListener("click", () => {
      if (keypadDigits.length >= 6) return;
      keypadDigits = `${keypadDigits}${button.dataset.digit}`.replace(/^0+(?=\d)/, "");
      renderKeypad();
    });
  });

  document.querySelectorAll("[data-adjust]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextSeconds = Math.max(0, getKeypadSeconds() + Number(button.dataset.adjust));
      setKeypadFromSeconds(nextSeconds);
    });
  });

  keypadClearButton.addEventListener("click", () => {
    keypadDigits = "";
    renderKeypad();
  });

  keypadBackspaceButton.addEventListener("click", () => {
    keypadDigits = keypadDigits.slice(0, -1);
    renderKeypad();
  });

  keypadStartButton.addEventListener("click", () => {
    const durationMs = getKeypadSeconds() * 1000;
    if (durationMs <= 0) return;
    addTimer(durationMs);
    keypadDigits = "";
    renderKeypad();
  });
}

function bindTimerActions() {
  clearFinishedButton.addEventListener("click", () => {
    timers = timers.filter((timer) => timer.isRunning || getRemainingMs(timer) > 0);
    saveTimers();
    renderTimers();
  });
}

function addTimer(durationMs) {
  const roundedDurationMs = Math.max(1000, Math.round(durationMs));
  const timer = {
    id: uid("timer"),
    durationMs: roundedDurationMs,
    remainingMs: roundedDurationMs,
    endsAt: Date.now() + roundedDurationMs,
    isRunning: true,
    completed: false,
    createdAt: Date.now()
  };

  timers.unshift(timer);
  saveTimers();
  renderTimers();
}

function tickTimers() {
  let shouldRender = false;
  let shouldSave = false;

  timers.forEach((timer) => {
    if (!timer.isRunning || !timer.endsAt) return;

    const remainingMs = Math.max(0, timer.endsAt - Date.now());
    if (remainingMs !== timer.remainingMs) {
      timer.remainingMs = remainingMs;
      shouldRender = true;
    }

    if (remainingMs <= 0) {
      timer.isRunning = false;
      timer.endsAt = null;
      timer.completed = true;
      shouldSave = true;
    }
  });

  if (shouldSave) {
    saveTimers();
  }

  if (shouldRender || shouldSave) {
    renderTimers();
  }
}

function hydrateExpiredTimers() {
  let changed = false;
  timers.forEach((timer) => {
    if (!timer.isRunning || !timer.endsAt) return;
    const remainingMs = Math.max(0, timer.endsAt - Date.now());
    timer.remainingMs = remainingMs;
    if (remainingMs <= 0) {
      timer.isRunning = false;
      timer.endsAt = null;
      timer.completed = true;
    }
    changed = true;
  });

  if (changed) saveTimers();
}

function render() {
  renderTimers();
  renderKeypad();
}

function renderTimers() {
  timerList.innerHTML = "";

  if (timers.length === 0) {
    timerList.innerHTML = `<div class="empty-state">No timers yet.</div>`;
    return;
  }

  timers.forEach((timer) => {
    const remainingMs = getRemainingMs(timer);
    const progress = getProgress(timer, remainingMs);
    const card = document.createElement("article");
    card.className = "timer-card";
    card.classList.toggle("is-running", timer.isRunning);
    card.classList.toggle("is-done", timer.completed || remainingMs <= 0);
    card.style.setProperty("--timer-progress", `${progress}%`);

    card.innerHTML = `
      <div class="timer-status">${getTimerStatus(timer, remainingMs)}</div>
      <div class="timer-display">${formatClock(remainingMs)}</div>
      <div>
        <div class="progress-shell">
          <div class="progress-fill"></div>
        </div>
        <div class="timer-actions">
          <button class="timer-icon-button primary" type="button" data-action="toggle" data-id="${timer.id}" aria-label="${timer.isRunning ? "Pause timer" : "Start timer"}">
            <i class="fa-solid ${timer.isRunning ? "fa-pause" : "fa-play"}"></i>
          </button>
          <button class="timer-icon-button" type="button" data-action="reset" data-id="${timer.id}" aria-label="Reset timer">
            <i class="fa-solid fa-rotate-left"></i>
          </button>
          <button class="timer-icon-button danger" type="button" data-action="delete" data-id="${timer.id}" aria-label="Delete timer">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;

    timerList.appendChild(card);
  });

  timerList.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleTimerAction(button.dataset.action, button.dataset.id));
  });
}

function handleTimerAction(action, id) {
  const timer = timers.find((item) => item.id === id);
  if (!timer && action !== "delete") return;

  if (action === "toggle") {
    if (timer.isRunning) {
      timer.remainingMs = getRemainingMs(timer);
      timer.endsAt = null;
      timer.isRunning = false;
    } else {
      const nextRemaining = timer.remainingMs > 0 ? timer.remainingMs : timer.durationMs;
      timer.remainingMs = nextRemaining;
      timer.endsAt = Date.now() + nextRemaining;
      timer.isRunning = true;
      timer.completed = false;
    }
  }

  if (action === "reset") {
    timer.remainingMs = timer.durationMs;
    timer.endsAt = null;
    timer.isRunning = false;
    timer.completed = false;
  }

  if (action === "delete") {
    timers = timers.filter((item) => item.id !== id);
  }

  saveTimers();
  renderTimers();
}

function renderKeypad() {
  keypadDisplay.textContent = formatClock(getKeypadSeconds() * 1000);
  keypadStartButton.disabled = getKeypadSeconds() <= 0;
}

function getKeypadSeconds() {
  const padded = keypadDigits.padStart(6, "0");
  const hours = Number(padded.slice(0, -4));
  const minutes = Number(padded.slice(-4, -2));
  const seconds = Number(padded.slice(-2));
  return (hours * 3600) + (minutes * 60) + seconds;
}

function setKeypadFromSeconds(totalSeconds) {
  const cappedSeconds = Math.min(totalSeconds, 99 * 3600 + 59 * 60 + 59);
  const hours = Math.floor(cappedSeconds / 3600);
  const minutes = Math.floor((cappedSeconds % 3600) / 60);
  const seconds = cappedSeconds % 60;
  const value = `${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}${String(seconds).padStart(2, "0")}`;
  keypadDigits = String(Number(value) || "");
  renderKeypad();
}

function getRemainingMs(timer) {
  if (timer.isRunning && timer.endsAt) {
    return Math.max(0, timer.endsAt - Date.now());
  }
  return Math.max(0, timer.remainingMs || 0);
}

function getProgress(timer, remainingMs) {
  if (!timer.durationMs) return 0;
  const elapsed = Math.max(0, timer.durationMs - remainingMs);
  return Math.min(100, Math.round((elapsed / timer.durationMs) * 100));
}

function getTimerStatus(timer, remainingMs) {
  if (timer.completed || remainingMs <= 0) return "Done";
  if (timer.isRunning) return "Running";
  return "Ready";
}

function formatClock(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
