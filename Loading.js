const loadingScreen = document.getElementById('loadingScreen');
const loadingText = document.getElementById('loadingText');
const loadingActions = document.getElementById('loadingActions');
const retryBtn = document.getElementById('retryBtn');
const appRoot = document.getElementById('appRoot');

let receivedAnyStatus = false;

function showApp() {
  clearWatchdog();
  loadingScreen.classList.add('hide');
  appRoot.classList.remove('hidden');
  setTimeout(() => {
    loadingScreen.style.display = 'none';
  }, 300);
  window.dispatchEvent(new CustomEvent('ollama-ready'));
}

function showStuckError() {
  loadingText.textContent =
    "Nothing's happening — the app may have failed to start its background checks. Try Retry, or restart the app.";
  loadingScreen.classList.add('error');
  loadingActions.classList.add('show');
}

// If we never hear back from the main process at all, don't leave the
// screen frozen forever. Kept longer than waitForServer's own ~30s
// timeout in main.js so this doesn't false-trigger during a normal wait.
let watchdog = null;
function armWatchdog(ms = 35000) {
  clearWatchdog();
  watchdog = setTimeout(showStuckError, ms);
}
function clearWatchdog() {
  if (watchdog) clearTimeout(watchdog);
  watchdog = null;
}

// Single handler for status updates, called either via the IPC bridge
// (normal path) or via direct script injection from the main process
// (fallback path, used if the preload/bridge failed to load).
function applyStatus(data) {
  receivedAnyStatus = true;
  clearWatchdog();
  if (loadingText) loadingText.textContent = data.message || '';

  if (data.error) {
    loadingScreen.classList.add('error');
    loadingActions.classList.add('show');
    return;
  }

  loadingScreen.classList.remove('error');
  loadingActions.classList.remove('show');

  if (data.ready) {
    showApp();
  } else {
    // Still in progress — re-arm in case the next step stalls too.
    armWatchdog();
  }
}
window.__applyOllamaStatus = applyStatus;

retryBtn.addEventListener('click', () => {
  loadingScreen.classList.remove('error');
  loadingActions.classList.remove('show');
  loadingText.textContent = 'Checking again…';
  if (window.ollamaBridge) {
    armWatchdog();
    window.ollamaBridge.retry();
  } else {
    // No bridge — nothing we can trigger from here, just wait and see
    // if a status shows up (e.g. via the injection fallback again).
    armWatchdog(8000);
  }
});

if (window.ollamaBridge) {
  armWatchdog();
  window.ollamaBridge.onStatus(applyStatus);
} else {
  // Bridge missing could mean: (a) this page is open directly in a
  // regular browser tab with no Electron at all, or (b) we're in
  // Electron but the preload script failed — in which case main.js's
  // executeJavaScript fallback should still call applyStatus shortly.
  // Give it a moment before assuming we're truly outside Electron.
  armWatchdog(6000);
  setTimeout(() => {
    if (!receivedAnyStatus) showApp();
  }, 1500);
}