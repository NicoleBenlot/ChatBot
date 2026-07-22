const loadingScreen = document.getElementById('loadingScreen');
const loadingText = document.getElementById('loadingText');
const loadingActions = document.getElementById('loadingActions');
const retryBtn = document.getElementById('retryBtn');
const appRoot = document.getElementById('appRoot');

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

retryBtn.addEventListener('click', () => {
  loadingScreen.classList.remove('error');
  loadingActions.classList.remove('show');
  loadingText.textContent = 'Checking again…';
  if (window.ollamaBridge) {
    armWatchdog();
    window.ollamaBridge.retry();
  } else {
    showApp();
  }
});

if (window.ollamaBridge) {
  armWatchdog();
  window.ollamaBridge.onStatus((data) => {
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
  });
} else {
  // Not running inside Electron (e.g. opened directly in a browser) —
  // skip the Ollama bootstrap and just show the app.
  showApp();
}