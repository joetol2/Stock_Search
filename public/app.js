// Website logic: search form, per-source results with their own paging, and the chat panel.

const $ = (sel) => document.querySelector(sel);
const form = $('#search-form');
const resultsEl = $('#results');
const notice = $('#notice');
const template = $('#card-template');

let sources = [];

async function api(path, options) {
  const res = await fetch(`/api${path}`, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function showNotice(text) {
  notice.textContent = text || '';
  notice.hidden = !text;
}

// ---------- Setup ----------

async function init() {
  try {
    const data = await api('/sources');
    sources = data.sources;
    renderSourcePicker();
    setupChat(data.assistant);
    if (sources.length === 0) showNotice('No search sources are set up yet. Add a DAM or Getty key to the .env file.');
    else if (sources.every((s) => s.id === 'demo')) showNotice('Showing sample DAM data. Add your DAM and Getty keys to search the real libraries.');
  } catch (err) {
    showNotice(err.message);
  }
}

function renderSourcePicker() {
  const picker = $('#source-picker');
  for (const s of sources) {
    const label = document.createElement('label');
    label.className = 'check';
    label.title = s.description;
    label.innerHTML = `<input type="checkbox" name="source" value="${s.id}" checked> <span></span>`;
    label.querySelector('span').textContent = s.label;
    picker.append(label);
  }
  picker.addEventListener('change', updateStockFilters);
  updateStockFilters();
}

function selectedSources() {
  return [...form.querySelectorAll('input[name=source]:checked')].map((i) => i.value);
}

function updateStockFilters() {
  const anyStock = sources.some((s) => s.filters.includes('orientation') && selectedSources().includes(s.id));
  $('#stock-filters').hidden = !anyStock;
}

// ---------- Search ----------

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const chosen = selectedSources();
  if (chosen.length === 0) return showNotice('Pick at least one source.');
  const fd = new FormData(form);
  const params = {
    q: fd.get('q').trim(),
    mediaType: fd.get('mediaType'),
    orientation: fd.get('orientation'),
    people: fd.get('people'),
    sort: fd.get('sort'),
  };
  showNotice('');
  resultsEl.innerHTML = '<p class="loading">Searching…</p>';
  try {
    const data = await api(`/search?${query({ ...params, sources: chosen.join(','), page: 1 })}`);
    renderSearch(resultsEl, data);
  } catch (err) {
    resultsEl.innerHTML = '';
    showNotice(err.message);
  }
});

function query(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  return p.toString();
}

/** Renders a whole search response (used by the form and the chat). */
function renderSearch(container, data, { pageable = true } = {}) {
  container.innerHTML = '';
  if (data.exact) {
    const group = groupShell(`Exact ID match: ${data.exact.sourceLabel}`);
    group.querySelector('.grid').append(card(data.exact));
    container.append(group);
  }
  for (const page of data.results || data.pages || []) {
    container.append(renderGroup(page, pageable ? (data.params || data) : null));
  }
}

function groupShell(title) {
  const section = document.createElement('section');
  section.className = 'group';
  section.innerHTML = '<header class="group-head"><h2></h2><p class="count"></p></header><div class="grid"></div><nav class="pager"></nav>';
  section.querySelector('h2').textContent = title;
  return section;
}

function renderGroup(page, params) {
  const section = groupShell(page.label || page.source);
  const count = section.querySelector('.count');
  const grid = section.querySelector('.grid');

  if (page.error) {
    count.textContent = '';
    grid.innerHTML = '<p class="error"></p>';
    grid.querySelector('.error').textContent = page.error;
    return section;
  }
  if (!page.assets.length) {
    count.textContent = 'No matches for this search.';
    return section;
  }
  count.textContent = `Page ${page.page} of ${page.totalPages} · ${page.total.toLocaleString()} ${page.total === 1 ? 'match' : 'matches'}`;
  page.assets.forEach((a) => grid.append(card(a)));

  if (params && page.totalPages > 1) {
    const pager = section.querySelector('.pager');
    const go = async (n) => {
      pager.querySelectorAll('button').forEach((b) => (b.disabled = true));
      try {
        const data = await api(`/search?${query({ ...params, q: params.q ?? params.query, sources: page.source, page: n })}`);
        section.replaceWith(renderGroup(data.results[0], params));
      } catch (err) {
        showNotice(err.message);
      }
    };
    pager.append(button('◀ Previous', page.page <= 1, () => go(page.page - 1)));
    pager.append(button('Next ▶', page.page >= page.totalPages, () => go(page.page + 1)));
  }
  return section;
}

function button(text, disabled, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ghost small';
  b.textContent = text;
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

function card(asset) {
  const node = template.content.firstElementChild.cloneNode(true);
  const thumb = node.querySelector('.thumb');
  thumb.href = asset.link;
  if (asset.thumbnailUrl) {
    const img = document.createElement('img');
    img.src = asset.thumbnailUrl;
    img.alt = asset.name || asset.title;
    img.loading = 'lazy';
    img.addEventListener('error', () => img.replaceWith(placeholder(asset)));
    thumb.append(img);
  } else {
    thumb.append(placeholder(asset));
  }
  if (asset.mediaType === 'video') thumb.append(Object.assign(document.createElement('span'), { className: 'badge', textContent: '🎬 Video' }));
  if (asset.watermarked) thumb.title = 'Watermarked preview';

  node.querySelector('.title').textContent = asset.title;
  const name = node.querySelector('.name');
  if (asset.name && asset.name !== asset.title) name.textContent = asset.name;
  else name.remove();
  node.querySelector('.meta').textContent = `ID ${asset.id}${asset.fileType ? ` · ${asset.fileType}` : ''}`;

  const warnings = node.querySelector('.warnings');
  for (const w of asset.warnings) {
    const li = document.createElement('li');
    li.textContent = w;
    if (w.startsWith('Freeze ended')) li.className = 'soft';
    warnings.append(li);
  }
  if (!asset.warnings.length) warnings.remove();

  const jobs = node.querySelector('.jobs');
  if (asset.associatedJobs.length) jobs.textContent = `Associated Jobs: ${asset.associatedJobs.join('; ')}`;
  else jobs.remove();

  const open = node.querySelector('.open');
  open.href = asset.link;
  open.textContent = asset.linkLabel;
  return node;
}

function placeholder(asset) {
  const div = document.createElement('div');
  div.className = 'placeholder';
  div.textContent = asset.mediaType === 'video' ? '🎬' : asset.fileType || 'No preview';
  return div;
}

// ---------- Chat ----------

let conversationId = null;

function setupChat(enabled) {
  const toggle = $('#chat-toggle');
  const panel = $('#chat');
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) $('#chat-input').focus();
  });
  $('#chat-new').addEventListener('click', () => {
    conversationId = null;
    $('#chat-log').innerHTML = '';
    say('assistant', greeting(enabled));
  });
  say('assistant', greeting(enabled));
  if (!enabled) {
    $('#chat-input').disabled = true;
    $('#chat-form button').disabled = true;
  }
}

function greeting(enabled) {
  return enabled
    ? "Hi, I'm Q-S Creative Asset Search. Describe what you need and I'll search the connected libraries. Say \"more\" for the next page."
    : 'The assistant is off. Add ANTHROPIC_API_KEY to the .env file to turn it on. The search box still works.';
}

function say(who, text) {
  const log = $('#chat-log');
  const p = document.createElement('div');
  p.className = `msg ${who}`;
  p.textContent = text;
  log.append(p);
  log.scrollTop = log.scrollHeight;
  return p;
}

$('#chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    $('#chat-form').requestSubmit();
  }
});

$('#chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#chat-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  say('user', message);
  const waiting = say('assistant pending', 'Searching…');
  try {
    const data = await api('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, message }),
    });
    conversationId = data.conversationId;
    waiting.remove();
    say('assistant', data.reply);
    showChatResults(data.results);
  } catch (err) {
    waiting.remove();
    say('assistant error', err.message);
  }
});

// Chat results show in the main results area, so they get the full-size cards.
function showChatResults(results) {
  if (!results?.length) return;
  resultsEl.innerHTML = '';
  for (const r of results) {
    const block = document.createElement('div');
    if (r.kind === 'asset') renderSearch(block, { exact: r.asset, results: [] });
    else renderSearch(block, { results: r.pages, params: { ...r.params, q: r.params.query } });
    resultsEl.append(...block.childNodes);
  }
}

init();
