// Builds index.html from content/<lang>.json.
//
//   node build.mjs        -> ./index.html      (English)
//   node build.mjs ar     -> ./ar/index.html   (needs content/ar.json with "dir": "rtl")
//
// Every build also refreshes ./dist/, a clean copy of only the public files.
// Deploy ./dist/ to Netlify (drag it onto https://app.netlify.com/drop, or let
// netlify.toml run this build).
//
// Edit copy and chart data in content/*.json, then run the build again.
// The page is rendered to static HTML so it reads fully without JavaScript;
// script.js only adds the scroll-driven chart states on top.

import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';

const lang = process.argv[2] || 'en';
const c = JSON.parse(await readFile(new URL(`./content/${lang}.json`, import.meta.url), 'utf8'));
const outDir = lang === 'en' ? '.' : lang;
const base = lang === 'en' ? '' : '../';

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// Minimal inline markup: **bold** only.
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const plain = (s) => String(s ?? '').replace(/\*\*(.+?)\*\*/g, '$1');

// Visible text plus an optional screen-reader wording (e.g. "~$7bn" -> "around 7 billion dollars").
const spoken = (display, sr) =>
  sr ? `<span aria-hidden="true">${esc(display)}</span><span class="sr-only">${esc(sr)}</span>` : esc(display);

const pct = (v, max) => +(Math.min(v / max, 1)).toFixed(4);
const from = (n) => (n ? ` data-from="${n}"` : '');

const draftTag = () => `<span class="tag tag--draft">${esc(c.ui.draftTag)}</span>`;

// ---------- chart panels ----------
const panels = {
  bars(p) {
    const rows = p.items
      .map(
        (it) => `
        <li class="bar-row${it.draft ? ' is-draft' : ''}"${from(it.from)} style="--v:${pct(it.value, p.max)}">
          <span class="bar-row__label">${esc(it.label)}</span>
          <span class="bar-row__track">
            <span class="bar-row__fill" aria-hidden="true"></span>
            <span class="bar-row__value">${spoken(it.display, it.sr)}</span>
          </span>
        </li>`
      )
      .join('');
    return `<ul class="bars" role="list">${rows}</ul>`;
  },

  slope(p) {
    const y = (v) => +(100 - (v / p.max) * 100).toFixed(2);
    const lines = p.series
      .map(
        (s) =>
          `<line class="slope__line tone-${s.tone}"${from(s.from)} x1="0" y1="${y(s.values[0])}" x2="100" y2="${y(s.values[1])}" pathLength="1" vector-effect="non-scaling-stroke" />`
      )
      .join('');
    const dots = p.series
      .map((s) =>
        s.values
          .map(
            (v, i) =>
              `<span class="slope__dot tone-${s.tone}"${from(s.from)} style="--y:${y(v)};--x:${i * 100}" aria-hidden="true"></span>`
          )
          .join('')
      )
      .join('');
    const startLabels = p.series
      .map(
        (s) =>
          `<li class="slope__lbl tone-${s.tone}"${from(s.from)} style="--y:${y(s.values[0])}"><span class="sr-only">${esc(s.label)}, ${esc(p.years[0])}: </span>${esc(s.display[0])}</li>`
      )
      .join('');
    const endLabels = p.series
      .map(
        (s) =>
          `<li class="slope__lbl tone-${s.tone}"${from(s.from)} style="--y:${y(s.values[1])}"><span class="sr-only">${esc(p.years[1])}: </span><strong>${esc(s.display[1])}</strong> <span class="slope__name">${esc(s.label)}</span></li>`
      )
      .join('');
    return `
      <div class="slope">
        <div class="slope__years" aria-hidden="true"><span>${esc(p.years[0])}</span><span>${esc(p.years[1])}</span></div>
        <div class="slope__body">
          <ul class="slope__labels slope__labels--start" role="list">${startLabels}</ul>
          <div class="slope__plot" aria-hidden="true">
            <svg class="slope__svg" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">${lines}</svg>
            ${dots}
          </div>
          <ul class="slope__labels slope__labels--end" role="list">${endLabels}</ul>
        </div>
      </div>`;
  },

  share(p) {
    let acc = 0;
    const segs = p.segments
      .map((s) => {
        const start = acc;
        acc += s.value;
        return `<span class="share__seg tone-${s.tone}${s.atLeast ? ' is-atleast' : ''}" style="--start:${start / 100};--v:${s.value / 100}"></span>`;
      })
      .join('');
    acc = 0;
    const labels = p.segments
      .map((s) => {
        const start = acc;
        acc += s.value;
        return `<li class="share__label tone-${s.tone}" style="--start:${start / 100}"><span class="swatch" aria-hidden="true"></span>${esc(s.label)}</li>`;
      })
      .join('');
    const ticks = (p.ticks || [])
      .map((t) => `<span class="share__tick" style="--at:${t / 100}">${t}%</span>`)
      .join('');
    return `
      <div class="share">
        <p class="share__headline"><strong>${spoken(p.headline, p.headlineSr)}</strong> <span>${esc(p.denominator)}</span></p>
        <div class="share__track" aria-hidden="true">${segs}</div>
        <div class="share__axis" aria-hidden="true"><span class="share__tick share__tick--start">0%</span>${ticks}${(p.ticks || []).some((t) => t > 85) ? '' : '<span class="share__tick share__tick--end">100%</span>'}</div>
        <ul class="share__labels" role="list">${labels}</ul>
      </div>`;
  },

  waffle(p) {
    const cells = Array.from(
      { length: 100 },
      (_, i) => `<span class="waffle__cell${i < p.value ? ' is-on' : ''}" style="--i:${i}"></span>`
    ).join('');
    return `
      <div class="waffle-wrap">
        <p class="share__headline"><strong>${spoken(p.headline, p.headlineSr)}</strong> <span>${esc(p.denominator)}</span></p>
        <div class="waffle" aria-hidden="true">${cells}</div>
        <ul class="share__labels share__labels--static" role="list">
          <li class="share__label tone-accent"><span class="swatch" aria-hidden="true"></span>${esc(p.legend[0])}</li>
          <li class="share__label tone-rest"><span class="swatch" aria-hidden="true"></span>${esc(p.legend[1])}</li>
        </ul>
      </div>`;
  },

  stat(p) {
    return `
      <p class="stat"><strong class="stat__value">${spoken(p.value, p.sr)}</strong> <span class="stat__label">${esc(p.label)}</span></p>`;
  },

  increase(p) {
    const s = p.scale;
    return `
      <div class="increase">
        <p class="stat">
          <span class="stat__qualifier">${esc(p.qualifier)}</span>
          <strong class="stat__value stat__value--up"><span class="stat__arrow" aria-hidden="true"></span>${spoken(p.value, p.sr)}</strong>
          <span class="stat__label">${esc(p.label)}</span>
        </p>
        <div class="scale-strip" style="--v:${s.part / s.whole}" aria-hidden="true">
          <span class="scale-strip__whole"></span><span class="scale-strip__part"></span>
        </div>
        <ul class="share__labels share__labels--static" role="list">
          <li class="share__label tone-accent"><span class="swatch" aria-hidden="true"></span>${esc(s.partLabel)}</li>
          <li class="share__label tone-rest"><span class="swatch" aria-hidden="true"></span>${esc(s.wholeLabel)}</li>
        </ul>
      </div>`;
  },

  note(p) {
    return `<p class="chart-note">${md(p.text)}</p>`;
  },

  unresolved(p) {
    return `
      <div class="unresolved">
        <p class="unresolved__title">${esc(p.title)}</p>
        <p class="unresolved__text">${esc(p.text)}</p>
      </div>`;
  },
};

const source = (id) => {
  const s = c.sources[id];
  if (!s) return '';
  const body = s.url ? `<a href="${esc(s.url)}">${esc(s.text)}</a>` : esc(s.text);
  return `<p class="scene__source"><span>${esc(c.ui.source)}:</span> ${body}</p>`;
};

// A scene is one visual. It is rendered twice: inside each step (inline, mobile / no-JS)
// and once inside the sticky graphic column (desktop with JS).
function scene(id, reveal, inline = false) {
  const s = c.scenes[id];
  if (!s) throw new Error(`Unknown scene "${id}"`);
  // "inlineOnlyNew": on narrow screens each step shows only the panel its text introduces.
  // Inline figures never show elements beyond their step, so drop those instead of leaving gaps.
  const upTo = (x) => !x.from || x.from <= reveal;
  const list = !inline
    ? s.panels
    : s.panels
        .filter((p) => upTo(p) && (!s.inlineOnlyNew || !p.from || p.from === reveal))
        .map((p) => ({
          ...p,
          ...(p.items && { items: p.items.filter(upTo) }),
          ...(p.series && { series: p.series.filter(upTo) }),
        }));
  const body = list
    .map((p) => {
      const r = panels[p.type];
      if (!r) throw new Error(`Unknown panel type "${p.type}" in scene "${id}"`);
      return `<div class="panel panel--${p.type}"${from(p.from)}>${r(p)}</div>`;
    })
    .join('');
  return `
    <div class="scene" data-scene="${esc(id)}" data-reveal="${reveal}">
      <div class="scene__head">
        <p class="scene__title">${esc(s.title)}${s.draft ? ' ' + draftTag() : ''}</p>
        <p class="scene__unit">${esc(s.unit)}${s.scaleNote ? ` · <em>${esc(c.ui.differentScale)}</em>` : ''}</p>
      </div>
      <div class="scene__body">${body}</div>
      ${source(s.source)}
    </div>`;
}

// ---------- chapters ----------
// Full-screen title card that opens each chapter.
const opener = (ch) => `
    <header class="opener">
      <div class="opener__inner">
        <p class="opener__num"><span class="sr-only">${esc(c.ui.chapterLabel)} </span>${esc(ch.num)}</p>
        <h2 class="opener__title" id="${esc(ch.id)}-title">${esc(ch.title)}</h2>
        ${ch.teaser ? `<p class="opener__teaser">${md(ch.teaser)}</p>` : ''}
      </div>
    </header>`;
function chapter(ch) {
  // The last step that shows a scene carries that scene's text equivalent.
  const lastIndexOf = {};
  ch.steps.forEach((st, i) => (lastIndexOf[st.scene] = i));

  const steps = ch.steps
    .map((st, i) => {
      const sc = c.scenes[st.scene];
      const isLast = lastIndexOf[st.scene] === i;
      return `
      <div class="step" data-scene="${esc(st.scene)}" data-reveal="${st.reveal}">
        <div class="step__text">${st.text.map((t) => `<p>${md(t)}</p>`).join('')}</div>
        <figure class="step__figure" aria-label="${esc(sc.title)}">${scene(st.scene, st.reveal, true)}</figure>
        ${
          isLast
            ? `<details class="step__alt"><summary>${esc(c.ui.textEquivalent)}: ${esc(sc.title)}</summary><p>${esc(sc.summary)}</p></details>`
            : ''
        }
      </div>`;
    })
    .join('');

  const sceneIds = [...new Set(ch.steps.map((s) => s.scene))];
  const graphic = sceneIds.map((id, i) => scene(id, 0).replace('class="scene"', `class="scene${i === 0 ? ' is-active' : ''}"`)).join('');

  return `
  <section class="chapter" id="${esc(ch.id)}" aria-labelledby="${esc(ch.id)}-title" data-num="${esc(ch.num)}" data-title="${esc(ch.title)}">
    ${opener(ch)}
    <div class="scrolly">
      <div class="scrolly__steps">${steps}</div>
      <div class="scrolly__graphic" aria-hidden="true"><div class="scrolly__frame">${graphic}</div></div>
    </div>
  </section>`;
}

const q = c.questions;
const questions = `
  <section class="chapter chapter--questions" id="${esc(q.id)}" aria-labelledby="${esc(q.id)}-title" data-num="${esc(q.num)}" data-title="${esc(q.title)}">
    ${opener(q)}
    <p class="questions__intro" data-appear>${md(q.intro)}</p>
    <ol class="questions" role="list">
      ${q.items.map((t, i) => `<li class="question" data-appear><span class="question__num" aria-hidden="true">${i + 1}</span><span class="question__text">${md(t)}</span></li>`).join('')}
    </ol>
  </section>`;

const pr = c.prologue;
const prologue = pr
  ? `
  <section class="prologue" aria-label="${esc(pr.label)}">
    ${pr.lines.map((l, i) => `<p class="prologue__line${i === pr.lines.length - 1 ? ' prologue__line--last' : ''}" data-appear><span>${md(l)}</span></p>`).join('')}
  </section>`
  : '';

const cl = c.closing;
const closing = cl
  ? `
  <section class="closing" aria-labelledby="closing-title">
    <div class="closing__inner">
      <p class="closing__kicker">${esc(cl.kicker)}</p>
      <h2 class="closing__title" id="closing-title" data-appear>${esc(cl.title)}</h2>
      <p class="closing__text">${md(cl.text)}</p>
    </div>
  </section>`
  : '';

const pu = c.purpose;
const purpose = `
  <section class="purpose" id="${esc(pu.id)}" aria-labelledby="${esc(pu.id)}-title">
    <div class="purpose__inner">
      <h2 class="purpose__title" id="${esc(pu.id)}-title">${esc(pu.title)}</h2>
      <p class="purpose__intro">${md(pu.intro)}</p>
      <ol class="purpose__list" role="list">
        ${pu.items.map((it, i) => `<li data-appear><span class="purpose__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h3>${esc(it.title)}</h3><p>${md(it.text)}</p></li>`).join('')}
      </ol>
    </div>
  </section>`;

const allChapters = [...c.chapters, q];
const toc = `
  <nav class="toc" aria-label="${esc(c.ui.contents)}">
    <p class="toc__title">${esc(c.ui.contents)}</p>
    <ol role="list">
      ${allChapters.map((ch) => `<li><a href="#${esc(ch.id)}"><span aria-hidden="true">${esc(ch.num)}</span> ${esc(ch.title)}</a></li>`).join('')}
    </ol>
  </nav>`;

const logo = (await readFile(new URL('./assets/tpi-logo.svg', import.meta.url), 'utf8'))
  .trim()
  .replace('<svg ', `<svg class="logo" focusable="false" `);

const html = `<!doctype html>
<html lang="${esc(c.lang)}" dir="${esc(c.dir)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.meta.title)}</title>
<meta name="description" content="${esc(c.meta.description)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(c.meta.shareTitle)}">
<meta property="og:description" content="${esc(c.meta.description)}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#1b2b4b">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${base}assets/fonts/montserrat-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${base}assets/fonts/montserrat-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}styles.css">
<script>document.documentElement.classList.add('js')</script>
<script src="${base}script.js" defer></script>
</head>
<body>
<a class="skip-link" href="#story">${esc(c.ui.skip)}</a>
<div class="progress" aria-hidden="true"><span class="progress__bar"></span></div>
<div class="chapter-bar" aria-hidden="true"><span class="chapter-bar__num"></span><span class="chapter-bar__title"></span></div>

<header class="cover" id="top">
  <div class="cover__inner">
    ${logo}
    <p class="cover__label">${esc(c.cover.label)}</p>
    <h1 class="cover__title">${esc(c.cover.title)}</h1>
    <p class="cover__hook">${md(c.cover.hook)}</p>
    <p class="cover__dateline">${esc(c.cover.dateline)}</p>
    ${toc}
    <a class="cover__cue" href="#story">${esc(c.ui.scrollCue)}<span aria-hidden="true" class="cover__cue-arrow"></span></a>
  </div>
</header>

<main id="story" tabindex="-1">
${prologue}
${c.chapters.map(chapter).join('\n')}
${questions}
${purpose}
${closing}
</main>

<footer class="footer">
  <div class="footer__inner">
    <p class="footer__org">${logo}</p>
    <p><a href="#top">${esc(c.ui.backToTop)}</a></p>
  </div>
</footer>
</body>
</html>
`;

await mkdir(new URL(`./${outDir}/`, import.meta.url), { recursive: true });
await writeFile(new URL(`./${outDir}/index.html`, import.meta.url), html);
console.log(`Built ${outDir}/index.html (${(html.length / 1024).toFixed(1)} KB)`);

// ---------- dist/: public files only, ready for Netlify ----------
const dist = new URL('./dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const f of ['index.html', 'styles.css', 'script.js', 'assets']) {
  await cp(new URL(`./${f}`, import.meta.url), new URL(`./${f}`, dist), { recursive: true });
}
for (const l of ['ar']) {
  await cp(new URL(`./${l}/`, import.meta.url), new URL(`./${l}/`, dist), { recursive: true }).catch(() => {});
}
// GitHub Pages: serve files as-is (no Jekyll processing).
await writeFile(new URL('./.nojekyll', dist), '');
console.log('Refreshed dist/ (deploy this folder)');
