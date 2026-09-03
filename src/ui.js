/* AREDL What-If, panel UI.
 * Lives in a shadow root and reuses the site's own design tokens, Poppins
 * scale, Lucide icons and list-row markup so it reads as a native feature.
 */
(() => {
'use strict';
const WI = window.__AREDL_WHATIF__;
if (!WI || document.getElementById('aredl-whatif')) return;

/* Icons lifted from aredl.net's own Lucide chunks (24x24, stroke 2, round caps). */
const icon = (name, paths, size = 20) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" `
  + `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" `
  + `class="lucide lucide-${name}" aria-hidden="true">${paths}</svg>`;

const ICON = {
  search:  icon('search', '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>', 24),
  x:       icon('x', '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 18),
  check:   icon('circle-check-big', '<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>', 22),
  eraser:  icon('eraser', '<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 '
                 + '2.828 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/>', 18),
};

/* ISO 3166-1 numeric -> alpha-2, so we can point at the site's own /assets/flags/*.svg */
const FLAGS = new Map(`
  4:af,8:al,10:aq,12:dz,16:as,20:ad,24:ao,28:ag,31:az,32:ar,36:au,40:at,44:bs,48:bh,50:bd,
  51:am,52:bb,56:be,60:bm,64:bt,68:bo,70:ba,72:bw,74:bv,76:br,84:bz,86:io,90:sb,92:vg,
  96:bn,100:bg,104:mm,108:bi,112:by,116:kh,120:cm,124:ca,132:cv,136:ky,140:cf,144:lk,
  148:td,152:cl,156:cn,158:tw,162:cx,166:cc,170:co,174:km,175:yt,178:cg,180:cd,184:ck,
  188:cr,191:hr,192:cu,196:cy,203:cz,204:bj,208:dk,212:dm,214:do,218:ec,222:sv,226:gq,
  231:et,232:er,233:ee,234:fo,238:fk,239:gs,242:fj,246:fi,248:ax,250:fr,254:gf,258:pf,
  260:tf,262:dj,266:ga,268:ge,270:gm,275:ps,276:de,288:gh,292:gi,296:ki,300:gr,304:gl,
  308:gd,312:gp,316:gu,320:gt,324:gn,328:gy,332:ht,334:hm,336:va,340:hn,344:hk,348:hu,
  352:is,356:in,360:id,364:ir,368:iq,372:ie,376:il,380:it,384:ci,388:jm,392:jp,398:kz,
  400:jo,404:ke,408:kp,410:kr,414:kw,417:kg,418:la,422:lb,426:ls,428:lv,430:lr,434:ly,
  438:li,440:lt,442:lu,446:mo,450:mg,454:mw,458:my,462:mv,466:ml,470:mt,474:mq,478:mr,
  480:mu,484:mx,492:mc,496:mn,498:md,499:me,500:ms,504:ma,508:mz,512:om,516:na,520:nr,
  524:np,528:nl,531:cw,533:aw,534:sx,535:bq,540:nc,548:vu,554:nz,558:ni,562:ne,566:ng,
  570:nu,574:nf,578:no,580:mp,581:um,583:fm,584:mh,585:pw,586:pk,591:pa,598:pg,600:py,
  604:pe,608:ph,612:pn,616:pl,620:pt,624:gw,626:tl,630:pr,634:qa,638:re,642:ro,643:ru,
  646:rw,652:bl,654:sh,659:kn,660:ai,662:lc,663:mf,666:pm,670:vc,674:sm,678:st,682:sa,
  686:sn,688:rs,690:sc,694:sl,702:sg,703:sk,704:vn,705:si,706:so,710:za,716:zw,724:es,
  728:ss,729:sd,732:eh,740:sr,744:sj,748:sz,752:se,756:ch,760:sy,762:tj,764:th,768:tg,
  772:tk,776:to,780:tt,784:ae,788:tn,792:tr,795:tm,796:tc,798:tv,800:ug,804:ua,807:mk,
  818:eg,826:gb,831:gg,832:je,833:im,834:tz,840:us,850:vi,854:bf,858:uy,860:uz,862:ve,
  876:wf,882:ws,887:ye,894:zm
`.replace(/\s+/g, '').split(',').map(pair => pair.split(':')));
const flagFor = code =>
  (FLAGS.has(String(code)) ? `/assets/flags/${FLAGS.get(String(code))}.svg` : '');

const CSS = `
:host {
  /* verbatim from aredl.net's :root */
  --primary: 26, 100%, 50%;
  --primary-foreground: 26, 100%, 100%;
  --accent: 26, 100%, 45%;
  --secondary: 0, 0%, 15%;
  --secondary-light: 270, 1%, 38%;
  --secondary-foreground: 0, 0%, 100%;
  --background-light-transparent: 0, 0%, 100%, .03;
  --background-darker: 0, 0%, 0%, .25;
  --modal-background: 255, 7%, 11%, .95;
  --foreground: 0, 0%, 90%;
  --muted-foreground: 0, 0%, 60%;
  --border: 0, 0%, 25%;
  --destructive: 0, 100%, 50%;
  --ease: cubic-bezier(0.4, 0, 0.2, 1);

  all: initial;
  font-family: Poppins, sans-serif;
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--primary)) hsla(var(--background-light-transparent));
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; border: 0 solid hsl(var(--border)); }

/* ---- trigger: the site's primary button ---- */
.fab {
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 40px; padding: 8px 16px; border-radius: 6px;
  font-family: inherit; font-size: 16px; line-height: 24px; font-weight: 500;
  white-space: nowrap; cursor: pointer;
  background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground));
  transition: all .15s var(--ease);
}
.fab:hover { background-color: hsl(var(--accent)); transform: scale(1.05);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / .1), 0 4px 6px -4px rgb(0 0 0 / .1); }
.fab:active { transform: scale(0.98); }
.fab:focus-visible { outline: none; box-shadow: 0 0 0 2px hsl(var(--secondary)); }
.fab .badge {
  min-width: 20px; height: 20px; padding: 0 6px; border-radius: 9999px;
  display: inline-flex; align-items: center; justify-content: center;
  background-color: hsl(var(--primary-foreground)); color: hsl(var(--primary));
  font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;
}

/* ---- panel: the site's card, on the modal surface ---- */
.panel {
  position: fixed; right: 16px; bottom: 68px; z-index: 2147483000;
  width: 384px; max-height: min(76vh, 720px);
  display: flex; flex-direction: column;
  padding: 16px; border-radius: 12px;
  background-color: hsla(var(--modal-background));
  backdrop-filter: blur(8px);
  color: hsl(var(--foreground)); font-size: 16px; line-height: 24px;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / .5);
}
.panel[hidden] { display: none; }

.head { display: flex; align-items: center; gap: 8px; min-height: 36px; }
/* the player, laid out like the leaderboard's own row: avatar, flag, clan tag, name.
   the site uses 36px avatar / 32px flag there, scaled down a notch to sit in a header */
.who { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.who .pfp { width: 32px; height: 32px; flex: none; border-radius: 9999px; object-fit: cover;
  background-color: hsl(var(--secondary)); }
.who .flag { width: 28px; height: 28px; flex: none; object-fit: contain; }
.who .clan { flex: none; font-size: 14px; line-height: 22px; font-weight: 700;
  color: hsl(var(--secondary-light)); }
.who .name { min-width: 0; font-size: 16px; line-height: 22px; font-weight: 700;
  color: hsl(var(--secondary-foreground));
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.who .none { font-size: 14px; line-height: 22px; color: hsl(var(--secondary-light)); }
.iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 6px; flex: none;
  background-color: transparent; color: hsl(var(--secondary-light));
  cursor: pointer; transition: all .15s var(--ease);
}
.iconbtn:hover { background-color: hsl(var(--secondary)); color: hsl(var(--secondary-foreground)); }
.iconbtn:active { transform: scale(0.94); }
.iconbtn:focus-visible { outline: none; box-shadow: 0 0 0 2px hsl(var(--primary)); }
.iconbtn[disabled] { opacity: .35; pointer-events: none; }

.sep { height: 2px; width: 100%; margin: 16px 0; background-color: hsl(var(--border)); flex: none; }

/* ---- stats: the profile page's label + value pairing ---- */
.stats { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 8px; }
.stat .label { font-size: 10px; line-height: 14px; font-weight: 500; letter-spacing: .08em;
  text-transform: uppercase; color: hsl(var(--muted-foreground)); }
/* fixed height and baseline flex: the 12px delta has more half-leading than the
   20px number, so as plain inline text it grows the line box by 3px and shoves
   the whole bottom-anchored panel upwards the moment you toggle something */
.stat .value { margin-top: 2px; height: 26px; display: flex; align-items: baseline; gap: 6px;
  font-size: 20px; line-height: 26px; font-weight: 600;
  font-variant-numeric: tabular-nums; white-space: nowrap; }
.stat .delta { font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
.delta.up { color: hsl(var(--primary)); }
.delta.down { color: hsl(var(--destructive)); }
.value.pending { color: hsl(var(--secondary-light)); }

/* ---- search: the site's Search component ---- */
.search { display: flex; align-items: center; gap: 16px; padding: 8px;
  border-radius: 12px; background-color: hsla(var(--background-darker));
  transition: box-shadow .15s var(--ease); }
.search:focus-within { box-shadow: 0 0 0 2px hsl(var(--primary)); }
.search svg { flex: none; color: hsl(var(--secondary-light)); }
.search input {
  width: 100%; padding: 8px; background-color: transparent; outline: none;
  font-family: inherit; font-size: 18px; line-height: 24px; font-weight: 500;
  color: hsl(var(--foreground));
}
.search input::placeholder { color: hsl(var(--secondary-light)); }

/* ---- rows: copied from the /list level row ---- */
/* scrollbar-width doesn't inherit, so the scrolling element needs it itself */
.rows { margin-top: 12px; overflow-y: auto; overscroll-behavior: contain; flex: 1; min-height: 120px;
  padding-right: 2px; scrollbar-width: thin; }
.row {
  display: flex; width: 100%; align-items: center;
  padding: 6px; margin: 2px 0; border-radius: 6px;
  border-left: 8px solid transparent;
  background-color: hsla(var(--background-light-transparent));
  cursor: pointer; outline: none; text-align: left;
  color: hsl(var(--foreground)); font-family: inherit; font-size: 14px; line-height: 20px;
  transition: color .15s var(--ease), background-color .15s var(--ease), border-color .15s var(--ease);
}
.row:hover { background-color: hsl(var(--secondary-light)); }
.row:focus-visible { background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
.row.added { border-left-color: hsl(var(--primary)); }
.row.dropped { border-left-color: hsl(var(--destructive)); }
.row .pos { width: 64px; flex: none; text-align: center; font-size: 14px; line-height: 20px;
  font-variant-numeric: tabular-nums; color: hsl(var(--muted-foreground)); }
.row:hover .pos, .row:focus-visible .pos { color: inherit; }
.row .name { flex: 1; min-width: 0; font-size: 14px; line-height: 20px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row .pts { margin-left: 8px; font-size: 13px; line-height: 20px; font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground)); }
.row:hover .pts, .row:focus-visible .pts { color: inherit; }
.row .mark { margin-left: 8px; flex: none; display: flex; opacity: 0; transition: opacity .15s var(--ease); }
.row:hover .mark { opacity: .8; }
.row.beaten .mark { opacity: 1; color: hsl(var(--primary)); }
.row.beaten:hover .mark, .row.beaten:focus-visible .mark { color: inherit; }
.row.dropped .mark { opacity: .35; }

.note { padding: 24px 8px; text-align: center; font-size: 14px; line-height: 22px;
  color: hsl(var(--secondary-light)); }
.note b { color: hsl(var(--foreground)); font-weight: 500; }

@media (max-width: 640px) {
  .panel { left: 8px; right: 8px; bottom: 64px; width: auto; max-height: 72vh; }
  .fab { right: 8px; bottom: 8px; }
  .stats { grid-template-columns: 1fr 1fr; }
}
`;

/* ------------------------------------------------------------------ mount */
const host = document.createElement('div');
host.id = 'aredl-whatif';
const root = host.attachShadow({ mode: 'open' });
root.innerHTML = `
  <style>${CSS}</style>
  <button class="fab" type="button">What-If</button>
  <div class="panel" hidden>
    <div class="head">
      <div class="who"></div>
      <button class="iconbtn reset" type="button" aria-label="Clear all changes">${ICON.eraser}</button>
      <button class="iconbtn close" type="button" aria-label="Close">${ICON.x}</button>
    </div>
    <div class="sep"></div>
    <div class="stats"></div>
    <div class="sep"></div>
    <div class="search">${ICON.search}<input type="text" spellcheck="false" placeholder="Search"></div>
    <div class="rows"></div>
  </div>`;

/* The content script runs at document_start, so <body> may not exist yet. */
const mount = () => document.body.appendChild(host);
if (document.body) mount();
else document.addEventListener('DOMContentLoaded', mount, { once: true });

const $ = s => root.querySelector(s);
const fab = $('.fab'), panel = $('.panel'), rows = $('.rows'), stats = $('.stats'),
      input = $('.search input'), who = $('.who'), btnReset = $('.reset');

/* --------------------------------------------------------------- helpers */
const pts  = n => (n / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const sign = n => (n > 0 ? '+' : '') + n.toLocaleString('en-US');
const ESC  = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc  = s => String(s).replace(/[&<>"]/g, c => ESC[c]);

function statTile(label, value, delta, pending) {
  const d = delta ? `<span class="delta ${delta.startsWith('-') ? 'down' : 'up'}">${delta}</span>` : '';
  return `<div class="stat"><p class="label">${label}</p>`
       + `<p class="value${pending ? ' pending' : ''}">${value}${d}</p></div>`;
}

/* ---------------------------------------------------------------- render */
let query = '';

function renderStats() {
  const c = WI.current, s = WI.session;
  if (!c) { stats.innerHTML = ''; return; }
  const dPts = c.after.total - c.before.total;
  const dExt = c.after.extremes - c.before.extremes;
  const rank = s.ranks ? (s.ranksExact ? '' : '~') + '#' + s.ranks.rank.toLocaleString('en-US') : '–';
  stats.innerHTML =
      statTile('Total points', pts(c.after.total), dPts ? (dPts > 0 ? '+' : '') + pts(dPts) : '')
    + statTile('Points rank', rank, '', !s.ranksExact)
    + statTile('Extremes', c.after.extremes.toLocaleString('en-US'), dExt ? sign(dExt) : '');
}

const rowClass = id => {
  const beaten = WI.isBeaten(id);
  return 'row' + (beaten ? ' beaten' : '') + (WI.changed(id) ? (beaten ? ' added' : ' dropped') : '');
};

/* The visible list is rebuilt only when the search or the player changes, never
 * on a toggle, otherwise clicking a row would reorder the list and reset the
 * scroll position under the pointer. Toggling just restyles the row in place. */
let viewKey = null;

function buildRows() {
  if (!WI.data.loaded) { rows.innerHTML = `<p class="note">Loading the list…</p>`; return; }
  if (!WI.session.loaded) {
    rows.innerHTML = `<p class="note">Open any <b>profile</b> on AREDL and it will load here.</p>`;
    return;
  }
  const list = WI.search(query);
  if (!list.length) { rows.innerHTML = `<p class="note">No level matches "${esc(query)}".</p>`; return; }
  rows.innerHTML = list.map(l =>
      `<button class="${rowClass(l.id)}" type="button" data-id="${l.id}">`
    + `<span class="pos">#${l.position}</span>`
    + `<span class="name">${esc(l.name)}</span>`
    + `<span class="pts">${pts(l.points)}</span>`
    + `<span class="mark">${ICON.check}</span></button>`).join('');
  rows.scrollTop = 0;
}

function syncRows() {
  for (const el of rows.querySelectorAll('.row')) el.className = rowClass(el.dataset.id);
}

function renderWho() {
  const s = WI.session;
  if (!s.loaded) { who.innerHTML = '<span class="none">No profile loaded</span>'; return; }
  const flag = flagFor(s.country);
  who.innerHTML =
      /* an <img> with src="" refetches the page in some browsers, so fall back to a plain circle */
      (s.avatar ? `<img class="pfp" src="${esc(s.avatar)}" alt="">` : '<span class="pfp"></span>')
    + (flag ? `<img class="flag" src="${flag}" alt="">` : '')
    + (s.clanTag ? `<span class="clan">[${esc(s.clanTag)}]</span>` : '')
    + `<span class="name">${esc(s.globalName || s.username)}</span>`;
}

function render() {
  const n = WI.count;
  fab.innerHTML = 'What-If' + (n ? `<span class="badge">${n}</span>` : '');
  btnReset.disabled = !n;
  renderWho();
  if (panel.hidden) return;
  renderStats();
  const key = `${query}|${WI.session.username}|${WI.data.loaded}|${WI.session.loaded}`;
  if (key !== viewKey) { viewKey = key; buildRows(); } else syncRows();
}

/* ------------------------------------------------------------ interaction */
fab.addEventListener('click', () => {
  panel.hidden = !panel.hidden;
  /* reopening is a natural moment to re-sort, unlike mid-click */
  if (!panel.hidden) { viewKey = null; render(); input.focus(); }
});
$('.close').addEventListener('click', () => { panel.hidden = true; });
btnReset.addEventListener('click', () => { viewKey = null; WI.reset(); });

let typing;
input.addEventListener('input', () => {
  clearTimeout(typing);
  typing = setTimeout(() => { query = input.value; render(); }, 80);
});

rows.addEventListener('click', e => {
  const row = e.target.closest('.row');
  if (row) WI.toggle(row.dataset.id);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !panel.hidden) { panel.hidden = true; fab.focus(); }
});

WI.subscribe(render);
render();
})();
