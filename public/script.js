const API_URL = '/api/chat';

const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const submitButton = form.querySelector('button[type="submit"]');

// Riwayat percakapan yang dikirim ke backend pada setiap request.
const conversation = [];

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  appendMessage('user', userMessage);
  conversation.push({ role: 'user', text: userMessage });

  input.value = '';
  setLoading(true);

  const thinking = appendMessage('bot', 'Thinking...');

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
      thinking.textContent = 'Sorry, no response received.';
      return;
    }

    thinking.textContent = result;
    conversation.push({ role: 'model', text: result });
  } catch (error) {
    console.error('Chat request failed:', error);
    thinking.textContent = 'Failed to get response from server.';
  } finally {
    setLoading(false);
    scrollToBottom();
  }
});

function appendMessage(sender, text) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  msg.textContent = text;
  chatBox.appendChild(msg);
  scrollToBottom();
  return msg;
}

function setLoading(isLoading) {
  input.disabled = isLoading;
  submitButton.disabled = isLoading;
  if (!isLoading) input.focus();
}

function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}
