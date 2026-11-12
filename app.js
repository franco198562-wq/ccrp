const IMAGE_KEYS = [
  'main', 'footer', 'footerPromotion', 'infraction',
  'promotion', 'startup', 'shutdown', 'sessions',
];

const DEFAULTS = {
  version: 1,
  updatedAt: null,
  images: {
    main: '', footer: '', footerPromotion: '', infraction: '',
    promotion: '', startup: '', shutdown: '', sessions: '',
  },
  ourad: { text: '' },
  affiliates: {
    disclaimer:
      'Affiliations are handpicked by the Directive Board. Please refrain from opening a ticket to request for one, as it would be automatically denied.',
    entries: [],
  },
  templates: { accept: '', deny: '', partnership: '' },
};

let state = structuredClone(DEFAULTS);

const $ = (id) => document.getElementById(id);

function setStatus(msg, type = '') {
  const el = $('status');
  el.textContent = msg;
  el.className = 'status' + (type ? ' ' + type : '');
}

function loadSettings() {
  $('api-url').value = localStorage.getItem('ccrp_api_url') || '';
  $('api-secret').value = localStorage.getItem('ccrp_api_secret') || '';
}

function saveSettings() {
  localStorage.setItem('ccrp_api_url', $('api-url').value.trim());
  localStorage.setItem('ccrp_api_secret', $('api-secret').value);
}

document.querySelectorAll('.tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab').forEach((t) => t.classList.add('hidden'));
    $('tab-' + btn.dataset.tab).classList.remove('hidden');
  });
});

function renderImages() {
  const wrap = $('images-fields');
  wrap.innerHTML = '';
  for (const key of IMAGE_KEYS) {
    const label = document.createElement('label');
    label.innerHTML = `${key}<input data-image="${key}" type="url" placeholder="https://..." />`;
    wrap.appendChild(label);
    label.querySelector('input').value = state.images?.[key] || '';
  }
}

function renderAffiliates() {
  $('affiliates-disclaimer').value = state.affiliates?.disclaimer || '';
  const list = $('affiliates-list');
  list.innerHTML = '';
  const entries = state.affiliates?.entries || [];

  entries.forEach((entry, index) => {
    const card = document.createElement('div');
    card.className = 'affiliate-card';
    card.innerHTML = `
      <label>Title<input data-af-title="${index}" type="text" /></label>
      <label>Emoji<input data-af-emoji="${index}" type="text" placeholder="🏖️ or <:name:id>" /></label>
      <label>Server details<textarea data-af-server="${index}" rows="3"></textarea></label>
      <div class="actions">
        <button type="button" class="danger" data-af-remove="${index}">Remove</button>
      </div>
    `;
    list.appendChild(card);
    card.querySelector(`[data-af-title="${index}"]`).value = entry.title || '';
    card.querySelector(`[data-af-emoji="${index}"]`).value =
      typeof entry.emoji === 'string'
        ? entry.emoji
        : entry.emoji?.id
          ? `<:${entry.emoji.name}:${entry.emoji.id}>`
          : '';
    card.querySelector(`[data-af-server="${index}"]`).value = entry.server || '';
  });

  list.querySelectorAll('[data-af-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      collectForm();
      state.affiliates.entries.splice(Number(btn.dataset.afRemove), 1);
      renderAffiliates();
    });
  });
}

function renderAll() {
  renderImages();
  $('ourad-text').value = state.ourad?.text || '';
  renderAffiliates();
  $('tpl-accept').value = state.templates?.accept || '';
  $('tpl-deny').value = state.templates?.deny || '';
  $('tpl-partnership').value = state.templates?.partnership || '';
  $('raw-json').value = JSON.stringify(state, null, 2);
}

function collectForm() {
  state.images = state.images || {};
  document.querySelectorAll('[data-image]').forEach((input) => {
    state.images[input.dataset.image] = input.value.trim();
  });

  state.ourad = { text: $('ourad-text').value };

  state.affiliates = state.affiliates || { disclaimer: '', entries: [] };
  state.affiliates.disclaimer = $('affiliates-disclaimer').value;
  const count = (state.affiliates.entries || []).length;
  const entries = [];
  for (let i = 0; i < count; i++) {
    const titleEl = document.querySelector(`[data-af-title="${i}"]`);
    if (!titleEl) continue;
    const title = titleEl.value.trim();
    const emojiRaw = document.querySelector(`[data-af-emoji="${i}"]`)?.value.trim() || '';
    const server = document.querySelector(`[data-af-server="${i}"]`)?.value.trim() || '';
    if (!title && !server) continue;
    entries.push({
      id: state.affiliates.entries[i]?.id || `${Date.now()}-${i}`,
      title,
      emoji: emojiRaw,
      server,
    });
  }
  state.affiliates.entries = entries;

  state.templates = {
    accept: $('tpl-accept').value,
    deny: $('tpl-deny').value,
    partnership: $('tpl-partnership').value,
  };

  state.version = 1;
  state.updatedAt = new Date().toISOString();
  $('raw-json').value = JSON.stringify(state, null, 2);
}

async function api(method) {
  saveSettings();
  const url = $('api-url').value.trim();
  const secret = $('api-secret').value;
  if (!url) throw new Error('Set API URL first');

  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
  };

  if (method === 'PUT') {
    collectForm();
    opts.body = JSON.stringify(state);
  }

  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

async function loadFromCloud() {
  try {
    setStatus('Loading…');
    const data = await api('GET');
    state = {
      ...structuredClone(DEFAULTS),
      ...data,
      images: { ...DEFAULTS.images, ...(data.images || {}) },
    };
    if (!state.affiliates) state.affiliates = structuredClone(DEFAULTS.affiliates);
    if (!state.templates) state.templates = structuredClone(DEFAULTS.templates);
    if (!state.ourad) state.ourad = structuredClone(DEFAULTS.ourad);
    renderAll();
    setStatus(`Loaded · updated ${state.updatedAt || 'never'}`, 'ok');
  } catch (err) {
    setStatus(String(err.message || err), 'err');
  }
}

async function saveToCloud() {
  try {
    setStatus('Saving…');
    collectForm();
    const data = await api('PUT');
    state = { ...state, ...(data.content || data) };
    renderAll();
    setStatus(`Saved · ${state.updatedAt || 'ok'}`, 'ok');
  } catch (err) {
    setStatus(String(err.message || err), 'err');
  }
}

$('btn-load').addEventListener('click', loadFromCloud);
$('btn-save').addEventListener('click', saveToCloud);

$('btn-add-affiliate').addEventListener('click', () => {
  collectForm();
  state.affiliates.entries = state.affiliates.entries || [];
  state.affiliates.entries.push({ id: `${Date.now()}`, title: '', emoji: '', server: '' });
  renderAffiliates();
});

$('btn-apply-raw').addEventListener('click', () => {
  try {
    state = { ...structuredClone(DEFAULTS), ...JSON.parse($('raw-json').value) };
    renderAll();
    setStatus('Applied raw JSON to form', 'ok');
  } catch (err) {
    setStatus('Invalid JSON: ' + err.message, 'err');
  }
});

loadSettings();
renderAll();
