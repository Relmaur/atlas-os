// Writes the Updates pages and the feed from the update files. Plain strings, run at build time (vite.config.ts): the
// pages are complete HTML with no script needed. Addresses are absolute, since these pages live at different depths.
import { escapeHtml as e } from '@atlas/core/util';
import { type Update } from '@atlas/core/updates';

export const SITE = 'https://atlas-os.cloud';
const CHANGELOG = 'https://github.com/Relmaur/nms-os/blob/main/CHANGELOG.md';
const REPO = 'https://github.com/Relmaur/nms-os';
const ICONS: Record<Update['highlights'][number]['icon'], string> = {
  map: '◎',
  card: '✦',
  runs: '↻',
  codex: '❖',
  log: '◇',
  timers: '◷'
};
export const updateUrl = (update: Update) => `${SITE}/updates/${update.slug}/`;
const shareImage = (update: Update) => `${SITE}/banners/${update.banner ?? update.share ?? ''}`;
const when = (update: Update) =>
  update.dateLabel ??
  new Date(`${update.date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });

// The app's star mark, small: gold with a dashed outer ring for the newest, cyan for the rest.
const star = (latest: boolean) =>
  latest
    ? '<svg viewBox="-22 -22 44 44"><circle r="19" fill="none" stroke="#fcd34d" stroke-opacity=".2" stroke-dasharray="3 4"/><circle r="14" fill="none" stroke="#fcd34d" stroke-opacity=".38"/><circle r="10" fill="none" stroke="#fcd34d" stroke-opacity=".6"/><circle r="7" fill="#fcd34d"/><circle r="4.2" fill="#fff7d6" fill-opacity=".9"/></svg>'
    : '<svg viewBox="-22 -22 44 44"><circle r="14" fill="none" stroke="#67e8f9" stroke-opacity=".35"/><circle r="10" fill="none" stroke="#67e8f9" stroke-opacity=".55"/><circle r="7" fill="#67e8f9"/><circle r="4.2" fill="#ecfeff" fill-opacity=".9"/></svg>';

function article(update: Update, latest: boolean, heading: 'h1' | 'h2') {
  const inner = heading === 'h1' ? 'h2' : 'h3';
  const also = update.also.length
    ? `<details><summary>Also in this update</summary><ul>${update.also.map(line => `<li>${e(line)}</li>`).join('')}</ul></details>`
    : '';
  const notes = update.notes
    .map(note => `<details><summary>${e(note.title)}</summary><ul><li>${e(note.text)}</li></ul></details>`)
    .join('');
  return `<article class="rel${latest ? '' : ' past'}" id="${e(update.slug)}">
  <div class="node" aria-hidden="true">${star(latest)}</div>
  <div class="card">
    <div class="card-top">
      <div class="meta"><span class="ver">${e(update.chip ?? update.versions)}</span><span class="mono">${e(when(update))}</span>${latest ? '<span class="latest">Latest</span>' : ''}</div>
      <${heading} class="update-name"><a href="/updates/${e(update.slug)}/">${e(update.name)}</a></${heading}>
      <p class="lede">${e(update.lede)}</p>
    </div>
    ${
      update.banner
        ? `<figure class="banner-fig"><img src="/banners/${e(update.banner)}" alt="${e(update.alt)}" width="1600" height="800" loading="lazy" decoding="async">${update.caption ? `<figcaption>${e(update.caption)}</figcaption>` : ''}</figure>`
        : ''
    }
    <div class="hl">${update.highlights
      .map(
        item =>
          `<div class="h"><i class="i-${item.icon}" aria-hidden="true">${ICONS[item.icon]}</i><div><${inner} class="h-title">${e(item.title)}</${inner}><p>${e(item.text)}</p></div></div>`
      )
      .join('')}</div>
    ${also || notes ? `<div class="also">${also}${notes}</div>` : ''}
    <div class="foot"><span>Covers versions ${e(update.coversFrom)} to ${e(update.coversTo)}</span><div class="acts"><button type="button" class="btn btn-g btn-sm" data-copy="${e(updateUrl(update))}">Copy link</button><a class="btn btn-g btn-sm" href="${CHANGELOG}" target="_blank" rel="noopener">Changelog</a></div></div>
  </div>
</article>`;
}

function page(
  head: { title: string; description: string; url: string; image: string | undefined; type: string },
  assets: string,
  body: string
) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(head.title)}</title>
<meta name="description" content="${e(head.description)}">
<meta name="theme-color" content="#04070f">
<link rel="canonical" href="${e(head.url)}">
<link rel="alternate" type="application/atom+xml" title="ATLAS:OS updates" href="/updates.xml">
<link rel="icon" href="/app/assets/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/app/assets/icons/apple-touch-icon.png">
<meta property="og:site_name" content="ATLAS:OS for No Man's Sky">
<meta property="og:type" content="${head.type}">
<meta property="og:title" content="${e(head.title)}">
<meta property="og:description" content="${e(head.description)}">
<meta property="og:url" content="${e(head.url)}">
${
  head.image
    ? `<meta property="og:image" content="${e(head.image)}">
<meta property="og:image:width" content="1600">
<meta property="og:image:height" content="800">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(head.title)}">
<meta name="twitter:description" content="${e(head.description)}">
<meta name="twitter:image" content="${e(head.image)}">`
    : ''
}
${assets}
</head>
<body class="updates">
<canvas id="sky" aria-hidden="true"></canvas>
<header class="nav solid" id="nav">
  <div class="wrap">
    <a class="wm" href="/">ATLAS<i>:</i>OS</a>
    <nav class="nav-links" aria-label="Site"><a href="/#inside">Inside</a><a href="/#card">Traveller Card</a><a href="/#yours">Privacy</a><a href="/updates/" aria-current="page">Updates</a><a href="/#install">Install</a></nav>
    <a class="btn btn-p btn-sm" href="/app/">Open ATLAS</a>
  </div>
</header>
${body}
<footer>
  <div class="wrap">
    <div class="credit"><b>ATLAS:OS</b> · Fan-made. Not affiliated with Hello Games.<br>Built on the No Man's Sky wiki, credited on every page (CC BY-NC-SA 3.0).</div>
    <div class="links"><a href="/">Home</a><a href="/updates/">Updates</a><a href="${REPO}" target="_blank" rel="noopener">Open source on GitHub</a><a href="/#yours">Privacy</a><a href="mailto:hello@atlas-os.cloud">Contact</a></div>
  </div>
</footer>
</body>
</html>
`;
}

// `updates` is newest first. `assets` is the page's stylesheet and script tags, which differ between dev and build.
export function renderList(updates: Update[], assets: string) {
  return page(
    {
      title: "What's new in ATLAS:OS for No Man's Sky",
      description:
        "Every update, in plain words: what's new for your travels, what changed, and what got fixed. Newest first.",
      url: `${SITE}/updates/`,
      image: updates[0] ? shareImage(updates[0]) : undefined,
      type: 'website'
    },
    assets,
    `<main class="wrap">
  <section class="head">
    <p class="eyebrow">Updates</p>
    <h1>What's new in ATLAS:OS</h1>
    <p>Every update, in plain words: what's new for your travels, what changed, and what got fixed. Newest first.</p>
    <div class="subs">
      <a class="btn btn-g btn-sm" href="/updates.xml">RSS feed</a>
      <a class="btn btn-g btn-sm" href="${CHANGELOG}" target="_blank" rel="noopener">Full changelog on GitHub</a>
      <small>ATLAS also tells you once, inside the app, when an update arrives. No email list, no account.</small>
    </div>
  </section>
  <section class="log" aria-label="Updates, newest first">
${updates.map((update, i) => article(update, i === 0, 'h2')).join('\n')}
  </section>
</main>`
  );
}

export function renderUpdate(update: Update, latest: boolean, assets: string) {
  return page(
    {
      title: `ATLAS:OS · ${update.name}`,
      description: update.lede,
      url: updateUrl(update),
      image: shareImage(update),
      type: 'article'
    },
    assets,
    `<main class="wrap single">
  <p class="back"><a href="/updates/">‹ All updates</a></p>
  <section class="log" aria-label="${e(update.name)}">
${article(update, latest, 'h1')}
  </section>
</main>`
  );
}

const x = (text: string) => e(text);
export function renderFeed(updates: Update[]) {
  const stamp = (update: Update) => `${update.date}T00:00:00Z`;
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>ATLAS:OS updates</title>
  <subtitle>What's new in ATLAS:OS for No Man's Sky</subtitle>
  <link href="${SITE}/updates/"/>
  <link rel="self" href="${SITE}/updates.xml"/>
  <id>${SITE}/updates/</id>
  <updated>${updates[0] ? stamp(updates[0]) : '2026-10-31T00:00:00Z'}</updated>
  <author><name>ATLAS:OS</name></author>
${updates
  .map(
    update => `  <entry>
    <title>${x(update.name)} (${x(update.chip ?? update.versions)})</title>
    <link href="${updateUrl(update)}"/>
    <id>${updateUrl(update)}</id>
    <updated>${stamp(update)}</updated>
    <summary>${x(update.lede)}</summary>
  </entry>`
  )
  .join('\n')}
</feed>
`;
}
