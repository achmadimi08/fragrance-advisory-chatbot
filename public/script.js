const API_URL = '/api/chat';

const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const emptyState = document.getElementById('empty-state');
const themeToggle = document.getElementById('theme-toggle');
const submitButton = form.querySelector('button[type="submit"]');

// Riwayat percakapan yang dikirim ke backend pada setiap request.
const conversation = [];

/* ===== Dark mode ===== */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch (e) {
    /* localStorage bisa diblokir di private mode — abaikan saja. */
  }
}

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
});

/* ===== Chat ===== */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  appendMessage('user', userMessage);
  conversation.push({ role: 'user', text: userMessage });

  input.value = '';
  setLoading(true);

  const loadingBubble = appendLoading();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversations: conversation }),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const result = typeof data.result === 'string' ? data.result.trim() : '';

    if (!result) {
      showError(loadingBubble, 'Maaf, tidak ada balasan yang diterima.');
      return;
    }

    loadingBubble.classList.remove('loading');
    loadingBubble.innerHTML = renderMarkdown(result);
    conversation.push({ role: 'model', text: result });
  } catch (error) {
    console.error('Chat request failed:', error);
    showError(loadingBubble, 'Gagal mendapatkan respons dari server.');
  } finally {
    setLoading(false);
    scrollToBottom();
  }
});

function appendMessage(sender, text) {
  hideEmptyState();
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  msg.textContent = text;
  chatBox.appendChild(msg);
  scrollToBottom();
  return msg;
}

function appendLoading() {
  hideEmptyState();
  const msg = document.createElement('div');
  msg.classList.add('message', 'bot', 'loading');
  msg.setAttribute('aria-live', 'polite');
  msg.innerHTML =
    '<span class="typing-dots"><span></span><span></span><span></span></span>' +
    '<span class="loading-label">Meracik rekomendasi...</span>';
  chatBox.appendChild(msg);
  scrollToBottom();
  return msg;
}

function showError(bubble, message) {
  bubble.classList.remove('loading');
  bubble.classList.add('error');
  bubble.textContent = message;
}

function hideEmptyState() {
  if (emptyState && emptyState.isConnected) emptyState.remove();
}

function setLoading(isLoading) {
  input.disabled = isLoading;
  submitButton.disabled = isLoading;
  if (!isLoading) input.focus();
}

function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}
