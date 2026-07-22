const loadingScreen = document.getElementById('loadingScreen');
const loadingText = document.getElementById('loadingText');
const loadingActions = document.getElementById('loadingActions');
const retryBtn = document.getElementById('retryBtn');
const appRoot = document.getElementById('appRoot');

function showApp() {
  loadingScreen.classList.add('hide');
  appRoot.classList.remove('hidden');
  setTimeout(() => {
    loadingScreen.style.display = 'none';
  }, 300);
  window.dispatchEvent(new CustomEvent('ollama-ready'));
}

retryBtn.addEventListener('click', () => {
  loadingScreen.classList.remove('error');
  loadingActions.classList.remove('show');
  loadingText.textContent = 'Checking again…';
  if (window.ollamaBridge) window.ollamaBridge.retry();
});

if (window.ollamaBridge) {
  window.ollamaBridge.onStatus((data) => {
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
    }
  });
} else {
  // Not running inside Electron (e.g. opened directly in a browser) —
  // skip the Ollama bootstrap and just show the app.
  showApp();
}