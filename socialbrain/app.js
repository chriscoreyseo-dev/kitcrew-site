// UI layer: fetch the graph, wire the controls, describe whatever is selected.

import { Brain } from './graph3d.js';
import { parseQuery, runQuery, METRIC_LABEL as QUERY_METRIC } from './query.js';
import { Voice, voiceSupported } from './voice.js';
import { icon } from './icons.js';
import { estimate } from './predict.js';

const $ = (id) => document.getElementById(id);

const stage = $('stage');
const brain = new Brain(stage);
window.brain = brain; // handy from the console: brain.setMetric('views'), brain.flyTo(id)

let graph = null;

// ------------------------------------------------------------- helpers

const nf = new Intl.NumberFormat('en-US');

function compact(n) {
  if (!n) return '0';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function ago(iso) {
  if (!iso) return 'unknown date';
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(mins)) return 'unknown date';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

const METRIC_LABEL = {
  score: 'engagement',
  views: 'views',
  likes: 'likes',
  comments: 'comments',
  shares: 'shares',
};

const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
};

// ------------------------------------------------------------- loading

async function load({ refresh = false } = {}) {
  const btn = $('refresh');
  btn.disabled = true;
  btn.textContent = refresh ? 'Pulling…' : 'Refresh';
  if (refresh) $('bootMsg').textContent = 'pulling every configured API…';

  try {
    // Normal path: the Node server. Static-hosting path: no server exists, so
    // fall back to a pre-generated graph.json shipped alongside the page.
    let res = await fetch(`api/graph${refresh ? '?refresh=1' : ''}`).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch('./graph.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      graph = await res.json();
      graph.servedFrom = 'static';
      $('refresh').style.display = 'none'; // nothing to re-pull without a server
    } else {
      graph = await res.json();
    }
  } catch (err) {
    $('bootMsg').textContent = `could not build the graph: ${err.message}`;
    btn.disabled = false;
    btn.textContent = 'Retry';
    return;
  }

  brain.setData(graph);
  renderSources();
  renderPlatforms();
  renderTop();
  renderStamp();

  const items = graph.nodes.filter((n) => n.type === 'item').length;
  if (!items) {
    $('bootMsg').innerHTML =
      'No data yet.<br>Copy <code>.env.example</code> to <code>.env</code> and add a YouTube API key, then hit Refresh.';
  } else {
    $('boot').classList.add('gone');
  }

  btn.disabled = false;
  btn.textContent = 'Refresh';
}

function renderStamp() {
  const when = graph?.generatedAt ? ago(graph.generatedAt) : '—';
  const from = graph?.servedFrom === 'stale-cache' ? ' · stale' : '';
  const items = graph.nodes.filter((n) => n.type === 'item').length;
  const demo = graph.sources.some((s) => s.status === 'demo');
  const stamp = $('stamp');
  stamp.textContent = `${demo ? 'DEMO DATA · ' : ''}${items} items · updated ${when}${from}`;
  stamp.style.color = demo ? '#d8b4fe' : '';
}

function renderSources() {
  const host = $('sources');
  host.replaceChildren();
  for (const s of graph.sources) {
    const cls =
      s.status === 'ok'
        ? 'ok'
        : s.status === 'manual' || s.status === 'demo'
          ? 'manual'
          : s.status === 'error'
            ? 'err'
            : 'off';
    const pill = el('span', `src ${cls}`);
    const dot = el('i');
    // The dot is the category's own hue; the text colour still reports status.
    dot.style.background = s.color;
    dot.style.boxShadow = `0 0 8px ${s.color}`;
    pill.append(dot, el('b', s.label), el('span', `${s.itemCount}`));
    const bits = [s.status, s.note, ...(s.warnings ?? [])].filter(Boolean);
    pill.title = bits.join('\n');
    host.append(pill);
  }
}

function renderPlatforms() {
  const host = $('platforms');
  host.replaceChildren();
  const platforms = graph.nodes.filter((n) => n.type === 'platform');
  platforms.forEach((p, i) => {
    const row = el('div', 'plat');
    const hue = brain.nodeColor(p);
    // One custom property drives the icon, the glow and the accent bar.
    row.style.setProperty('--hue', hue);
    row.style.setProperty('--i', String(i)); // staggers the float animation

    const box = el('input');
    box.type = 'checkbox';
    box.checked = brain.filters.platforms.has(p.platform);
    box.addEventListener('change', () => {
      brain.togglePlatform(p.platform, box.checked);
      row.classList.toggle('off', !box.checked);
      renderTop();
    });

    const glyph = el('span', 'ico-wrap');
    glyph.append(icon(p.platform));

    row.append(box, glyph, el('span', 'plat-name', p.label), el('span', 'count', `${p.counts.items}`));
    row.classList.toggle('off', !box.checked);
    row.addEventListener('click', (e) => {
      if (e.target !== box) brain.select(p.id, { fly: true });
    });
    host.append(row);
  });
}

function renderTop() {
  const host = $('top');
  const metric = brain.metric;
  $('topMetricName').textContent = METRIC_LABEL[metric];

  const rows = graph.nodes
    .filter(
      (n) =>
        n.type === 'item' &&
        brain.filters.platforms.has(n.platform) &&
        (!brain.filters.newOnly || n.isNew) &&
        brain.matchesQuery(n),
    )
    .sort((a, b) => (b.metrics[metric] ?? 0) - (a.metrics[metric] ?? 0))
    .slice(0, 40);

  host.replaceChildren();
  if (!rows.length) {
    host.append(el('li', '', 'Nothing matches those filters.'));
    return;
  }
  rows.forEach((n, i) => {
    const li = el('li');
    li.style.setProperty('--hue', brain.nodeColor(n));
    li.append(el('span', 'rank', `${i + 1}`), el('span', 'title', n.label));
    const val = el('span', 'val', compact(n.metrics[metric] ?? 0));
    val.style.color = brain.nodeColor(n);
    li.append(val);
    li.title = n.label;
    li.addEventListener('click', () => brain.select(n.id, { fly: true }));
    host.append(li);
  });
}

// -------------------------------------------------------------- detail

function pathOf(node) {
  const parts = [];
  let cur = node;
  while (cur) {
    parts.unshift(cur.label);
    cur = cur.parent ? graph.nodes.find((n) => n.id === cur.parent) : null;
  }
  return parts.join('  ›  ');
}

function statBlock(metrics, showViews = true) {
  const grid = el('div', 'stats');
  const entries = [
    showViews && ['Views', metrics.views],
    ['Likes', metrics.likes],
    ['Comments', metrics.comments],
    ['Shares', metrics.shares],
    ['Engagement', metrics.score],
  ].filter(Boolean);
  for (const [k, v] of entries) {
    const box = el('div', 'stat');
    box.append(el('div', 'k', k), el('div', 'v', compact(v ?? 0)));
    box.title = nf.format(v ?? 0);
    grid.append(box);
  }
  return grid;
}

// A tiny inline sparkline. No library, no axis - just the shape of the trend.
function sparkline(series, width = 296, height = 42) {
  if (!series || series.length < 2) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const step = width / (series.length - 1);
  const points = series.map((v, i) => [i * step, height - ((v - min) / span) * (height - 6) - 3]);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'spark');
  svg.setAttribute('preserveAspectRatio', 'none');

  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  area.setAttribute(
    'd',
    `M0,${height} ${points.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} L${width},${height} Z`,
  );
  area.setAttribute('class', 'spark-area');

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
  line.setAttribute('class', 'spark-line');

  svg.append(area, line);
  return svg;
}

function deltaChip(label, value) {
  if (value === null || value === undefined) return null;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  const chip = el(
    'span',
    `badge ${value > 0 ? 'up' : value < 0 ? 'down' : ''}`.trim(),
    `${sign}${compact(Math.abs(value))} ${label}`,
  );
  return chip;
}

function renderAccount(panel, node) {
  const a = node.account;

  const badges = el('div', 'badges');
  badges.append(el('span', 'badge', a.platform));
  if (a.demo) badges.append(el('span', 'badge', 'demo'));
  else if (a.manual) badges.append(el('span', 'badge', 'hand-entered'));
  if (a.hidden) badges.append(el('span', 'badge', 'count hidden by channel'));
  panel.append(badges);

  const hero = el('div', 'hero');
  hero.append(
    el('div', 'hero-v', a.followers === null || a.followers === undefined ? '—' : compact(a.followers)),
    el('div', 'hero-k', a.followersLabel ?? 'followers'),
  );
  if (Number.isFinite(a.followers)) hero.title = nf.format(a.followers);
  panel.append(hero);

  const deltas = el('div', 'badges');
  for (const chip of [deltaChip('24h', a.delta24h), deltaChip('7d', a.delta7d)]) {
    if (chip) deltas.append(chip);
  }
  if (!deltas.childElementCount) {
    deltas.append(el('span', 'badge', 'no history yet — trend appears after the next refresh'));
  }
  panel.append(deltas);

  const spark = sparkline(a.series);
  if (spark) panel.append(spark);

  if (a.totals?.length) {
    const grid = el('div', 'stats');
    for (const [k, v] of a.totals) {
      const box = el('div', 'stat');
      box.append(el('div', 'k', k), el('div', 'v', v === null ? '—' : compact(v)));
      if (Number.isFinite(v)) box.title = nf.format(v);
      grid.append(box);
    }
    panel.append(grid);
  }

  panel.append(el('div', 'lbl', 'Interaction on my posts'));
  panel.append(statBlock(node.metrics));

  if (a.url) {
    const open = el('a', 'open', `Open ${a.handle ?? a.platform}`);
    open.href = a.url;
    open.target = '_blank';
    open.rel = 'noopener';
    panel.append(open);
  }

  const children = graph.nodes
    .filter((n) => n.parent === node.id)
    .sort((x, y) => y.metrics.score - x.metrics.score);
  if (children.length) {
    panel.append(el('div', 'lbl', 'My recent posts'));
    const list = el('ul', 'children');
    for (const c of children.slice(0, 30)) {
      const li = el('li');
      li.append(el('span', '', c.label), el('span', 'val', compact(c.metrics.score)));
      li.title = c.label;
      li.addEventListener('click', () => brain.select(c.id, { fly: true }));
      list.append(li);
    }
    panel.append(list);
  }
}

function renderDetail(node) {
  const panel = $('detail');
  if (!node) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  panel.replaceChildren();
  panel.scrollTop = 0;

  panel.append(el('div', 'crumb', pathOf(node)));
  panel.append(el('h2', '', node.label));

  if (node.type === 'item') {
    const badges = el('div', 'badges');
    if (node.isNew) badges.append(el('span', 'badge new', 'NEW · 24h'));
    if (node.rankOverall <= 10) badges.append(el('span', 'badge hot', `#${node.rankOverall} overall`));
    if (node.rankInBranch) badges.append(el('span', 'badge', `#${node.rankInBranch} in branch`));
    badges.append(el('span', 'badge', ago(node.publishedAt)));
    if (node.extra?.manual) badges.append(el('span', 'badge', 'hand-entered'));
    panel.append(badges);

    if (node.thumbnail) {
      const img = el('img');
      img.src = node.thumbnail;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => img.remove());
      panel.append(img);
    }

    if (node.author) {
      const by = el('div', 'by');
      by.append(document.createTextNode('by '));
      if (node.authorUrl) {
        const a = el('a', '', node.author);
        a.href = node.authorUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        by.append(a);
      } else {
        by.append(document.createTextNode(node.author));
      }
      panel.append(by);
    }

    panel.append(statBlock(node.metrics));

    if (node.url) {
      const open = el('a', 'open', 'Open on ' + node.platform);
      open.href = node.url;
      open.target = '_blank';
      open.rel = 'noopener';
      panel.append(open);
    }
    return;
  }

  if (node.account) {
    renderAccount(panel, node);
    return;
  }

  // Root, platform or branch: rolled-up totals plus the children beneath it.
  const badges = el('div', 'badges');
  if (node.counts?.branches !== undefined) badges.append(el('span', 'badge', `${node.counts.branches} branches`));
  if (node.counts?.items !== undefined) badges.append(el('span', 'badge', `${node.counts.items} items`));
  if (node.type === 'platform') badges.append(el('span', 'badge', node.live ? 'live API' : 'manual'));
  panel.append(badges);

  panel.append(statBlock(node.metrics));

  if (node.note) {
    const src = graph.sources.find((s) => s.id === node.platform);
    const warn = src && ['error', 'not-configured', 'empty'].includes(src.status);
    panel.append(el('div', `note${warn ? ' warn' : ''}`, node.note));
  }

  const children = graph.nodes
    .filter((n) => n.parent === node.id)
    .sort((a, b) => b.metrics.score - a.metrics.score);

  if (children.length) {
    panel.append(el('div', 'lbl', node.type === 'branch' ? 'Top in this branch' : 'Branches'));
    const list = el('ul', 'children');
    for (const c of children.slice(0, 30)) {
      const li = el('li');
      li.append(el('span', '', c.label), el('span', 'val', compact(c.metrics.score)));
      li.title = c.label;
      li.addEventListener('click', () => brain.select(c.id, { fly: true }));
      list.append(li);
    }
    panel.append(list);
  }
}

// ------------------------------------------------------------- wiring

brain.on('select', renderDetail);

brain.on('hover', (payload) => {
  const tip = $('tooltip');
  if (!payload) {
    tip.classList.add('hidden');
    return;
  }
  const { node, at } = payload;
  tip.replaceChildren();
  tip.append(el('div', '', node.label));
  if (node.type === 'item') {
    tip.append(
      el(
        'div',
        'm',
        `${compact(node.metrics.views)} views · ${compact(node.metrics.likes)} likes · ${compact(node.metrics.comments)} comments`,
      ),
    );
  } else {
    tip.append(el('div', 'm', `${node.counts?.items ?? 0} items`));
  }
  tip.style.left = `${Math.min(at.x + 16, innerWidth - 320)}px`;
  tip.style.top = `${at.y + 16}px`;
  tip.classList.remove('hidden');
});

$('search').addEventListener('input', (e) => {
  brain.setQuery(e.target.value);
  renderTop();
});

$('metrics').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-metric]');
  if (!btn) return;
  for (const b of $('metrics').children) b.classList.toggle('on', b === btn);
  brain.setMetric(btn.dataset.metric);
  renderTop();
});

$('sizeCats').addEventListener('change', (e) => brain.setSizeCategories(e.target.checked));

$('newOnly').addEventListener('change', (e) => {
  brain.setNewOnly(e.target.checked);
  renderTop();
});

$('spin').addEventListener('change', (e) => brain.setSpin(e.target.checked));
$('colorCode').addEventListener('change', (e) => {
  brain.setColorMode(e.target.checked ? 'category' : 'unified');
  renderPlatforms();
  renderTop();
});
$('reset').addEventListener('click', () => {
  brain.select(null);
  brain.resetView();
});
$('refresh').addEventListener('click', () => load({ refresh: true }));

// ---------------------------------------------------------------- ask

function setAskState(state, message) {
  const dot = $('askDot');
  dot.className = `ask-dot ${state === 'idle' ? '' : state}`.trim();
  const read = $('askRead');
  read.classList.toggle('err', state === 'err');
  if (message !== undefined) read.textContent = message;
}

function openAsk({ focusInput = true } = {}) {
  $('ask').classList.remove('hidden');
  if (focusInput) $('askInput').focus();
}

function ask(text) {
  if (!graph) return;
  const input = $('askInput');
  input.value = text;

  const platformsPresent = graph.nodes.filter((n) => n.type === 'platform').map((n) => n.platform);
  const parsed = parseQuery(text, platformsPresent);
  const hits = runQuery(parsed, graph.nodes);
  const list = $('askHits');
  list.replaceChildren();

  if (!parsed) {
    setAskState('err', 'Nothing to go on there.');
    return;
  }
  if (!hits.length) {
    setAskState('err', `Read it as: ${parsed.interpretation} — but nothing matched.`);
    return;
  }

  setAskState('ok');
  const read = $('askRead');
  read.replaceChildren(document.createTextNode('read as: '), el('b', '', parsed.interpretation));

  hits.forEach((n, i) => {
    const li = el('li', i === 0 ? 'lead' : '');
    let meta;
    let where = n.platform;
    if (n.account) {
      where = n.account.platform;
      const f = n.account.followers;
      const d = n.account.delta24h;
      meta = `${f === null || f === undefined ? '—' : compact(f)} ${n.account.followersLabel ?? 'followers'}`;
      if (d) meta += ` (${d > 0 ? '+' : '−'}${compact(Math.abs(d))} 24h)`;
    } else if (parsed.sortBy === 'published') {
      meta = ago(n.publishedAt);
    } else {
      meta = `${compact(n.metrics[parsed.sortBy] ?? 0)} ${QUERY_METRIC[parsed.sortBy]}`;
    }
    li.append(
      el('span', 'rank', `${i + 1}`),
      el('span', 't', n.label),
      el('span', 'meta', `${where} · ${meta}`),
    );
    li.title = n.label;
    li.addEventListener('click', () => brain.select(n.id, { fly: true }));
    list.append(li);
  });

  // Pull the top answer up immediately - that is the whole point.
  brain.select(hits[0].id, { fly: true });
}

const voice = new Voice({
  onState: (state) => {
    $('mic').classList.toggle('listening', state === 'listening');
    if (state === 'listening') setAskState('listening', 'listening…');
    else if ($('askDot').classList.contains('listening')) setAskState('idle', '');
  },
  onTranscript: (text, isFinal) => {
    $('askInput').value = text;
    if (!isFinal) setAskState('listening', `listening… “${text}”`);
  },
  onResult: (text) => ask(text),
  onError: (message) => setAskState('err', message),
});

$('mic').addEventListener('click', () => {
  openAsk({ focusInput: false });
  if (!voiceSupported) {
    setAskState('err', 'No speech recognition in this browser — type the question instead.');
    $('askInput').focus();
    return;
  }
  voice.toggle();
});

$('askGo').addEventListener('click', () => ask($('askInput').value));
$('askInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') ask($('askInput').value);
});
$('askClose').addEventListener('click', () => {
  voice.stop();
  $('ask').classList.add('hidden');
});

if (!voiceSupported) {
  $('mic').title = 'This browser has no speech recognition — opens the typed Ask box';
}

// ------------------------------------------------------------ draft check

// The platform list for the form, using the real network name for MY ACCOUNTS
// rather than the umbrella category.
function predictPlatforms() {
  const ids = new Set();
  for (const n of graph.nodes) {
    if (n.type === 'platform' && n.platform !== 'accounts') ids.add(n.platform);
    if (n.account?.platform) ids.add(n.account.platform);
  }
  return [...ids].sort();
}

function fillPredictForm() {
  const sel = $('pfPlatform');
  sel.replaceChildren();
  for (const id of predictPlatforms()) {
    const opt = el('option', '', id);
    opt.value = id;
    sel.append(opt);
  }
  fillPredictBranches();
  tintPredict();

  const iconHost = $('pfIcon');
  iconHost.replaceChildren();
  iconHost.append(icon('draft'));

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  $('pfWhen').value = now.toISOString().slice(0, 16);
}

// Tint the whole panel with the selected platform's hue, so Draft check is
// visually wired to the same colour coding as everything else.
function tintPredict() {
  const platform = $('pfPlatform').value;
  const node =
    graph.nodes.find((n) => n.type === 'platform' && n.platform === platform) ??
    graph.nodes.find((n) => n.account?.platform === platform);
  const hue = node ? brain.nodeColor(node.account ? { ...node, color: node.color } : node) : '#b98cff';
  $('predict').style.setProperty('--hue', hue);
}

function fillPredictBranches() {
  const platform = $('pfPlatform').value;
  const sel = $('pfBranch');
  sel.replaceChildren();
  const any = el('option', '', 'any');
  any.value = '';
  sel.append(any);
  for (const b of graph.nodes.filter((n) => n.type === 'branch' && n.platform === platform)) {
    const opt = el('option', '', b.label);
    opt.value = b.id;
    sel.append(opt);
  }
}

function runPredict() {
  const out = $('pfOut');
  out.replaceChildren();

  const result = estimate(
    {
      platform: $('pfPlatform').value,
      branchId: $('pfBranch').value || undefined,
      title: $('pfTitle').value,
      when: $('pfWhen').value || undefined,
    },
    graph,
  );

  if (!result.ok) {
    out.append(el('div', 'note warn', result.reason));
    return;
  }

  if (result.confidence === 'none') {
    out.append(el('div', 'note warn', result.confidenceWhy));
  }

  const range = el('div', 'pred-range');
  range.append(
    el('div', 'pred-edge', compact(Math.round(result.low))),
    el('div', 'pred-mid', compact(Math.round(result.mid))),
    el('div', 'pred-edge', compact(Math.round(result.high))),
  );
  out.append(el('div', 'lbl', 'Comparable posts landed in this range'));
  out.append(range);
  out.append(
    el(
      'div',
      'pred-scale',
      'typical low  ·  median  ·  typical high   (views, middle 50% of comparables)',
    ),
  );

  const meta = el('div', 'badges');
  meta.append(el('span', `badge ${result.confidence === 'medium' ? '' : 'hot'}`.trim(), `confidence: ${result.confidence}`));
  meta.append(el('span', 'badge', `${result.counts.matched} comparables`));
  meta.append(el('span', 'badge', `${result.counts.mine} of your own`));
  out.append(meta);

  out.append(el('div', 'note', `${result.confidenceWhy}\nBased on ${result.basis}. ${result.matchedOn}.`));

  out.append(el('div', 'lbl', 'Factors you control, measured in this data'));
  const list = el('ul', 'signals');
  for (const s of result.signals) {
    const li = el('li', `sig ${s.verdict}${s.present ? ' present' : ''}`);
    const mark = { up: '▲', down: '▼', flat: '–', unknown: '?' }[s.verdict];
    li.append(
      el('span', 'sig-mark', mark),
      el('span', 'sig-body', `${s.label}${s.present ? ' — your draft has this' : ''}`),
    );
    li.append(el('span', 'sig-detail', s.detail));
    list.append(li);
  }
  out.append(list);

  out.append(
    el(
      'div',
      'note warn',
      'This is not a prediction. It is what similar posts already did. The two biggest drivers of ' +
        'views — what the algorithm does in the first hour, and who already follows you — are not in ' +
        'this data and cannot be.',
    ),
  );
}

// A result that no longer matches the inputs above it is worse than no result
// at all - so any change to the form wipes it.
function clearPredictOut() {
  $('pfOut').replaceChildren();
}

let predictReady = false;

$('predictBtn').addEventListener('click', () => {
  const panel = $('predict');
  const opening = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  if (!opening || !graph) return;

  // Populate once. Reopening must NOT wipe a draft you are part-way through -
  // losing typed work to a stray Escape is worse than any staleness risk, and
  // the inputs and the result stay in sync because every edit clears the result.
  if (!predictReady) {
    fillPredictForm();
    predictReady = true;
  }
  $('pfTitle').focus();
});
$('predictClose').addEventListener('click', () => $('predict').classList.add('hidden'));
$('pfPlatform').addEventListener('change', () => {
  fillPredictBranches();
  tintPredict();
  clearPredictOut();
});
for (const id of ['pfBranch', 'pfWhen', 'pfTitle']) {
  $(id).addEventListener('input', clearPredictOut);
}
$('pfRun').addEventListener('click', runPredict);
$('pfTitle').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runPredict();
});

addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

  if (e.key === 'Escape') {
    voice.stop();
    $('ask').classList.add('hidden');
    $('predict').classList.add('hidden');
    brain.select(null);
    $('search').blur();
  }
  if (e.key === '/' && !typing) {
    e.preventDefault();
    $('search').focus();
  }
  // Space anywhere starts listening - the "just ask it" path.
  if (e.code === 'Space' && !typing) {
    e.preventDefault();
    openAsk({ focusInput: false });
    if (voiceSupported) voice.toggle();
    else $('askInput').focus();
  }
});

load();
