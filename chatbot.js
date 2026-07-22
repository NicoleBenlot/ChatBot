const messagesEl = document.getElementById('messages');
let emptyState = document.getElementById('emptyState');
const chipsEl = document.getElementById('chips');
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const composer = document.getElementById('composer');
const statusLine = document.getElementById('statusLine');
const modelSelect = document.getElementById('modelSelect');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const ollamaUrlInput = document.getElementById('ollamaUrl');
const systemPromptInput = document.getElementById('systemPrompt');
const temperatureInput = document.getElementById('temperatureInput');
const temperatureValueEl = document.getElementById('temperatureValue');
const codeStyleToggle = document.getElementById('codeStyleToggle');
const newChatBtn = document.getElementById('newChatBtn');
const historyListEl = document.getElementById('historyList');

const SEND_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5"></path><path d="M5 12l7-7 7 7"></path></svg>';
const STOP_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"></rect></svg>';

let pendingImages = []; // array of base64 strings (no prefix)
let isStreaming = false;
let activeAbortController = null;

// Models Ollama has already loaded into memory and answered with at
// least once this session. A model's first request after app launch
// (or its first request after being unloaded/idle) has to wait for
// Ollama to read the weights off disk, which can take anywhere from a
// few seconds to well over a minute depending on model size and
// hardware — that's not the app hanging, just the model loading.
const warmedModels = new Set();

function newConversationObject() {
  return { id: null, title: null, model: null, messages: [] };
}
let currentConversation = newConversationObject();

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

// ---------------------------------------------------------------------
// Settings persistence (Ollama URL, system prompt, temperature)
// ---------------------------------------------------------------------
const settingsReadyPromise = (async () => {
  if (!window.settingsBridge) return;
  try {
    const s = await window.settingsBridge.load();
    if (s && s.ollamaUrl) ollamaUrlInput.value = s.ollamaUrl;
    if (s && typeof s.systemPrompt === 'string') systemPromptInput.value = s.systemPrompt;
    if (s && typeof s.temperature === 'number') {
      temperatureInput.value = s.temperature;
      temperatureValueEl.textContent = s.temperature;
    }
    if (s && typeof s.styledCodeBlocks === 'boolean') {
      codeStyleToggle.checked = s.styledCodeBlocks;
    }
  } catch (e) {
    // fall back to field defaults already in the HTML
  }
})();

function persistSettings() {
  if (!window.settingsBridge) return;
  window.settingsBridge.save({
    ollamaUrl: ollamaUrlInput.value,
    systemPrompt: systemPromptInput.value,
    temperature: parseFloat(temperatureInput.value),
    styledCodeBlocks: codeStyleToggle.checked
  });
}
ollamaUrlInput.addEventListener('change', persistSettings);
systemPromptInput.addEventListener('change', persistSettings);
temperatureInput.addEventListener('input', () => {
  temperatureValueEl.textContent = temperatureInput.value;
});
temperatureInput.addEventListener('change', persistSettings);
codeStyleToggle.addEventListener('change', () => {
  persistSettings();
  // Re-render whatever's currently on screen so the change is visible
  // immediately, without needing to reload or resend anything. Skip
  // this while a response is actively streaming in, since that would
  // tear down the DOM element the stream is currently writing into.
  if (!isStreaming) renderConversationMessages(currentConversation);
});

async function loadModels() {
  try {
    const res = await fetch(ollamaUrl() + '/api/tags', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
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
    if (currentConversation.model && models.includes(currentConversation.model)) {
      modelSelect.value = currentConversation.model;
    }
  } catch (err) {
    modelSelect.innerHTML = '<option>Unavailable</option>';
    setStatus('Could not reach Ollama at ' + ollamaUrl() + ' — check the URL in settings.', true);
  }
}
window.addEventListener('ollama-ready', async () => {
  await settingsReadyPromise;
  loadModels();
}, { once: true });
ollamaUrlInput.addEventListener('change', loadModels);

modelSelect.addEventListener('change', () => {
  if (isStreaming) return; // don't stomp on an in-progress "Thinking…"/error status
  const model = modelSelect.value;
  if (model && !warmedModels.has(model)) {
    setStatus(`Switched to ${model} — its first reply may take longer while Ollama loads it into memory.`);
  } else {
    setStatus('');
  }
});

function autoGrow() {
  promptInput.style.height = 'auto';
  promptInput.style.height = Math.min(promptInput.scrollHeight, 160) + 'px';
}
promptInput.addEventListener('input', autoGrow);
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!isStreaming) send();
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

// ---------------------------------------------------------------------
// Lightweight, dependency-free markdown rendering for assistant replies.
// Escapes everything first, then re-introduces a small safe subset of
// HTML: headers, bold/italic, inline code, fenced code blocks (with a
// copy button), links, and lists.
// ---------------------------------------------------------------------
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineFormat(s) {
  s = s.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}

function renderMarkdown(raw) {
  if (!raw) return '';

  // Pull fenced code blocks out first so nothing inside them gets
  // touched by escaping or inline formatting.
  const codeBlocks = [];
  let text = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang: lang || '', code: code.replace(/\n$/, '') });
    return `\u0000CODEBLOCK${idx}\u0000`;
  });

  text = escapeHtml(text);

  const lines = text.split('\n');
  let html = '';
  let listType = null;
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length) {
      html += `<p>${paragraph.map(inlineFormat).join('<br>')}</p>`;
      paragraph = [];
    }
  }
  function closeList() {
    if (listType) {
      html += `</${listType}>`;
      listType = null;
    }
  }

  for (const line of lines) {
    const codeholderMatch = line.match(/^\u0000CODEBLOCK(\d+)\u0000$/);
    const headerMatch = !codeholderMatch && line.match(/^(#{1,4})\s+(.*)/);
    const ulMatch = !codeholderMatch && !headerMatch && line.match(/^\s*[-*]\s+(.*)/);
    const olMatch = !codeholderMatch && !headerMatch && !ulMatch && line.match(/^\s*\d+\.\s+(.*)/);

    if (codeholderMatch) {
      flushParagraph();
      closeList();
      const block = codeBlocks[Number(codeholderMatch[1])];
      const escapedCode = escapeHtml(block.code);
      if (codeStyleToggle.checked) {
        const label = escapeHtml(block.lang) || 'code';
        html += `<pre class="code-block"><div class="code-block-header"><span>${label}</span><button type="button" class="copy-code-btn">Copy</button></div><code>${escapedCode}</code></pre>`;
      } else {
        html += `<pre class="code-block-plain"><code>${escapedCode}</code></pre>`;
      }
    } else if (headerMatch) {
      flushParagraph();
      closeList();
      const level = headerMatch[1].length + 2; // start headings at h3
      html += `<h${level}>${inlineFormat(headerMatch[2])}</h${level}>`;
    } else if (ulMatch) {
      flushParagraph();
      if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
      html += `<li>${inlineFormat(ulMatch[1])}</li>`;
    } else if (olMatch) {
      flushParagraph();
      if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
      html += `<li>${inlineFormat(olMatch[1])}</li>`;
    } else if (line.trim() === '') {
      flushParagraph();
      closeList();
    } else {
      closeList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  closeList();

  return html;
}

// Delegated click handling for copy buttons (works for any message,
// past or present, without needing to rebind listeners each render).
messagesEl.addEventListener('click', (e) => {
  const codeBtn = e.target.closest('.copy-code-btn');
  if (codeBtn) {
    const codeEl = codeBtn.closest('.code-block').querySelector('code');
    navigator.clipboard.writeText(codeEl.textContent).then(() => {
      const original = codeBtn.textContent;
      codeBtn.textContent = 'Copied';
      setTimeout(() => { codeBtn.textContent = original; }, 1200);
    });
    return;
  }
  const msgBtn = e.target.closest('.msg-copy-btn');
  if (msgBtn) {
    const block = msgBtn.closest('.msg-assistant-block');
    const bubble = block.querySelector('.msg-assistant');
    navigator.clipboard.writeText(bubble.textContent).then(() => {
      const original = msgBtn.textContent;
      msgBtn.textContent = 'Copied';
      setTimeout(() => { msgBtn.textContent = original; }, 1200);
    });
  }
});

function clearMessagesDOM() {
  messagesEl.innerHTML = `<div class="empty-state" id="emptyState">
    <img class="empty-state-icon" src="icon.png" alt="">
    <h2>Welcome to ChatBot</h2>
    <p>Ask anything — everything runs locally through Ollama.</p>
  </div>`;
  emptyState = document.getElementById('emptyState');
}

function addMessageToDOM(role, text, images) {
  if (emptyState) { emptyState.remove(); emptyState = null; }
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap';
  if (role === 'user') {
    wrap.innerHTML = `<div class="msg-user"><div class="bubble">
      ${(images || []).map(b64 => `<img src="data:image/png;base64,${b64}">`).join('')}
      <div class="text"></div>
    </div></div>`;
    wrap.querySelector('.text').textContent = text;
  } else {
    wrap.innerHTML = `<div class="msg-assistant-block">
      <div class="msg-assistant pending"></div>
      <button type="button" class="msg-copy-btn">Copy</button>
    </div>`;
  }
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrap;
}

function renderConversationMessages(conv) {
  clearMessagesDOM();
  (conv.messages || []).forEach(m => {
    if (m.role === 'user') {
      addMessageToDOM('user', m.content, m.images);
    } else if (m.role === 'assistant') {
      const wrap = addMessageToDOM('assistant');
      const el = wrap.querySelector('.msg-assistant');
      el.innerHTML = renderMarkdown(m.content || '');
      el.classList.remove('pending');
      if (m.error) el.classList.add('error');
    }
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---------------------------------------------------------------------
// Conversation history (sidebar)
// ---------------------------------------------------------------------
async function saveCurrentConversation() {
  if (!window.historyBridge) return;
  if (currentConversation.messages.length === 0) return;
  if (!currentConversation.title) {
    const firstUserMsg = currentConversation.messages.find(m => m.role === 'user');
    const raw = (firstUserMsg && firstUserMsg.content) || 'New chat';
    currentConversation.title = raw.replace(/\s+/g, ' ').trim().slice(0, 60) || 'New chat';
  }
  currentConversation.model = modelSelect.value || currentConversation.model;
  try {
    const saved = await window.historyBridge.save(currentConversation);
    currentConversation.id = saved.id;
    currentConversation.createdAt = saved.createdAt;
    currentConversation.updatedAt = saved.updatedAt;
    refreshHistoryList();
  } catch (e) {
    // Non-fatal — chat continues to work even if a save fails
  }
}

function setActiveHistoryItem(id) {
  document.querySelectorAll('.history-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
}

function renderHistoryList(conversations) {
  historyListEl.innerHTML = '';
  if (!conversations.length) {
    historyListEl.innerHTML = '<div class="history-empty">No past chats yet</div>';
    return;
  }
  conversations.forEach(conv => {
    const item = document.createElement('div');
    item.className = 'history-item' + (conv.id === currentConversation.id ? ' active' : '');
    item.dataset.id = conv.id;

    const titleEl = document.createElement('span');
    titleEl.className = 'history-title';
    titleEl.textContent = conv.title;

    const delBtn = document.createElement('button');
    delBtn.className = 'history-delete';
    delBtn.type = 'button';
    delBtn.title = 'Delete';
    delBtn.textContent = '\u00d7';

    item.appendChild(titleEl);
    item.appendChild(delBtn);

    item.addEventListener('click', () => loadConversation(conv.id));
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.historyBridge.delete(conv.id);
      if (currentConversation.id === conv.id) startNewChat();
      refreshHistoryList();
    });

    historyListEl.appendChild(item);
  });
}

async function refreshHistoryList() {
  if (!window.historyBridge) return;
  try {
    const list = await window.historyBridge.list();
    renderHistoryList(list);
    setActiveHistoryItem(currentConversation.id);
  } catch (e) {
    // ignore — sidebar just stays as-is
  }
}

async function loadConversation(id) {
  if (!window.historyBridge) return;
  try {
    const conv = await window.historyBridge.load(id);
    if (!conv.messages) conv.messages = [];
    currentConversation = conv;
    renderConversationMessages(currentConversation);
    if (currentConversation.model) {
      const opt = [...modelSelect.options].find(o => o.value === currentConversation.model);
      if (opt) modelSelect.value = currentConversation.model;
    }
    setActiveHistoryItem(id);
    setStatus('');
  } catch (e) {
    setStatus('Could not load that conversation.', true);
  }
}

function startNewChat() {
  if (isStreaming && activeAbortController) activeAbortController.abort();
  currentConversation = newConversationObject();
  clearMessagesDOM();
  setActiveHistoryItem(null);
  setStatus('');
}
newChatBtn.addEventListener('click', startNewChat);

refreshHistoryList();

// ---------------------------------------------------------------------
// Sending messages
// ---------------------------------------------------------------------
function updateSendButton() {
  sendBtn.classList.toggle('is-stop', isStreaming);
  sendBtn.innerHTML = isStreaming ? STOP_ICON : SEND_ICON;
  sendBtn.title = isStreaming ? 'Stop' : 'Send';
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
  currentConversation.messages.push(userMsg);
  saveCurrentConversation();

  pendingImages = [];
  renderChips();
  promptInput.value = '';
  autoGrow();
  const isColdStart = !warmedModels.has(model);
  setStatus(isColdStart ? `Loading ${model} into memory — first reply can take a bit…` : 'Thinking…');

  const assistantWrap = addMessageToDOM('assistant');
  const assistantEl = assistantWrap.querySelector('.msg-assistant');

  isStreaming = true;
  updateSendButton();
  activeAbortController = new AbortController();
  let fullText = '';

  try {
    const requestMessages = [];
    const sys = systemPromptInput.value.trim();
    if (sys) requestMessages.push({ role: 'system', content: sys });
    requestMessages.push(...currentConversation.messages);

    const res = await fetch(ollamaUrl() + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        messages: requestMessages,
        options: { temperature: parseFloat(temperatureInput.value) }
      }),
      signal: activeAbortController.signal
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error('HTTP ' + res.status + ': ' + t);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // renderMarkdown() reprocesses the ENTIRE accumulated response text
    // (regex parsing, escaping, list handling, etc.) every time it's
    // called. Calling it on every single streamed token means the cost
    // grows with the response length and can noticeably lag behind raw
    // token generation on longer answers. Instead, batch DOM updates to
    // once per animation frame — the model can't emit tokens faster than
    // the eye can perceive a repaint anyway, so nothing looks different,
    // it just does far less redundant work.
    let renderScheduled = false;
    function scheduleRender() {
      if (renderScheduled) return;
      renderScheduled = true;
      requestAnimationFrame(() => {
        assistantEl.innerHTML = renderMarkdown(fullText);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        renderScheduled = false;
      });
    }

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
            if (!warmedModels.has(model)) {
              warmedModels.add(model);
              setStatus('Thinking…'); // first token arrived — model's loaded, back to normal status
            }
            fullText += json.message.content;
            scheduleRender();
          }
        } catch (e) { /* partial line, ignore */ }
      }
    }
    // Final render happens synchronously (not waiting on the next
    // animation frame) so the very last chunk is guaranteed to show
    // immediately, even if a frame hadn't fired yet.
    assistantEl.innerHTML = renderMarkdown(fullText);
    assistantEl.classList.remove('pending');
    currentConversation.messages.push({ role: 'assistant', content: fullText });
    saveCurrentConversation();
    setStatus('');
  } catch (err) {
    assistantEl.classList.remove('pending');
    if (err.name === 'AbortError') {
      assistantEl.innerHTML = renderMarkdown(fullText || '_Stopped._');
      currentConversation.messages.push({ role: 'assistant', content: fullText || '(stopped)' });
      saveCurrentConversation();
      setStatus('Stopped.');
    } else {
      assistantEl.textContent = 'Something went wrong reaching Ollama.';
      assistantEl.classList.add('error');
      currentConversation.messages.push({
        role: 'assistant',
        content: 'Something went wrong reaching Ollama.',
        error: true
      });
      saveCurrentConversation();
      setStatus(err.message, true);
    }
  } finally {
    isStreaming = false;
    activeAbortController = null;
    updateSendButton();
  }
}

sendBtn.addEventListener('click', () => {
  if (isStreaming) {
    if (activeAbortController) activeAbortController.abort();
  } else {
    send();
  }
});