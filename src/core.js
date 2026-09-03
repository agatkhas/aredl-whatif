/* AREDL What-If, engine (runs in the MAIN world of aredl.net)
 *
 * Keeps a set of overrides ("pretend I beat this demon" / "pretend I didn't"),
 * recomputes points, packs and ranks locally, and rewrites the responses coming
 * back from api.aredl.net so the site itself renders the simulated profile.
 */
(() => {
'use strict';
if (window.__AREDL_WHATIF__) return;

const API       = 'https://api.aredl.net/v2/api/aredl';
const K_OVER    = 'aredl-whatif:overrides';
const K_DATA    = 'aredl-whatif:data2';
const K_SAMPLES = 'aredl-whatif:samples';
const DATA_TTL  = 6 * 60 * 60 * 1000;
const origFetch = window.fetch.bind(window);

/* ------------------------------------------------------------------ state */
/* One override set per player: byPlayer[username][levelUuid] = 1 beaten | 0 not.
 * Keeping them apart means opening someone else's profile doesn't drag your
 * simulation along with it, and coming back restores what you had. */
let store = { player: '', byPlayer: {} };
try {
  const s = JSON.parse(localStorage.getItem(K_OVER) || '{}');
  if (s && typeof s === 'object') {
    store.player   = s.player || '';
    store.byPlayer = s.byPlayer
      || (s.overrides && s.player ? { [s.player]: s.overrides } : {});   // pre-per-player format
  }
} catch {}

const NO_OVERRIDES = Object.freeze({});
const ov      = () => (session.username && store.byPlayer[session.username]) || NO_OVERRIDES;
const ovWrite = () => (store.byPlayer[session.username] ||= {});
const ovCount = () => Object.keys(ov()).length;

const subs   = new Set();
const notify = () => { for (const f of subs) { try { f(); } catch (e) { console.error(e); } } };

function save() {
  const kept = {};
  for (const [user, o] of Object.entries(store.byPlayer)) if (Object.keys(o).length) kept[user] = o;
  store.byPlayer = kept;
  try { localStorage.setItem(K_OVER, JSON.stringify(store)); } catch {}
}

/* ------------------------------------------------------- levels and packs */
const data = { levels: [], byId: new Map(), byGd: new Map(), packs: [], loaded: false, _p: null };

const trimLevel = l => ({
  id: l.id, name: l.name, level_id: l.level_id, position: l.position,
  points: l.points, status: l.status,
});

function flattenPacks(tiers) {
  const out = [];
  for (const t of tiers || []) for (const p of t.packs || []) out.push({
    id: p.id, name: p.name, points: p.points,
    tier: { id: t.id, name: t.name, color: t.color },
    levels: (p.levels || []).map(l => l.id),
  });
  return out;
}

function loadData() {
  if (data._p) return data._p;
  data._p = (async () => {
    let raw = null;
    try {
      const c = JSON.parse(localStorage.getItem(K_DATA) || 'null');
      if (c && Date.now() - c.t < DATA_TTL && c.levels && c.levels.length) raw = c;
    } catch {}
    if (!raw) {
      const [levels, tiers] = await Promise.all([
        /* pending levels have no position and no points, nothing to simulate. A player's own
         * pending completions still resolve through session.extra. */
        origFetch(API + '/levels?exclude_legacy=false&exclude_pending=true').then(r => r.json()),
        origFetch(API + '/pack-tiers').then(r => r.json()),
      ]);
      raw = { t: Date.now(), levels: levels.map(trimLevel), packs: flattenPacks(tiers) };
      try { localStorage.setItem(K_DATA, JSON.stringify(raw)); } catch {}
    }
    data.levels = raw.levels;
    data.packs  = raw.packs;
    data.byId = new Map(); data.byGd = new Map();
    for (const l of data.levels) { data.byId.set(l.id, l); data.byGd.set(l.level_id, l); }
    data.loaded = true;
    notify();
    return data;
  })();
  return data._p;
}

/* ---------------------------------------------------------------- session */
/* The profile currently being simulated: its real records are the baseline. */
const session = {
  username: '', globalName: '', country: 0, clanTag: '', avatar: '',
  base: new Set(),          // level uuids really completed
  extra: new Map(),         // levels in the records but missing from the cache (pending ones)
  baseRank: null,           // rank object straight from the API
  ranks: null,              // ranks for the current simulation
  ranksExact: true,
  loaded: false,
};

const levelOf = id => data.byId.get(id) || session.extra.get(id) || null;

/* Just the parts we need, so remembering a few profiles costs kilobytes not megabytes. */
function distill(body) {
  return {
    username: body.username,
    globalName: body.global_name,
    country: body.country,
    clanTag: body.clan ? body.clan.tag : '',
    avatar: body.discord_id && body.discord_avatar
      ? `https://cdn.discordapp.com/avatars/${body.discord_id}/${body.discord_avatar}.webp?size=64`
      : '',
    rank: body.rank || null,
    ids: body.records.map(r => r.level.id),
    extra: body.records.filter(r => !data.byId.has(r.level.id)).map(r => r.level),
  };
}

function adopt(p) {
  session.username   = p.username;
  session.globalName = p.globalName;
  session.country    = p.country;
  session.clanTag    = p.clanTag;
  session.avatar     = p.avatar;
  session.baseRank   = p.rank;
  session.base       = new Set(p.ids);
  session.extra      = new Map(p.extra.map(l => [l.id, l]));
  session.ranks      = null;          // never show the previous player's ranks
  session.ranksExact = true;
  session.loaded     = true;
  if (store.player !== p.username) { store.player = p.username; save(); }
  prune();
}

/* Drop overrides pointing at levels we can no longer resolve, e.g. a demon that was
 * pending when it was marked and has since been placed or dropped. Otherwise they
 * stay in the count forever with no row to click. */
function prune() {
  const o = store.byPlayer[session.username];
  if (!o) return;
  let dropped = false;
  for (const id of Object.keys(o)) if (!levelOf(id)) { delete o[id]; dropped = true; }
  if (dropped) save();
}

const seen = new Map();               // username (lowercase) -> distilled profile
function remember(p) {
  const k = p.username.toLowerCase();
  seen.delete(k);
  seen.set(k, p);
  while (seen.size > 6) seen.delete(seen.keys().next().value);
}

async function loadPlayer(username) {
  await loadData();
  const res = await origFetch(API + '/profile/' + encodeURIComponent(username));
  if (!res.ok) throw new Error('profile not found');
  const p = distill(await res.json());
  remember(p);
  adopt(p);
  recompute();
}

/* Which profile the address bar is on. The URL decides who we simulate, never a
 * response: the site prefetches a profile on link hover, and adopting those would
 * swap players every time the pointer crossed the leaderboard. */
const pathPlayer = () => {
  const m = location.pathname.match(/^\/profile\/user\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

const loading = new Set();
function syncPlayer() {
  const user = pathPlayer();
  if (!user || user.toLowerCase() === session.username.toLowerCase()) return;
  const p = seen.get(user.toLowerCase());
  if (p) { adopt(p); recompute(); return; }
  if (loading.has(user)) return;
  loading.add(user);
  loadPlayer(user).catch(() => {}).finally(() => loading.delete(user));
}

for (const method of ['pushState', 'replaceState']) {
  const orig = history[method];
  history[method] = function (...args) {
    const out = orig.apply(this, args);
    queueMicrotask(syncPlayer);
    return out;
  };
}
window.addEventListener('popstate', syncPlayer);


/* ------------------------------------------------------------ computation */
const isBeaten = id => { const o = ov(); return id in o ? o[id] === 1 : session.base.has(id); };

function beatenIds() {
  const s = new Set(session.base);
  const o = ov();
  for (const id of Object.keys(o)) o[id] ? s.add(id) : s.delete(id);
  return s;
}

function summarize(ids) {
  let levelPoints = 0, hardest = null;
  for (const id of ids) {
    const l = levelOf(id);
    if (!l) continue;
    levelPoints += l.points || 0;
    /* pending levels have no position yet, they can't be anyone's hardest */
    if (l.position != null && (!hardest || l.position < hardest.position)) hardest = l;
  }
  const packsDone  = data.packs.filter(p => p.levels.length && p.levels.every(id => ids.has(id)));
  const packPoints = packsDone.reduce((s, p) => s + (p.points || 0), 0);
  return { levelPoints, packPoints, total: levelPoints + packPoints, extremes: ids.size, hardest, packsDone };
}

let current = null;       // { before, after }
let hadOverrides = false;

function recompute() {
  if (!session.loaded || !data.loaded) return;
  current = { before: summarize(session.base), after: summarize(beatenIds()) };
  notify();
  scheduleRanks();
  /* only make the site refetch when the simulation actually changes what it should
   * draw, so opening a profile doesn't cost an extra round of requests */
  const has = ovCount() > 0;
  if (has || hadOverrides) scheduleRefresh();
  hadOverrides = has;
}

/* ------------------------------------------------------------------ ranks */
/* Every leaderboard probe returns that player's position in all four orderings,
 * both globally and inside their country, so one request feeds eight
 * (score -> rank) sample lists. Once the samples bracket a score between two
 * adjacent ranks the answer is exact and costs no further request. */
const ORDERS        = ['TotalPoints', 'RawPoints', 'ExtremeCount', 'Hardest'];
const RANK_FIELD    = { TotalPoints: 'rank', RawPoints: 'raw_rank',
                        ExtremeCount: 'extremes_rank', Hardest: 'hardest_rank' };
const COUNTRY_FIELD = { TotalPoints: 'country_rank', RawPoints: 'country_raw_rank',
                        ExtremeCount: 'country_extremes_rank', Hardest: 'country_hardest_rank' };

const hardestScore = h => {
  if (!h) return -1e9;
  const l = data.byGd.get(h.level_id);
  return -(l ? l.position : 1e9);
};
const SCORE = {
  TotalPoints:  e => e.total_points,
  RawPoints:    e => e.total_points - e.pack_points,
  ExtremeCount: e => e.extremes,
  Hardest:      e => hardestScore(e.hardest),
};

/* A scope is '' for the global leaderboard, or a numeric country code. */
const scopeOf    = country => (country ? String(country) : '');
const emptyScope = () => ({ TotalPoints: [], RawPoints: [], ExtremeCount: [], Hardest: [] });

let samples = { stamp: '', totals: {}, byScope: {} };
try {
  const s = JSON.parse(localStorage.getItem(K_SAMPLES) || 'null');
  if (s && s.byScope) samples = s;
} catch {}

function listFor(scope, order) {
  const s = samples.byScope[scope] || (samples.byScope[scope] = emptyScope());
  return s[order] || (s[order] = []);
}

let sampleSaveTimer = null;
function saveSamples() {
  clearTimeout(sampleSaveTimer);
  sampleSaveTimer = setTimeout(() => {
    try { localStorage.setItem(K_SAMPLES, JSON.stringify(samples)); } catch {}
  }, 1000);
}

/** Insert a (score, rank) pair keeping the list sorted by rank ascending. */
function addSample(scope, order, score, rank) {
  if (!Number.isFinite(score) || !Number.isFinite(rank) || rank < 1) return;
  const list = listFor(scope, order);
  let lo = 0, hi = list.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (list[m][1] < rank) lo = m + 1; else hi = m; }
  if (list[lo] && list[lo][1] === rank) { list[lo][0] = score; return; }
  list.splice(lo, 0, [score, rank]);
  if (list.length > 1500) list.splice(1500);
}

function harvest(entry, stamp, count, scope) {
  if (stamp && samples.stamp !== stamp) {           // leaderboard refreshed: samples are stale
    samples = { stamp, totals: {}, byScope: {} };
    probes.clear(); warmed.clear();
  }
  if (count) samples.totals[scope] = count;
  const home = scopeOf(entry.country);              // a global probe still tells us where this
  for (const o of ORDERS) {                         // player sits in their own country
    addSample('', o, SCORE[o](entry), entry[RANK_FIELD[o]]);
    if (home) addSample(home, o, SCORE[o](entry), entry[COUNTRY_FIELD[o]]);
  }
  saveSamples();
}

/** Narrow the rank down to [min, max] using only the samples we already hold. */
function bracket(scope, order, score) {
  const list  = listFor(scope, order);
  const total = samples.totals[scope] || 0;
  let lo = 0, hi = list.length;                     // first sample whose score <= ours
  while (lo < hi) { const m = (lo + hi) >> 1; if (list[m][0] > score) lo = m + 1; else hi = m; }
  const above = lo > 0 ? list[lo - 1] : null;       // last sample strictly better than us
  const below = list[lo] || null;                   // first sample not better than us
  const min = above ? above[1] + 1 : 1;
  const max = below ? below[1] : (total ? total + 1 : 0);
  return { min, max, exact: max > 0 && min === max };
}

const probes = new Map();
function probe(order, index, scope) {
  const key = scope + '|' + order + '|' + index;
  if (probes.has(key)) return probes.get(key);
  const url = API + '/leaderboard?page=' + index + '&per_page=1&order=' + order
            + (scope ? '&country_filter=' + scope : '');
  const p = origFetch(url).then(r => r.json()).then(j => {
    const e = j.data && j.data[0];
    if (e) harvest(e, j.last_refreshed, j.count, scope);
    return { count: j.count, score: e ? SCORE[order](e) : -Infinity };
  });
  probes.set(key, p);
  return p;
}

/** Exact rank for `score`: a binary search inside the bracket the samples give us,
 *  three probes per round so even a wide bracket closes in a few round trips. */
async function searchRank(order, score, min, max, scope) {
  const first = await probe(order, 1, scope);
  const total = first.count || 0;
  if (!total) return 1;
  const at = async i => (i < 1 ? Infinity : i > total ? -Infinity : (await probe(order, i, scope)).score);

  let lo = Math.max(1, min || 1);                   // answer = smallest i with score(i) <= ours
  let hi = Math.min(total + 1, max || total + 1);
  while (hi - lo > 1) {
    const span = hi - lo;
    const k = Math.min(3, span - 1);
    const idx = [...new Set(Array.from({ length: k }, (_, j) => lo + Math.floor(span * (j + 1) / (k + 1))))];
    const vals = await Promise.all(idx.map(at));
    let nlo = lo, nhi = hi;
    idx.forEach((i, j) => { if (vals[j] <= score) nhi = Math.min(nhi, i); else nlo = Math.max(nlo, i + 1); });
    if (nlo === lo && nhi === hi) break;
    lo = nlo; hi = nhi;
  }
  return lo;
}

/** Probe a 1,2,4,8… ladder once per scope: a log-scale index of that leaderboard
 *  which keeps every later bracket small. Sent in small bursts to stay polite. */
const warmed = new Map();
function warm(scope) {
  if (warmed.has(scope)) return warmed.get(scope);
  const job = (async () => {
    const first = await probe('TotalPoints', 1, scope);
    const total = first.count || 0;
    if (!total || listFor(scope, 'TotalPoints').length >= 14) return;
    const idx = [];
    for (let i = 2; i <= total; i *= 2) idx.push(i);
    idx.push(total);
    for (let i = 0; i < idx.length; i += 6) {
      await Promise.all(idx.slice(i, i + 6).map(n => probe('TotalPoints', n, scope).catch(() => {})));
    }
  })().catch(() => {});
  warmed.set(scope, job);
  return job;
}

function scoresOf(sum) {
  return {
    TotalPoints: sum.total,
    RawPoints: sum.levelPoints,
    ExtremeCount: sum.extremes,
    Hardest: sum.hardest ? -sum.hardest.position : -1e9,
  };
}

/** The eight rank fields to fill: four global, four inside the player's country. */
function rankJobs(scope) {
  const jobs = ORDERS.map(o => ({ scope: '', order: o, field: RANK_FIELD[o] }));
  if (scope) for (const o of ORDERS) jobs.push({ scope, order: o, field: COUNTRY_FIELD[o] });
  return jobs;
}

const rankCache = new Map();
let ranksToken = 0, ranksTimer = null;
function scheduleRanks() {
  clearTimeout(ranksTimer);
  ranksTimer = setTimeout(runRanks, 120);
}

async function runRanks() {
  if (!current) return;

  /* nothing simulated means the real ranks are already correct, don't go probing */
  if (!ovCount()) {
    session.ranks = session.baseRank;
    session.ranksExact = true;
    notify();
    return;
  }

  const sc    = scoresOf(current.after);
  const scope = scopeOf(session.country);
  const key   = ORDERS.map(o => sc[o]).join('|') + '|' + scope;

  const cached = rankCache.get(key);
  if (cached) { session.ranks = cached; session.ranksExact = true; notify(); scheduleRefresh(); return; }

  /* 1. answer straight away from the samples we already hold */
  const jobs  = rankJobs(scope);
  const guess = {};
  let exact = true;
  for (const j of jobs) {
    const b = bracket(j.scope, j.order, sc[j.order]);
    guess[j.field] = b.max || (session.baseRank ? session.baseRank[j.field] : b.min);
    exact = exact && b.exact;
  }
  session.ranks = { ...(session.baseRank || {}), ...guess };
  session.ranksExact = exact;
  notify();
  if (exact) { rankCache.set(key, session.ranks); scheduleRefresh(); return; }

  /* 2. refine: binary search inside each bracket, then re-render the site */
  const token = ++ranksToken;
  await warm('');
  if (scope) await warm(scope);
  if (token !== ranksToken) return;

  const out = { ...session.ranks };
  await Promise.all(jobs.map(async j => {
    const b = bracket(j.scope, j.order, sc[j.order]);  // warming may have tightened it
    if (b.exact) { out[j.field] = b.min; return; }
    try { out[j.field] = await searchRank(j.order, sc[j.order], b.min, b.max, j.scope); } catch {}
  }));
  if (token !== ranksToken) return;
  rankCache.set(key, out);
  session.ranks = out;
  session.ranksExact = true;
  notify();
  scheduleRefresh();
}

/* --------------------------------------------------------- API rewriting */
const RX_PROFILE = /\/v2\/api\/aredl\/profile\/([^/?#]+)/;
const RX_LEVELS  = /\/v2\/api\/aredl\/levels(?:\?|$)/;
const RX_LB      = /\/v2\/api\/aredl\/leaderboard(?:\?|$)/;

const asJson = (body, res) => new Response(JSON.stringify(body), {
  status: res.status, statusText: res.statusText, headers: { 'content-type': 'application/json' },
});

function fakeRecord(l) {
  const ts = new Date().toISOString();
  return {
    id: 'whatif-' + l.id,
    level: { id: l.id, name: l.name, level_id: l.level_id, two_player: false,
             position: l.position, points: l.points, status: l.status, requires_raw_footage: false },
    mobile: false, video_url: '', is_verification: false, hide_video: true,
    achieved_at: ts, created_at: ts, updated_at: ts, __whatif: true,
  };
}

async function rewriteProfile(res) {
  const body = await res.clone().json();
  if (!body || !Array.isArray(body.records)) return res;
  await loadData();

  remember(distill(body));
  syncPlayer();
  if (body.username !== session.username) return res;   // a hover prefetch, leave it alone

  const o = ov();
  if (!Object.keys(o).length) return res;

  const keep = new Map();
  for (const r of body.records) if (isBeaten(r.level.id)) keep.set(r.level.id, r);
  for (const id of Object.keys(o)) {
    if (!o[id] || keep.has(id)) continue;
    const l = levelOf(id);
    if (l) keep.set(id, fakeRecord(l));
  }

  const sum = summarize(new Set(keep.keys()));
  /* pending levels have position null and the API lists them last, so keep them there
   * instead of letting null coerce to 0 and float to the top */
  const listOrder = l => (l.position == null ? Number.MAX_SAFE_INTEGER : l.position);
  body.records = [...keep.values()].sort((a, b) => listOrder(a.level) - listOrder(b.level));
  body.packs   = sum.packsDone.map(p => ({ id: p.id, name: p.name, tier: p.tier }));
  body.rank    = {
    ...(body.rank || {}), ...(session.ranks || {}),
    total_points: sum.total, pack_points: sum.packPoints, extremes: sum.extremes,
  };
  return asJson(body, res);
}

async function rewriteLevels(res) {
  const o = ov();
  if (!Object.keys(o).length) return res;
  const body = await res.clone().json();
  if (!Array.isArray(body)) return res;
  for (const l of body) if (l.id in o) l.completed_by_user = o[l.id] === 1;
  return asJson(body, res);
}

async function rewriteLeaderboard(res) {
  if (!ovCount() || !session.username || !current) return res;
  const body = await res.clone().json();
  if (!body || !Array.isArray(body.data)) return res;
  let hit = false;
  for (const e of body.data) {
    const u = e.user || {};
    if (u.username !== session.username) continue;
    const a = current.after;
    e.total_points = a.total; e.pack_points = a.packPoints; e.extremes = a.extremes;
    if (session.ranks) for (const o of ORDERS) {
      e[RANK_FIELD[o]]    = session.ranks[RANK_FIELD[o]];
      e[COUNTRY_FIELD[o]] = session.ranks[COUNTRY_FIELD[o]];
    }
    hit = true;
  }
  return hit ? asJson(body, res) : res;
}

window.fetch = async function (input, init) {
  const res = await origFetch(input, init);
  try {
    if (!res.ok) return res;
    const url = String((input && input.url) || input || '');
    if (url.indexOf('api.aredl.net') === -1) return res;
    if (RX_PROFILE.test(url)) return await rewriteProfile(res);
    if (RX_LEVELS.test(url))  return await rewriteLevels(res);
    if (RX_LB.test(url))      return await rewriteLeaderboard(res);
  } catch (e) {
    console.warn('[what-if] could not rewrite response:', e);
  }
  return res;
};

/* --------------------------------------------------------- site re-render */
let refreshTimer = null;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    const r = window.__TSR_ROUTER__;
    if (!r) return;
    try {
      const qc = r.options && r.options.context && r.options.context.queryClient;
      if (qc) qc.invalidateQueries();
      r.invalidate();
    } catch (e) { console.warn('[what-if] refresh failed:', e); }
  }, 200);
}

/* ---------------------------------------------------------- panel bridge */
window.__AREDL_WHATIF__ = {
  get data()    { return data; },
  get session() { return session; },
  get current() { return current; },
  get count()   { return ovCount(); },
  isBeaten,
  changed: id => id in ov(),
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  toggle(id) {
    if (!session.loaded) return;
    const o = ovWrite();
    if (id in o) delete o[id];
    else o[id] = session.base.has(id) ? 0 : 1;
    save();
    recompute();
  },
  reset() {
    delete store.byPlayer[session.username];
    save();
    recompute();
  },
  search(q, limit = 80) {
    const s = (q || '').trim().toLowerCase();
    const o = ov();
    if (!s) {
      const marked = Object.keys(o).map(levelOf).filter(Boolean)
                           .sort((a, b) => a.position - b.position);
      const room = Math.max(0, limit - marked.length);
      return [...marked, ...data.levels.filter(l => !(l.id in o)).slice(0, room)];
    }
    const n = Number(s);
    const out = [];
    for (const l of data.levels) {
      if (l.name.toLowerCase().includes(s) || l.position === n || l.level_id === n) out.push(l);
      if (out.length >= limit) break;
    }
    return out.sort((a, b) => (b.id in o) - (a.id in o) || a.position - b.position);
  },
};

/* ---------------------------------------------------------------- startup */
loadData().then(() => {
  syncPlayer();                                   // whoever's profile is open wins
  if (!pathPlayer() && store.player) return loadPlayer(store.player).catch(() => {});
}).catch(e => console.warn('[what-if] could not load list data:', e));
})();
