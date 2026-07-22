const messagesEl = document.getElementById('messages');
const emptyState = document.getElementById('emptyState');
const chipsEl = document.getElementById('chips');
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const composer = document.getElementById('composer');
const statusLine = document.getElementById('statusLine');
const modelSelect = document.getElementById('modelSelect');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const ollamaUrlInput = document.getElementById('ollamaUrl');

let pendingImages = []; // array of base64 strings (no prefix)
let history = []; // {role, content, images?}

function ollamaUrl() {
  return ollamaUrlInput.value.replace(/\/$/, '');
}

function setStatus(msg, isError) {
  statusLine.textContent = msg || '';
  statusLine.className = 'status-line' + (isError ? ' error' : '');
}

settingsBtn.addEventListener('click', () => settingsPanel.classList.toggle('open'));
document.addEventListener('click', (e) => {
  if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
    settingsPanel.classList.remove('open');
  }
});

async function loadModels() {
  try {
    // Added headers and credentials configuration to bypass the 403 origin check
    const res = await fetch(ollamaUrl() + '/api/tags', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      mode: 'cors', 
      credentials: 'omit'
    });
    
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const models = (data.models || []).map(m => m.name);
    if (!models.length) {
      modelSelect.innerHTML = '<option>No models found</option>';
      return;
    }
    const visionHint = /vl|vision|llava|pixtral|moondream/i;
    models.sort((a, b) => {
      const av = visionHint.test(a) ? 0 : 1;
      const bv = visionHint.test(b) ? 0 : 1;
      return av - bv;
    });
    modelSelect.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
  } catch (err) {
    modelSelect.innerHTML = '<option>Unavailable</option>';
    setStatus('Could not reach Ollama at ' + ollamaUrl() + ' — check the URL in settings.', true);
  }
}
window.addEventListener('ollama-ready', loadModels, { once: true });
ollamaUrlInput.addEventListener('change', loadModels);


function autoGrow() {
  promptInput.style.height = 'auto';
  promptInput.style.height = Math.min(promptInput.scrollHeight, 160) + 'px';
}
promptInput.addEventListener('input', autoGrow);
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

function addImageFromFile(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    pendingImages.push(dataUrl.split(',')[1]);
    renderChips();
  };
  reader.readAsDataURL(file);
}

function renderChips() {
  chipsEl.innerHTML = '';
  pendingImages.forEach((b64, idx) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `<img src="data:image/png;base64,${b64}"><button class="chip-remove">&times;</button>`;
    chip.querySelector('.chip-remove').addEventListener('click', () => {
      pendingImages.splice(idx, 1);
      renderChips();
    });
    chipsEl.appendChild(chip);
  });
}

// Paste anywhere on the page
document.addEventListener('paste', (e) => {
  const items = e.clipboardData ? e.clipboardData.items : [];
  let found = false;
  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      addImageFromFile(item.getAsFile());
      found = true;
    }
  }
  if (found) promptInput.focus();
});

// Silent drag & drop over the composer
['dragenter', 'dragover'].forEach(evt => {
  composer.addEventListener(evt, (e) => {
    e.preventDefault();
    composer.classList.add('drag-over');
  });
});
['dragleave', 'drop'].forEach(evt => {
  composer.addEventListener(evt, (e) => {
    e.preventDefault();
    composer.classList.remove('drag-over');
  });
});
composer.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  for (const file of files) {
    if (file.type.indexOf('image') !== -1) addImageFromFile(file);
  }
});

function addMessageToDOM(role, text, images) {
  if (emptyState) emptyState.remove();
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap';
  if (role === 'user') {
    wrap.innerHTML = `<div class="msg-user"><div class="bubble">
      ${(images || []).map(b64 => `<img src="data:image/png;base64,${b64}">`).join('')}
      <div class="text"></div>
    </div></div>`;
    wrap.querySelector('.text').textContent = text;
  } else {
    wrap.innerHTML = `<div class="msg-assistant pending"></div>`;
  }
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrap;
}

async function send() {
  const text = promptInput.value.trim();
  if (!text && pendingImages.length === 0) return;
  const model = modelSelect.value;
  if (!model || model === 'Loading models…' || model === 'Unavailable' || model === 'No models found') {
    setStatus('Pick a valid model first.', true);
    return;
  }

  const userMsg = { role: 'user', content: text || '(image)', images: pendingImages.length ? [...pendingImages] : undefined };
  addMessageToDOM('user', text || '(image)', userMsg.images);
  history.push(userMsg);

  pendingImages = [];
  renderChips();
  promptInput.value = '';
  autoGrow();
  sendBtn.disabled = true;
  setStatus('Thinking…');

  const assistantWrap = addMessageToDOM('assistant');
  const assistantEl = assistantWrap.querySelector('.msg-assistant');

  try {
    const res = await fetch(ollamaUrl() + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: true, messages: history })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error('HTTP ' + res.status + ': ' + t);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message && json.message.content) {
            fullText += json.message.content;
            assistantEl.textContent = fullText;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        } catch (e) { /* partial line, ignore */ }
      }
    }
    assistantEl.classList.remove('pending');
    history.push({ role: 'assistant', content: fullText });
    setStatus('');
  } catch (err) {
    assistantEl.classList.remove('pending');
    assistantEl.textContent = 'Something went wrong reaching Ollama.';
    setStatus(err.message, true);
  } finally {
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener('click', send);