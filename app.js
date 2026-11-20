// =========================================================
// APNA APPS SCRIPT '/exec' URL YAHAN PASTE KAREIN:
// =========================================================
const APPS_SCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbxOxUN1RcHShfhXOCjyRoXQO8yq_uZ2Ej6FA0TYbYibriV_EJMMdDSOG0CTJjI3vwdj/exec";

const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30 MB Max
const MAX_PDF_PAGES = 300;              // 300 Pages Max
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// 1. Custom Saarthi PWA Manifest Setup
(function setupSaarthiPWA() {
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#075e54"/><stop offset="100%" stop-color="#0d9488"/></linearGradient></defs>
    <rect width="512" height="512" rx="115" fill="url(#g)"/>
    <circle cx="256" cy="256" r="155" fill="none" stroke="#fcd34d" stroke-width="24"/>
    <circle cx="256" cy="256" r="34" fill="#fcd34d"/>
    <path d="M256 101v65M256 346v65M101 256h65M346 256h65M146 146l46 46M320 320l46 46M366 146l-46 46M192 320l-46 46" stroke="#fcd34d" stroke-width="20" stroke-linecap="round"/>
  </svg>`;
  const iconUrl = "data:image/svg+xml;base64," + btoa(iconSvg);

  const appleIcon = document.createElement('link');
  appleIcon.rel = 'apple-touch-icon';
  appleIcon.href = iconUrl;
  document.head.appendChild(appleIcon);

  const manifest = {
    name: "Saarthi - ज्ञान एवं उपचार मार्गदर्शक",
    short_name: "Saarthi",
    start_url: window.location.origin + window.location.pathname,
    display: "standalone",
    background_color: "#e8e2d7",
    theme_color: "#075e54",
    icons: [
      { src: iconUrl, sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
      { src: iconUrl, sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }
    ]
  };
  const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = URL.createObjectURL(manifestBlob);
  document.head.appendChild(link);
})();

let deferredInstallPrompt = null;
function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isAppAlreadyInstalled() {
  return isStandaloneMode() || localStorage.getItem('saarthi_installed') === 'true';
}

function updateInstallMenuState() {
  const txtEl = document.getElementById('menuInstallText');
  const tagEl = document.getElementById('menuInstallTag');
  if (!txtEl || !tagEl) return;
  if (isAppAlreadyInstalled()) {
    txtEl.textContent = 'ऐप इंस्टॉल है';
    tagEl.textContent = 'Installed ✓';
    tagEl.className = 'text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold';
  } else {
    txtEl.textContent = 'ऐप इंस्टॉल करें';
    tagEl.textContent = 'Install';
    tagEl.className = 'text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium';
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  updateInstallMenuState();
});

window.addEventListener('appinstalled', () => {
  localStorage.setItem('saarthi_installed', 'true');
  deferredInstallPrompt = null;
  updateInstallMenuState();
  showToast('Saarthi ऐप सफलतापूर्वक इंस्टॉल हो गया!');
});

function triggerInstallApp() {
  document.getElementById('headerDropdown').classList.add('hidden');
  if (isAppAlreadyInstalled()) {
    showToast('Saarthi ऐप पहले से आपके फ़ोन में इंस्टॉल है ✓');
    return;
  }
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        localStorage.setItem('saarthi_installed', 'true');
        updateInstallMenuState();
      }
      deferredInstallPrompt = null;
    });
  } else {
    alert("इंस्टॉल करने के लिए ब्राउज़र के ऊपर दाईं ओर (⋮) मेनू दबाएं और 'Add to Home screen' या 'Install app' चुनें।");
  }
}

// =========================================================
// 2. Sticky Header + Chrome Browser Keyboard Clearance Fix
// =========================================================
function syncViewportHeight() {
  const shell = document.getElementById('appShell');
  const inputWrap = document.getElementById('messageInput')?.closest('.wa-wallpaper');
  if (!shell) return;

  if (window.visualViewport) {
    const vvHeight = window.visualViewport.height;
    const isKeyboardOpen = vvHeight < window.innerHeight * 0.82;
    shell.style.height = vvHeight + 'px';
    shell.style.top = window.visualViewport.offsetTop + 'px';

    if (inputWrap) {
      if (isKeyboardOpen && !isStandaloneMode()) {
        inputWrap.style.paddingBottom = '18px';
      } else {
        inputWrap.style.paddingBottom = '12px';
      }
    }
  } else {
    shell.style.height = window.innerHeight + 'px';
  }
  scrollToBottom();
}

function handleInputFocus() {
  setTimeout(syncViewportHeight, 100);
  setTimeout(syncViewportHeight, 320);
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncViewportHeight);
  window.visualViewport.addEventListener('scroll', syncViewportHeight);
}
window.addEventListener('resize', syncViewportHeight);

// =========================================================
// 3. App State & Palettes
// =========================================================
let currentFontSize = Number(localStorage.getItem('gyanhub_font')) || 17;
let allAssistants = [];
let allModes = [];
let activeAssistant = null;
let activeModeId = null;
let pendingAttachment = null;

// Continuous Voice State
let isRecordingVoice = false;
let recognition = null;
let finalVoiceBuffer = "";
let interimVoiceBuffer = "";
let capturedVoiceText = "";

const ASSISTANT_PALETTES = {
  'ACU': {
    headerBg: '#075e54',
    accentBg: '#00a884',
    chatCanvas: '#e8e2d7',
    userBubble: '#dcf8c6',
    chipBg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    sideActive: 'bg-emerald-50 border-emerald-200',
    sideBadge: 'bg-emerald-700'
  },
  'VASTU': {
    headerBg: '#9a3412',
    accentBg: '#c2410c',
    chatCanvas: '#f3ebe3',
    userBubble: '#ffedd5',
    chipBg: 'bg-amber-50 text-amber-900 border-amber-200',
    sideActive: 'bg-amber-50 border-amber-200',
    sideBadge: 'bg-amber-700'
  }
};

function getPalette(astId) {
  const key = (astId || 'ACU').toUpperCase();
  return ASSISTANT_PALETTES[key] || {
    headerBg: '#1e3a8a',
    accentBg: '#2563eb',
    chatCanvas: '#e6ecf2',
    userBubble: '#dbeafe',
    chipBg: 'bg-blue-50 text-blue-900 border-blue-200',
    sideActive: 'bg-blue-50 border-blue-200',
    sideBadge: 'bg-blue-700'
  };
}

document.addEventListener('DOMContentLoaded', () => {
  syncViewportHeight();
  updateFontDisplay();
  updateInstallMenuState();
  buildWaveBars();
  checkLogin();
  fetchBootstrapData();

  document.addEventListener('click', (e) => {
    const dd = document.getElementById('headerDropdown');
    const btn = document.getElementById('headerMenuBtn');
    if (dd && btn && !dd.contains(e.target) && !btn.contains(e.target)) dd.classList.add('hidden');
  });
});

function buildWaveBars() {
  const c = document.getElementById('waveBarsContainer');
  c.innerHTML = '';
  for (let i = 0; i < 18; i++) {
    const b = document.createElement('div');
    b.className = 'wave-bar-active';
    b.style.backgroundColor = 'var(--accent-bg)';
    b.style.animationDelay = `${(i % 5) * 0.12}s`;
    c.appendChild(b);
  }
}

function callBackend(action, dataObj) {
  if (!APPS_SCRIPT_API_URL || APPS_SCRIPT_API_URL.includes("YAHAN_APNA")) {
    return Promise.reject(new Error("APPS_SCRIPT_API_URL सेट नहीं है।"));
  }
  return fetch(APPS_SCRIPT_API_URL, {
    method: 'POST',
    redirect: 'follow',
    body: JSON.stringify({ action, ...dataObj })
  })
  .then(r => r.json())
  .then(res => action === 'chat' ? res.reply : res);
}

function setConnectionUI(connected, subtitle) {
  const badge = document.getElementById('headerConnBadge');
  const subEl = document.getElementById('headerSubtitle');
  const sideText = document.getElementById('backendStatusText');
  const pingDot = document.getElementById('syncPingDot');
  const solidDot = document.getElementById('syncSolidDot');

  if (connected) {
    badge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-400/20 text-emerald-100 border border-emerald-300/30 shrink-0';
    badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-300"></span> Connected';
    const cleanSub = (subtitle || '').replace(/^[●\s]*ऑनलाइन\s*[•·-]?\s*/i, '').trim();
    subEl.textContent = cleanSub;
    sideText.textContent = 'Backend Synced';
    pingDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
    solidDot.className = 'relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500';
  } else {
    badge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-400/20 text-amber-100 border border-amber-300/30 shrink-0';
    badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-300"></span> कनेक्ट हो रहा है...';
    subEl.textContent = '';
    sideText.textContent = 'Connecting...';
  }
}

function fetchBootstrapData(forceClear = false) {
  setConnectionUI(false, '');
  callBackend(forceClear ? 'refreshCache' : 'bootstrap', {})
    .then(res => {
      if (res && res.success && res.assistants && res.assistants.length > 0) {
        allAssistants = res.assistants;
        allModes = res.modes || [];
        renderSidebar();

        const savedId = localStorage.getItem('gyanhub_active_ast');
        const initialId = allAssistants.some(a => a.id === savedId) ? savedId : allAssistants[0].id;
        selectAssistant(initialId);
      }
    })
    .catch(err => showToast('कनेक्शन त्रुटि: ' + err.message));
}

function syncBackendModes() {
  const icon = document.getElementById('syncIcon');
  icon.classList.add('animate-spin');
  fetchBootstrapData(true);
  setTimeout(() => {
    icon.classList.remove('animate-spin');
    showToast('सभी असिस्टेंट और मोड्स सिंक हो गए हैं');
  }, 900);
}

function formatDisplayName(ast) {
  if (ast.id.toUpperCase() === 'ACU') return 'Acupressure Assistant';
  if (ast.id.toUpperCase() === 'VASTU') return 'Vastu Assistant';
  return ast.name;
}

function renderSidebar() {
  const listEl = document.getElementById('assistantList');
  document.getElementById('assistantCountBadge').textContent = allAssistants.length;

  listEl.innerHTML = allAssistants.map(ast => {
    const isSelected = activeAssistant && ast.id === activeAssistant.id;
    const p = getPalette(ast.id);
    const modeCount = allModes.filter(m => m.assistantId === ast.id).length;
    const cleanSub = (ast.subtitle || '').replace(/^[●\s]*ऑनलाइन\s*[•·-]?\s*/i, '').trim();
    const displayName = formatDisplayName(ast);

    return `
      <button onclick="selectAssistant('${ast.id}')" class="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${isSelected ? `${p.sideActive} border shadow-2xs` : 'hover:bg-slate-100 border border-transparent'}">
        <div class="w-10 h-10 rounded-xl ${p.sideBadge} text-white flex items-center justify-center shrink-0">
          <i data-lucide="${ast.id.toUpperCase() === 'VASTU' ? 'compass' : 'sprout'}" class="w-5 h-5"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold text-slate-900 truncate">${displayName}</p>
          <p class="text-xs text-slate-500 truncate mt-0.5">${cleanSub}</p>
          <span class="mt-1 inline-block text-[10px] font-medium px-1.5 py-0.2 bg-white text-slate-600 rounded border border-slate-200/80">${modeCount} मोड्स उपलब्ध</span>
        </div>
      </button>`;
  }).join('');
  lucide.createIcons();
}

// Per-Assistant Persistent Mode Memory
function getSavedModeKey(astId) {
  return 'saarthi_saved_mode_' + (astId || 'ACU').toUpperCase();
}

function selectAssistant(id) {
  const ast = allAssistants.find(a => a.id === id) || allAssistants[0];
  if (!ast) return;
  activeAssistant = ast;
  localStorage.setItem('gyanhub_active_ast', ast.id);

  const p = getPalette(ast.id);
  document.documentElement.style.setProperty('--header-bg', p.headerBg);
  document.documentElement.style.setProperty('--accent-bg', p.accentBg);
  document.documentElement.style.setProperty('--chat-canvas', p.chatCanvas);
  document.documentElement.style.setProperty('--user-bubble', p.userBubble);
  document.getElementById('metaThemeColor').setAttribute('content', p.headerBg);

  const headerAvatar = document.getElementById('headerAvatar');
  headerAvatar.innerHTML = `<i data-lucide="${ast.id.toUpperCase() === 'VASTU' ? 'compass' : 'sprout'}" class="w-5 h-5"></i>`;

  document.getElementById('headerTitle').textContent = formatDisplayName(ast);
  document.getElementById('messageInput').placeholder = ast.placeholder || 'अपना प्रश्न लिखें...';
  setConnectionUI(true, ast.subtitle);

  const astModes = allModes.filter(m => m.assistantId === ast.id);
  const rememberedMode = localStorage.getItem(getSavedModeKey(ast.id));
  if (rememberedMode && astModes.some(m => m.modeId === rememberedMode)) {
    activeModeId = rememberedMode;
  } else {
    activeModeId = astModes.length > 0 ? astModes[0].modeId : 'DEFAULT';
  }

  renderSidebar();
  renderModesBar(astModes);
  renderChatMessages(ast, p, false);
  updatePrimaryActionBtn();

  const sidebar = document.getElementById('sidebar');
  if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 1024) toggleSidebar();
}

function renderModesBar(modesList) {
  const container = document.getElementById('modePillsContainer');
  container.innerHTML = modesList.map(m => {
    const isActive = m.modeId === activeModeId;
    const cleanLabel = m.label.replace('(Default)', '').trim();
    return `
      <button onclick="selectMode('${m.modeId}')" class="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all shrink-0 ${isActive ? 'bg-white text-slate-900 shadow-xs' : 'bg-white/15 text-white hover:bg-white/25'}">
        <span>${cleanLabel}</span>
      </button>`;
  }).join('');
}

function selectMode(modeId) {
  activeModeId = modeId;
  if (activeAssistant) {
    localStorage.setItem(getSavedModeKey(activeAssistant.id), modeId);
  }
  const astModes = allModes.filter(m => m.assistantId === activeAssistant.id);
  renderModesBar(astModes);
  const mObj = astModes.find(m => m.modeId === modeId);
  if (mObj) showToast('मोड सेव किया गया: ' + mObj.label.replace('(Default)', '').trim());
}

function getStorageKey(astId) { return 'gyanhub_30d_' + (astId || 'ACU').toUpperCase(); }

function loadHistory(astId) {
  try {
    const raw = localStorage.getItem(getStorageKey(astId));
    if (!raw) return [];
    const valid = JSON.parse(raw).filter(m => (Date.now() - m.timestamp) <= THIRTY_DAYS_MS);
    localStorage.setItem(getStorageKey(astId), JSON.stringify(valid));
    return valid;
  } catch (e) { return []; }
}

function saveMessage(astId, role, text, modeLabel, suggestions = []) {
  const list = loadHistory(astId);
  list.push({ role, text, modeLabel, suggestions, timestamp: Date.now() });
  localStorage.setItem(getStorageKey(astId), JSON.stringify(list.slice(-150)));
}

// =========================================================
// 4. Render Chat + Top-Locked Word-by-Word Typewriter Reveal
// =========================================================
function renderChatMessages(ast, p, animateLastBot = false) {
  const wrapper = document.getElementById('messagesWrapper');
  const history = loadHistory(ast.id);

  let html = `
    <div class="flex justify-center">
      <span class="px-3 py-1 rounded-lg bg-white/95 text-slate-600 text-[11px] font-semibold shadow-xs">आज</span>
    </div>
    <div class="flex justify-start msg-animate">
      <div class="max-w-[88%] sm:max-w-[78%] rounded-2xl rounded-tl-xs px-4 py-3 text-slate-800 bubble-elevated-bot">
        <div style="font-size:${currentFontSize}px">${escapeHtml(ast.welcomeMsg || 'प्रणाम! मैं Saarthi, आपकी क्या सहायता कर सकता हूँ?')}</div>
      </div>
    </div>`;

  history.forEach((msg, idx) => {
    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
    if (msg.role === 'user') {
      html += `
        <div class="flex justify-end msg-animate">
          <div class="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs px-4 py-2.5 text-slate-900 bubble-elevated-user">
            <p class="leading-relaxed whitespace-pre-wrap select-text" style="font-size:${currentFontSize}px">${escapeHtml(msg.text)}</p>
            <div class="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-slate-500">
              <span>${timeStr}</span>
              <i data-lucide="check-check" class="w-3.5 h-3.5 text-sky-600"></i>
            </div>
          </div>
        </div>`;
    } else {
      const isLast = idx === history.length - 1;
      const sugs = isLast ? (msg.suggestions || []) : [];
      const msgId = 'msg_' + msg.timestamp + '_' + idx;
      const shouldTypewrite = isLast && animateLastBot;

      html += `
        <div class="flex justify-start msg-animate">
          <div class="max-w-[92%] sm:max-w-[82%] rounded-2xl rounded-tl-xs px-4 py-3 text-slate-800 bubble-elevated-bot">
            ${msg.modeLabel ? `<div class="mb-1.5 inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-semibold">${escapeHtml(msg.modeLabel)}</div>` : ''}
            <div id="${msgId}" class="ai-rich-body leading-relaxed whitespace-pre-wrap select-text" style="font-size:${currentFontSize}px">${shouldTypewrite ? '' : formatRichText(msg.text)}</div>
            <div id="${msgId}_footer" class="${shouldTypewrite ? 'hidden' : ''}">
              ${sugs.length > 0 ? `
                <div class="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                  ${sugs.map(q => `<button type="button" onclick="sendSuggested('${escapeJs(q)}')" class="text-left text-xs px-3 py-1.5 rounded-xl border ${p.chipBg} font-medium hover:opacity-85">${escapeHtml(q)}</button>`).join('')}
                </div>` : ''}
              <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-slate-400">
                <button type="button" onclick="copyMsg('${msgId}')" class="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-medium">
                  <i data-lucide="copy" class="w-3.5 h-3.5"></i><span>कॉपी करें</span>
                </button>
                <span class="text-[11px]">${timeStr}</span>
              </div>
            </div>
          </div>
        </div>`;
    }
  });

  wrapper.innerHTML = html;
  lucide.createIcons();

  if (animateLastBot && history.length > 0) {
    const lastIdx = history.length - 1;
    const lastMsg = history[lastIdx];
    const targetId = 'msg_' + lastMsg.timestamp + '_' + lastIdx;
    streamFormattedWords(targetId, targetId + '_footer', formatRichText(lastMsg.text));
  } else {
    scrollToBottom();
  }
}

// Holds screen at TOP of the new reply card so initial 7-8 lines remain readable without auto-scrolling away
function streamFormattedWords(bodyId, footerId, fullHtml) {
  const bodyEl = document.getElementById(bodyId);
  const footerEl = document.getElementById(footerId);
  if (!bodyEl) return;

  const cardEl = bodyEl.closest('.msg-animate');
  if (cardEl) {
    cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const tokens = fullHtml.match(/(<[^>]+>|[^\s<]+|\s+)/g) || [fullHtml];
  let idx = 0;
  let currentHtml = "";

  function step() {
    let wordsAdded = 0;
    while (idx < tokens.length && wordsAdded < 2) {
      const tok = tokens[idx++];
      currentHtml += tok;
      if (!tok.startsWith('<') && tok.trim().length > 0) {
        wordsAdded++;
      }
    }
    bodyEl.innerHTML = currentHtml;

    if (idx < tokens.length) {
      setTimeout(step, 22);
    } else if (footerEl) {
      footerEl.classList.remove('hidden');
      lucide.createIcons();
    }
  }
  step();
}

// Emoji Tray
function toggleEmojiTray() {
  document.getElementById('emojiPickerTray').classList.toggle('hidden');
}
function insertQuickEmoji(str) {
  const inp = document.getElementById('messageInput');
  inp.value = inp.value + str;
  document.getElementById('emojiPickerTray').classList.add('hidden');
  onInputTextChanged(inp);
  inp.focus();
}

function updatePrimaryActionBtn() {
  const btn = document.getElementById('primaryActionBtn');
  const icon = document.getElementById('primaryActionIcon');

  if (isRecordingVoice) {
    btn.style.backgroundColor = '#16a34a';
    btn.classList.add('animate-pulse');
    icon.setAttribute('data-lucide', 'check');
    lucide.createIcons();
    return;
  }

  btn.classList.remove('animate-pulse');
  btn.style.backgroundColor = 'var(--accent-bg)';
  const hasText = document.getElementById('messageInput').value.trim().length > 0;
  const hasFile = pendingAttachment !== null;

  icon.setAttribute('data-lucide', (hasText || hasFile) ? 'send-horizontal' : 'mic');
  lucide.createIcons();
}

function onInputTextChanged(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 112) + 'px';
  updatePrimaryActionBtn();
}

function handlePrimaryActionClick() {
  if (isRecordingVoice) { finishVoiceRecording(); return; }
  const hasText = document.getElementById('messageInput').value.trim().length > 0;
  if (hasText || pendingAttachment) sendChatQuery();
  else startVoiceRecording();
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (document.getElementById('messageInput').value.trim() || pendingAttachment) sendChatQuery();
  }
}

// =========================================================
// 5. Continuous Mic (Survives Pauses + Auto-Stops on Lock/App Switch)
// =========================================================
function startVoiceRecording() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('इस ब्राउज़र में वॉइस टाइपिंग उपलब्ध नहीं है');
    return;
  }

  finalVoiceBuffer = "";
  interimVoiceBuffer = "";
  capturedVoiceText = "";
  isRecordingVoice = true;

  document.getElementById('emojiPickerTray').classList.add('hidden');
  document.getElementById('messageInput').classList.add('hidden');
  document.getElementById('emojiBtn').classList.add('hidden');
  document.getElementById('rightAttachGroup').classList.add('hidden');
  document.getElementById('voiceWaveBox').classList.remove('hidden');
  document.getElementById('voiceWaveBox').classList.add('flex');
  document.getElementById('voiceLiveLabel').textContent = '● बोलिए...';
  updatePrimaryActionBtn();

  launchSpeechEngine();
}

function launchSpeechEngine() {
  if (!isRecordingVoice || document.hidden) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  try {
    recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (ev) => {
      let newInterim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const txt = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) {
          finalVoiceBuffer += (finalVoiceBuffer ? ' ' : '') + txt.trim();
        } else {
          newInterim += txt;
        }
      }
      interimVoiceBuffer = newInterim.trim();
      capturedVoiceText = (finalVoiceBuffer + (interimVoiceBuffer ? ' ' + interimVoiceBuffer : '')).trim();
      if (capturedVoiceText) {
        document.getElementById('voiceLiveLabel').textContent = '✓ ' + capturedVoiceText.slice(-18);
      }
    };

    recognition.onerror = (ev) => {
      if (ev.error === 'not-allowed') {
        alert('कृपया ब्राउज़र सेटिंग में माइक्रोफ़ोन की अनुमति (Allow) दें।');
        cancelVoiceRecording();
      }
    };

    recognition.onend = () => {
      if (isRecordingVoice && !document.hidden) {
        setTimeout(() => {
          if (isRecordingVoice && !document.hidden) launchSpeechEngine();
        }, 150);
      }
    };

    recognition.start();
  } catch (e) {}
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && isRecordingVoice) {
    finishVoiceRecording();
    showToast('स्क्रीन बंद/बदलने के कारण माइक बंद किया गया');
  }
});
window.addEventListener('pagehide', () => {
  if (isRecordingVoice) cancelVoiceRecording();
});

function stopVoiceUI() {
  isRecordingVoice = false;
  document.getElementById('voiceWaveBox').classList.add('hidden');
  document.getElementById('voiceWaveBox').classList.remove('flex');
  document.getElementById('emojiBtn').classList.remove('hidden');
  document.getElementById('rightAttachGroup').classList.remove('hidden');
  document.getElementById('messageInput').classList.remove('hidden');
}

function finishVoiceRecording() {
  const spoken = (capturedVoiceText || finalVoiceBuffer).trim();
  isRecordingVoice = false;
  if (recognition) {
    try { recognition.abort(); } catch (e) {}
    recognition = null;
  }
  stopVoiceUI();
  if (spoken) {
    const inp = document.getElementById('messageInput');
    inp.value = (inp.value.trim() ? inp.value.trim() + ' ' : '') + spoken;
    onInputTextChanged(inp);
    inp.focus();
  }
  updatePrimaryActionBtn();
}

function cancelVoiceRecording() {
  capturedVoiceText = "";
  finalVoiceBuffer = "";
  interimVoiceBuffer = "";
  isRecordingVoice = false;
  if (recognition) {
    try { recognition.abort(); } catch (e) {}
    recognition = null;
  }
  stopVoiceUI();
  updatePrimaryActionBtn();
}

// =========================================================
// 6. Image & PDF Attachment (Max 30MB & Max 300 Pages)
// =========================================================
async function handleAttachmentSelected(e, kind) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  if (file.size > MAX_FILE_BYTES) {
    alert(`फ़ाइल का आकार ${(file.size / (1024 * 1024)).toFixed(1)} MB है। अधिकतम 30 MB तक की फ़ाइल ही संलग्न की जा सकती है।`);
    return;
  }

  if (kind === 'image') {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1280;
        let w = img.width, h = img.height;
        if (w > h && w > MAX_DIM) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM; }
        else if (h > MAX_DIM) { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        pendingAttachment = {
          kind: 'image',
          mimeType: 'image/jpeg',
          base64: dataUrl.split(',')[1],
          previewUrl: dataUrl,
          fileName: file.name,
          metaText: `Image • ${(file.size / 1024).toFixed(0)} KB`
        };
        showAttachmentPreview();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);

  } else if (kind === 'pdf') {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('कृपया केवल PDF फ़ाइल चुनें।');
      return;
    }

    showToast('PDF की जाँच हो रही है...');
    const arrayBuffer = await file.arrayBuffer();

    let pageCount = 0;
    if (window.pdfjsLib) {
      try {
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
        pageCount = pdfDoc.numPages;
        if (pageCount > MAX_PDF_PAGES) {
          alert(`इस PDF में ${pageCount} पेज हैं। अधिकतम ${MAX_PDF_PAGES} पेज तक की PDF ही अनुमत है।`);
          return;
        }
      } catch (pdfErr) {}
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const base64Str = ev.target.result.split(',')[1];
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      pendingAttachment = {
        kind: 'pdf',
        mimeType: 'application/pdf',
        base64: base64Str,
        previewUrl: null,
        fileName: file.name,
        metaText: `PDF${pageCount ? ' • ' + pageCount + ' Pages' : ''} • ${sizeMb} MB`
      };
      showAttachmentPreview();
    };
    reader.readAsDataURL(file);
  }
}

function showAttachmentPreview() {
  if (!pendingAttachment) return;
  const bar = document.getElementById('attachmentPreview');
  const thumb = document.getElementById('attachmentThumb');
  const docIcon = document.getElementById('attachmentDocIcon');

  document.getElementById('attachmentName').textContent = pendingAttachment.fileName;
  document.getElementById('attachmentMeta').textContent = pendingAttachment.metaText;

  if (pendingAttachment.kind === 'image') {
    thumb.src = pendingAttachment.previewUrl;
    thumb.classList.remove('hidden');
    docIcon.classList.add('hidden');
    docIcon.classList.remove('flex');
  } else {
    thumb.classList.add('hidden');
    docIcon.classList.remove('hidden');
    docIcon.classList.add('flex');
  }

  bar.classList.remove('hidden');
  updatePrimaryActionBtn();
}

function removeAttachment() {
  pendingAttachment = null;
  document.getElementById('attachmentPreview').classList.add('hidden');
  updatePrimaryActionBtn();
}

// =========================================================
// 7. Send Query & Shimmer Loader + High-Load Status Alert
// =========================================================
function sendSuggested(q) {
  document.getElementById('messageInput').value = q;
  sendChatQuery();
}

function sendChatQuery() {
  const inp = document.getElementById('messageInput');
  const text = inp.value.trim();
  const attObj = pendingAttachment;
  if (!text && !attObj) return;

  const ast = activeAssistant;
  const p = getPalette(ast.id);
  const mObj = allModes.find(m => m.modeId === activeModeId);
  const modeLabel = mObj ? mObj.label.replace('(Default)', '').trim() : 'सामान्य';

  const priorHistory = loadHistory(ast.id).slice(-5).map(m => ({
    role: m.role,
    text: m.text,
    timeAgo: Math.max(1, Math.floor((Date.now() - m.timestamp) / 60000)) + ' mins ago'
  }));

  const prefixIcon = attObj ? (attObj.kind === 'pdf' ? `[📄 ${attObj.fileName}] ` : `[📷 चित्र] `) : '';
  const displayUserTxt = prefixIcon + (text || 'संलग्न दस्तावेज़ का विश्लेषण करें');
  saveMessage(ast.id, 'user', displayUserTxt, modeLabel, []);

  inp.value = '';
  inp.style.height = 'auto';
  removeAttachment();
  updatePrimaryActionBtn();
  renderChatMessages(ast, p, false);

  const wrapper = document.getElementById('messagesWrapper');
  const loaderEl = document.createElement('div');
  loaderEl.id = 'shimmerLoaderCard';
  loaderEl.className = 'flex justify-start msg-animate';
  loaderEl.innerHTML = `
    <div class="w-[84%] sm:w-[68%] rounded-2xl rounded-tl-xs p-4 bubble-elevated-bot space-y-2.5">
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-600">
        <span class="w-2 h-2 rounded-full animate-ping" style="background-color: var(--accent-bg);"></span>
        <span id="loaderStatusMsg">${(mObj && mObj.thinkingText) || 'Saarthi उत्तर तैयार कर रहा है...'}</span>
      </div>
      <div class="h-3 w-11/12 shimmer-line"></div>
      <div class="h-3 w-4/5 shimmer-line"></div>
      <div class="h-3 w-3/5 shimmer-line"></div>
    </div>`;
  wrapper.appendChild(loaderEl);
  scrollToBottom();

  // Inform user if response takes >6s due to server load / model switch
  const slowLoadTimer = setTimeout(() => {
    const msgEl = document.getElementById('loaderStatusMsg');
    if (msgEl) {
      msgEl.textContent = 'सर्वर पर लोड अधिक है, इसलिए थोड़ा समय लग रहा है — वैकल्पिक मॉडल से उत्तर तैयार किया जा रहा है...';
      msgEl.classList.add('text-amber-700');
    }
  }, 6000);

  const payload = {
    assistantId: ast.id,
    modeId: activeModeId,
    query: text,
    attachmentData: attObj ? { mimeType: attObj.mimeType, base64: attObj.base64, fileName: attObj.fileName } : null,
    userName: localStorage.getItem('gyanhub_user') || 'M.K. Maurya',
    pin: localStorage.getItem('gyanhub_pin') || '',
    history: priorHistory
  };

  callBackend('chat', { payload })
    .then(rawReply => {
      clearTimeout(slowLoadTimer);
      const ld = document.getElementById('shimmerLoaderCard');
      if (ld) ld.remove();

      const regex = /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/i;
      const match = (rawReply || '').match(regex);
      const cleanText = match ? rawReply.replace(regex, '').trim() : (rawReply || '').trim();
      const sugs = match ? match[1].split('\n').map(l => l.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean).slice(0, 2) : [];

      saveMessage(ast.id, 'model', cleanText, modeLabel, sugs);
      if (activeAssistant.id === ast.id) renderChatMessages(ast, p, true);
    })
    .catch(err => {
      clearTimeout(slowLoadTimer);
      const ld = document.getElementById('shimmerLoaderCard');
      if (ld) ld.remove();
      showToast('त्रुटि: ' + err.message);
    });
}

// =========================================================
// 8. Auth & Utilities
// =========================================================
function checkLogin() {
  const name = localStorage.getItem('gyanhub_user');
  const pin = localStorage.getItem('gyanhub_pin');
  if (name) {
    document.getElementById('sidebarUserName').textContent = name;
    document.getElementById('userInitialAvatar').textContent = name.charAt(0).toUpperCase();
  }
  if (!name || !pin) {
    document.getElementById('authModal').classList.remove('hidden');
    document.getElementById('authModal').classList.add('flex');
  }
}

function submitAuthLogin() {
  const name = document.getElementById('authNameInput').value.trim();
  const pin = document.getElementById('authPinInput').value.trim();
  const errEl = document.getElementById('authErrorMsg');
  if (!name || !pin) { errEl.textContent = 'नाम और पिन दोनों दर्ज करें'; errEl.classList.remove('hidden'); return; }

  callBackend('login', { userName: name, pin, deviceInfo: navigator.userAgent })
    .then(res => {
      if (res && res.success) {
        localStorage.setItem('gyanhub_user', name);
        localStorage.setItem('gyanhub_pin', pin);
        document.getElementById('sidebarUserName').textContent = name;
        document.getElementById('authModal').classList.add('hidden');
        document.getElementById('authModal').classList.remove('flex');
      } else {
        errEl.textContent = (res && res.message) || 'अमान्य पिन';
        errEl.classList.remove('hidden');
      }
    })
    .catch(e => { errEl.textContent = e.message; errEl.classList.remove('hidden'); });
}

function logoutUser() {
  localStorage.removeItem('gyanhub_pin');
  document.getElementById('headerDropdown').classList.add('hidden');
  document.getElementById('authModal').classList.remove('hidden');
  document.getElementById('authModal').classList.add('flex');
}

function clearCurrentChat() {
  if (!activeAssistant) return;
  localStorage.removeItem(getStorageKey(activeAssistant.id));
  document.getElementById('headerDropdown').classList.add('hidden');
  renderChatMessages(activeAssistant, getPalette(activeAssistant.id), false);
  showToast('वर्तमान चैट साफ़ की गई');
}

function exportChat() {
  if (!activeAssistant) return;
  const list = loadHistory(activeAssistant.id);
  const txt = list.map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.role === 'user' ? 'आप' : formatDisplayName(activeAssistant)}:\n${m.text}`).join('\n\n---\n\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
  a.download = `Saarthi_${formatDisplayName(activeAssistant).replace(/\s+/g, '_')}.txt`;
  a.click();
  document.getElementById('headerDropdown').classList.add('hidden');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('-translate-x-full');
  document.getElementById('mobileOverlay').classList.toggle('hidden');
}

function toggleHeaderMenu() { document.getElementById('headerDropdown').classList.toggle('hidden'); }

function changeFontSize(delta) {
  currentFontSize = Math.min(24, Math.max(14, currentFontSize + delta));
  localStorage.setItem('gyanhub_font', currentFontSize);
  updateFontDisplay();
  if (activeAssistant) renderChatMessages(activeAssistant, getPalette(activeAssistant.id), false);
}

function updateFontDisplay() {
  document.getElementById('fontSizeDisplay').textContent = currentFontSize + 'px';
  const mob = document.getElementById('fontSizeDisplayMobile');
  if (mob) mob.textContent = currentFontSize;
}

function copyMsg(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText).then(() => showToast('उत्तर कॉपी किया गया'));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMessage').textContent = msg;
  t.classList.remove('opacity-0');
  setTimeout(() => t.classList.add('opacity-0'), 2600);
}

function scrollToBottom() {
  const c = document.getElementById('chatContainer');
  c.scrollTop = c.scrollHeight;
}

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeJs(s) {
  return (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatRichText(text) {
  let safe = escapeHtml(text);
  // Strip accidental full-line bolding on the final question paragraph
  const lines = safe.split('\n');
  if (lines.length > 2) {
    const lastLine = lines[lines.length - 1].trim();
    if (/^\*\*[^*]+\*\*$/.test(lastLine)) {
      lines[lines.length - 1] = lastLine.replace(/^\*\*|\*\*$/g, '');
      safe = lines.join('\n');
    }
  }
  safe = safe.replace(/^#{1,4}\s+(.+)$/gm, '<span class="ai-heading">$1</span>');
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  safe = safe.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, '<b>$1</b>');
  safe = safe.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '<em>$1</em>');
  safe = safe.replace(/^[*-]\s+(.+)$/gm, '• $1');
  return safe;
}
