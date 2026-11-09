// Draws the shared pictures on a canvas (designs 24 and 25). The preview is this same canvas, so what the player sees
// is what they save. A canvas rather than an SVG image: an SVG drawn into a canvas can't reach the page's fonts.
import type { ArtGroup, CardArt, CollectionCard } from '@atlas/core/collectible';
import { groupAddress } from '@atlas/core/collectible';
import type { Frontier } from '@atlas/core/frontier';
import { orbitLayout, type OrbitPlanet } from '@atlas/core/orbit';
import {
  FAN_LINE,
  SHARE_FORMATS,
  SHARE_SITE,
  type FleetCard,
  type Postcard,
  type ShareFormat
} from '@atlas/core/share';
import { Rng, seedOf } from '@atlas/core/seed';
import { sporeDots } from '../parts/spores.ts';
import { RACES, STAR_CLASSES, type StarClass } from '@atlas/core/systems-model';

const DISPLAY = 'Orbitron, sans-serif';
const BODY = 'Inter, sans-serif';
const MONO = '"JetBrains Mono", monospace';
const INK = '#e2e8f0';
const MUTED = '#94a3b8';
const LABEL = '#8b9ab0';
const CYAN = '#67e8f9';
const GOLD = '#fde68a';
const FOIL = ['#67e8f9', '#a5b4fc', '#f0abfc', '#fde68a', '#67e8f9', '#c4b5fd'];
const UNLOGGED_STAR = '#64748b';

const token = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/** The fonts must be loaded before the first draw, or the canvas quietly uses a fallback. */
export async function loadShareFonts(): Promise<void> {
  await Promise.allSettled(
    [
      `900 40px ${DISPLAY}`,
      `800 22px ${DISPLAY}`,
      `400 20px ${BODY}`,
      `600 20px ${BODY}`,
      `700 20px ${BODY}`,
      `400 20px ${MONO}`,
      `500 20px ${MONO}`
    ].map(font => document.fonts.load(font, 'ATLAS:OS ★ ημ'))
  );
}

interface Text {
  font: string;
  colour: string;
  align?: CanvasTextAlign;
  spacing?: number;
}
function put(c: CanvasRenderingContext2D, value: string, x: number, y: number, { font, colour, align, spacing }: Text) {
  c.font = font;
  c.fillStyle = colour;
  c.textAlign = align ?? 'left';
  c.letterSpacing = `${String(spacing ?? 0)}px`; // ignored where a browser doesn't have it yet
  c.fillText(value, x, y);
  c.letterSpacing = '0px';
}

function wrap(c: CanvasRenderingContext2D, value: string, font: string, width: number, max: number): string[] {
  c.font = font;
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    const kept = lines.slice(0, max);
    kept[max - 1] = `${kept[max - 1] ?? ''}…`;
    return kept;
  }
  return lines;
}

const foil = (c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  const gradient = c.createLinearGradient(x1, y1, x2, y2);
  FOIL.forEach((colour, i) => {
    gradient.addColorStop(i / (FOIL.length - 1), colour);
  });
  return gradient;
};

// A fine film grain, from the same seeded noise on every device. An overlay rather than a filter, which Safari's
// canvas doesn't have.
function grain(c: CanvasRenderingContext2D, W: number, H: number, seed: string) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 160;
  const t = tile.getContext('2d');
  if (!t) return;
  const noise = t.createImageData(160, 160);
  const rng = new Rng(seedOf('grain', seed));
  for (let i = 0; i < noise.data.length; i += 4) {
    const v = Math.floor(rng.range(0, 256));
    noise.data[i] = noise.data[i + 1] = noise.data[i + 2] = v;
    noise.data[i + 3] = 255;
  }
  t.putImageData(noise, 0, 0);
  const pattern = c.createPattern(tile, 'repeat');
  if (!pattern) return;
  c.save();
  c.globalAlpha = 0.07;
  c.globalCompositeOperation = 'overlay';
  c.fillStyle = pattern;
  c.fillRect(0, 0, W, H);
  c.restore();
}

// The frame every picture shares: the night gradient, a thin gold line, corner ticks, the wordmark and its foil rule.
function frame(c: CanvasRenderingContext2D, W: number, H: number) {
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a1120');
  sky.addColorStop(0.6, '#050811');
  sky.addColorStop(1, '#070b17');
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
}
function chrome(c: CanvasRenderingContext2D, W: number, H: number, u: number, title: string) {
  const inset = 28 * u;
  c.strokeStyle = 'rgba(252,211,77,0.28)';
  c.lineWidth = 2 * u;
  c.beginPath();
  c.roundRect(inset, inset, W - inset * 2, H - inset * 2, 40 * u);
  c.stroke();
  c.strokeStyle = 'rgba(252,211,77,0.7)';
  const a = 20 * u;
  const b = 44 * u;
  for (const [x, y, dx, dy] of [
    [a, a, 1, 1],
    [W - a, a, -1, 1],
    [a, H - a, 1, -1],
    [W - a, H - a, -1, -1]
  ] as const) {
    c.beginPath();
    c.moveTo(x + dx * (b - a), y);
    c.lineTo(x, y);
    c.lineTo(x, y + dy * (b - a));
    c.stroke();
  }
  const left = 68 * u;
  const top = 82 * u;
  c.strokeStyle = '#22d3ee';
  c.lineWidth = 4 * u;
  const d = 11 * u;
  c.beginPath();
  c.moveTo(left + d, top - d * 1.1);
  c.lineTo(left + d * 2, top);
  c.lineTo(left + d, top + d * 1.1);
  c.lineTo(left, top);
  c.closePath();
  c.stroke();
  const mark = `800 ${String(22 * u)}px ${DISPLAY}`;
  c.font = mark;
  c.letterSpacing = `${String(5.7 * u)}px`;
  const atlas = c.measureText('ATLAS').width;
  c.letterSpacing = '0px';
  c.textBaseline = 'middle';
  put(c, 'ATLAS', left + 42 * u, top, { font: mark, colour: '#fff', spacing: 5.7 * u });
  put(c, ':OS', left + 42 * u + atlas, top, { font: mark, colour: CYAN, spacing: 5.7 * u });
  put(c, title, W - left, top, {
    font: `500 ${String(19 * u)}px ${MONO}`,
    colour: LABEL,
    align: 'right',
    spacing: 2.7 * u
  });
  c.textBaseline = 'alphabetic';
  c.save();
  c.globalAlpha = 0.55;
  c.fillStyle = foil(c, left, 0, W - left, 0);
  c.fillRect(left, 120 * u, W - left * 2, 2 * u);
  c.restore();
}
function footer(c: CanvasRenderingContext2D, W: number, H: number, u: number, line: string) {
  const left = 68 * u;
  const font = `400 ${String(18 * u)}px ${BODY}`;
  if (line) put(c, line, left, H - 104 * u, { font, colour: LABEL });
  put(c, FAN_LINE, left, H - 68 * u, { font, colour: LABEL });
  put(c, SHARE_SITE, W - left, H - 68 * u, { font: `500 ${String(19 * u)}px ${MONO}`, colour: CYAN, align: 'right' });
}

function disc(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, alpha = 1) {
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = fill;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
function ring(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stroke: string,
  width: number,
  dash: number[] = []
) {
  c.strokeStyle = stroke;
  c.lineWidth = width;
  c.setLineDash(dash);
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
}

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
const overlaps = (a: Box, b: Box) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

export interface PostcardScene {
  card: Postcard;
  format: ShareFormat;
  seed: [string, string];
  star: StarClass | '';
  planets: OrbitPlanet[];
  total: number;
}

// One logical unit of the layout is 3.6 pixels of the picture, as the hero diagram's sizes read at 1080.
const ORBIT_SCALE = 3.6;

export function drawPostcard(canvas: HTMLCanvasElement, scene: PostcardScene): void {
  const { card, format, seed, star, planets, total } = scene;
  const { width: W, height: H } = SHARE_FORMATS[format];
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  if (!c) return;
  const wide = format === 'wide';
  const u = 1;
  frame(c, W, H);

  // The chart keeps clear of the title (above it, or beside it on a wide picture) and the footer.
  const chartTop = wide ? 130 : format === 'story' ? 620 : 300;
  const chartBottom = H - (wide ? 120 : 130);
  const chartWidth = wide ? W * 0.62 : W;
  const layout = orbitLayout(seed, planets, {
    width: chartWidth / ORBIT_SCALE,
    height: (chartBottom - chartTop) / ORBIT_SCALE,
    size: 'XL',
    total,
    starX: 0 // half the sun, as the design's postcard shows it
  });
  const X = (v: number) => v * ORBIT_SCALE;
  const Y = (v: number) => chartTop + v * ORBIT_SCALE;
  const main = star ? STAR_CLASSES[star].color : UNLOGGED_STAR;
  const sx = X(layout.star.cx);
  const sy = Y(layout.star.cy);
  const sr = layout.star.r * ORBIT_SCALE;

  layout.orbits.forEach(orbit => {
    ring(
      c,
      sx,
      sy,
      orbit.r * ORBIT_SCALE,
      orbit.logged ? 'rgba(103,232,249,0.2)' : 'rgba(103,232,249,0.14)',
      2,
      orbit.logged ? [] : [6, 12]
    );
  });
  if (star) {
    ring(c, sx, sy, sr * 2.8, `${main}33`, 2, [8, 10]);
    ring(c, sx, sy, sr * 2.1, `${main}59`, 2);
    ring(c, sx, sy, sr * 1.5, `${main}99`, 2);
    disc(c, sx, sy, sr, main);
    disc(c, sx, sy, sr * 0.6, token(`--color-star-${star}-core`, '#fff7d6'), 0.9);
  } else {
    ring(c, sx, sy, sr, UNLOGGED_STAR, 2, [6, 6]);
    disc(c, sx, sy, sr * 0.35, UNLOGGED_STAR);
  }

  // Discs first, so a label can see every planet it might run into.
  const PLANET_SCALE = 0.52; // the hero's disc is sized for a phone; the design's postcard draws them smaller
  const taken: Box[] = layout.planets.map(planet => {
    const r = planet.r * ORBIT_SCALE * PLANET_SCALE + (planet.logged && planet.base ? 12 : 0);
    return { x1: X(planet.x) - r, y1: Y(planet.y) - r, x2: X(planet.x) + r, y2: Y(planet.y) + r };
  });
  for (const planet of layout.planets) {
    const x = X(planet.x);
    const y = Y(planet.y);
    const r = planet.r * ORBIT_SCALE * PLANET_SCALE;
    if (!planet.logged) {
      ring(c, x, y, r, '#475569', 2, [4, 6]);
      continue;
    }
    if (planet.family) {
      disc(c, x, y, r, token(`--color-biome-${planet.family}`, '#94a3b8'));
      c.fillStyle = token(`--color-biome-${planet.family}-shade`, '#475569');
      c.save();
      c.globalAlpha = 0.85;
      c.beginPath();
      c.arc(x, y, r, -Math.PI / 2, Math.PI / 2);
      c.ellipse(x, y, r * 0.45, r, 0, Math.PI / 2, -Math.PI / 2, true);
      c.fill();
      c.restore();
    } else disc(c, x, y, r, '#475569');
    if (planet.infested)
      for (const dot of sporeDots(x, y, r))
        disc(c, dot.x, dot.y, dot.r, planet.family ? token(`--color-biome-${planet.family}`, '#94a3b8') : '#475569');
    if (planet.base) ring(c, x, y, r + 12, '#22d3ee', 3);
    const label = card.labels?.[planet.index];
    if (label) {
      const lx = Math.max(100, Math.min(W - 100, x));
      const gap = r + (planet.base ? 18 : 8);
      c.font = `400 21px ${MONO}`;
      const half = Math.max(c.measureText(label.name).width, label.biome.length * 13) / 2 + 6;
      const box = (top: number): Box => ({ x1: lx - half, y1: top, x2: lx + half, y2: top + 54 });
      const below = box(y + gap);
      const above = box(y - gap - 54);
      const place =
        taken.some(other => overlaps(other, below)) && !taken.some(other => overlaps(other, above)) ? above : below;
      taken.push(place);
      put(c, label.name, lx, place.y1 + 21, { font: `400 21px ${MONO}`, colour: INK, align: 'center' });
      put(c, label.biome, lx, place.y1 + 48, {
        font: `400 18px ${BODY}`,
        colour: LABEL,
        align: 'center',
        spacing: 2.4
      });
    }
  }

  // The title block, right-aligned over the chart's empty corner (on a wide picture, its own column).
  const right = W - 68;
  const titleWidth = wide ? W * 0.36 : W - 68 * 2 - 120;
  let y = 180;
  if (card.eyebrow) {
    put(c, card.eyebrow, right, y, { font: `600 22px ${BODY}`, colour: '#fcd34d', align: 'right', spacing: 3.6 });
    y += 26;
  }
  const size = card.name.length > 26 ? 52 : 68;
  const nameFont = `900 ${String(size)}px ${DISPLAY}`;
  for (const line of wrap(c, card.name, nameFont, titleWidth, 3)) {
    y += size * 1.06;
    put(c, line, right, y, { font: nameFont, colour: '#fff', align: 'right' });
  }
  y += 18;
  for (const line of card.lines) {
    y += 44;
    put(c, line, right, y, { font: `400 27px ${BODY}`, colour: MUTED, align: 'right' });
  }
  if (card.tags.length) {
    y += 38;
    put(c, card.tags.join(' · '), right, y, { font: `400 21px ${MONO}`, colour: LABEL, align: 'right' });
  }
  if (card.portal) {
    y += 38;
    put(c, card.portal, right, y, { font: `500 23px ${MONO}`, colour: CYAN, align: 'right', spacing: 2 });
  }
  if (card.note) {
    const noteFont = `400 24px ${BODY}`;
    for (const line of wrap(c, `“${card.note}”`, noteFont, titleWidth, 2)) {
      y += 34;
      put(c, line, right, y, { font: noteFont, colour: INK, align: 'right' });
    }
  }

  grain(c, W, H, seed.join(':'));
  chrome(c, W, H, u, 'SYSTEM POSTCARD');
  footer(c, W, H, u, card.footer);
}

const LETTER: Record<string, string> = { C: '#94a3b8', B: '#7dd3fc', A: '#c4b5fd' };

export function drawFleetCard(
  canvas: HTMLCanvasElement,
  card: FleetCard,
  size: { width: number; height: number }
): void {
  const { width: W, height: H } = size;
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  if (!c) return;
  const u = W / 810;
  frame(c, W, H);
  const left = 60 * u;
  const right = W - left;
  grain(c, W, H, card.name);
  // On the Fleet card the design's margins are a touch tighter than a postcard's: the same parts, scaled to fit.
  chrome(c, W, H, (u * 60) / 68, 'FLEET CARD');
  let y = 188 * u;
  if (card.role)
    put(c, card.role, left, y, { font: `600 ${String(20 * u)}px ${BODY}`, colour: '#6ee7b7', spacing: 4.4 * u });
  const badge = 128 * u;
  const nameFont = `900 ${String(card.name.length > 16 ? 50 * u : 80 * u)}px ${DISPLAY}`;
  const names = wrap(c, card.name, nameFont, right - left - badge - 24 * u, 2);
  const lead = card.name.length > 16 ? 56 * u : 82 * u;
  names.forEach((line, i) => {
    put(c, line, left, y + lead * (i + 1) - 2 * u, { font: nameFont, colour: '#fff' });
  });
  y += lead * names.length + 44 * u;
  put(c, card.line, left, y, { font: `400 ${String(26 * u)}px ${BODY}`, colour: MUTED });

  if (card.letter) {
    const bx = right - badge;
    const by = 166 * u;
    c.fillStyle = 'rgba(252,211,77,0.06)';
    c.strokeStyle = 'rgba(252,211,77,0.45)';
    c.lineWidth = 2 * u;
    c.beginPath();
    c.roundRect(bx, by, badge, badge, 32 * u);
    c.fill();
    c.stroke();
    const mid = bx + badge / 2;
    c.font = `900 ${String(60 * u)}px ${DISPLAY}`;
    c.textAlign = 'center';
    c.fillStyle = card.letter === 'S' ? foil(c, bx, by, bx + badge, by + badge) : (LETTER[card.letter] ?? GOLD);
    c.fillText(card.letter, mid, by + 76 * u);
    put(c, 'CLASS', mid, by + 106 * u, {
      font: `600 ${String(16 * u)}px ${BODY}`,
      colour: GOLD,
      align: 'center',
      spacing: 3.2 * u
    });
  }

  y += 72 * u;
  put(c, `TECHNOLOGY GRID · ${String(card.cols)} × ${String(card.rows)}`, left, y, {
    font: `600 ${String(18 * u)}px ${BODY}`,
    colour: LABEL,
    spacing: 2.9 * u
  });
  put(c, card.count, right, y, { font: `500 ${String(20 * u)}px ${MONO}`, colour: '#e9d5ff', align: 'right' });

  y += 22 * u;
  const gap = 8 * u;
  const cell = (right - left - gap * (card.cols - 1)) / card.cols;
  const marked = new Map(card.cells.map(item => [item.slot, item.label]));
  for (let row = 1; row <= card.rows; row++)
    for (let col = 1; col <= card.cols; col++) {
      const x = left + (col - 1) * (cell + gap);
      const top = y + (row - 1) * (cell + gap);
      const slot = `R${String(row)}C${String(col)}`;
      const on = marked.has(slot);
      c.save();
      if (on) {
        c.shadowColor = 'rgba(192,132,252,0.45)';
        c.shadowBlur = 14 * u;
      }
      c.fillStyle = on ? 'rgba(88,28,135,0.55)' : 'rgba(15,23,42,0.8)';
      c.strokeStyle = on ? '#c084fc' : '#1e293b';
      c.lineWidth = (on ? 3 : 2) * u;
      c.beginPath();
      c.roundRect(x, top, cell, cell, 12 * u);
      c.fill();
      c.stroke();
      c.restore();
      const label = marked.get(slot);
      if (label)
        put(c, label.toUpperCase().slice(0, 6), x + cell / 2, top + cell / 2 + 5 * u, {
          font: `700 ${String(Math.min(13, cell / 5) * u)}px ${BODY}`,
          colour: '#f5d0fe',
          align: 'center'
        });
    }
  y += card.rows * (cell + gap) + 14 * u;

  // The marked slots, by name, wrapping onto a second row on a large build.
  let px = left;
  const pill = 94 * u;
  const pillGap = 12 * u;
  for (const item of card.cells) {
    if (px + pill > right) {
      px = left;
      y += 60 * u;
    }
    c.fillStyle = 'rgba(88,28,135,0.28)';
    c.strokeStyle = 'rgba(192,132,252,0.45)';
    c.lineWidth = 2 * u;
    c.beginPath();
    c.roundRect(px, y, pill, 48 * u, 24 * u);
    c.fill();
    c.stroke();
    put(c, item.slot, px + pill / 2, y + 31 * u, {
      font: `400 ${String(20 * u)}px ${MONO}`,
      colour: '#e9d5ff',
      align: 'center'
    });
    px += pill + pillGap;
  }
  if (card.cells.length) y += 48 * u;

  if (card.note) {
    y += 48 * u;
    const noteFont = `400 ${String(28 * u)}px ${BODY}`;
    const lines = wrap(c, card.note, noteFont, right - left - 68 * u, 4);
    const boxHeight = 88 * u + lines.length * 40 * u;
    c.fillStyle = 'rgba(5,8,17,0.6)';
    c.strokeStyle = 'rgba(148,163,184,0.18)';
    c.lineWidth = 2 * u;
    c.beginPath();
    c.roundRect(left, y, right - left, boxHeight, 32 * u);
    c.fill();
    c.stroke();
    put(c, 'THE BUILD', left + 34 * u, y + 48 * u, {
      font: `600 ${String(18 * u)}px ${BODY}`,
      colour: LABEL,
      spacing: 2.9 * u
    });
    lines.forEach((line, i) => {
      put(c, line, left + 34 * u, y + 92 * u + i * 40 * u, { font: noteFont, colour: INK });
    });
    y += boxHeight;
  }
  if (card.matches) {
    y += 52 * u;
    put(c, '✓  Slots match the NMS wiki (Supercharged Slot)', left, y, {
      font: `400 ${String(24 * u)}px ${BODY}`,
      colour: '#a7f3d0'
    });
  }
  footer(c, W, H, (u * 60) / 68, card.footer);
}

function paintShapes(c: CanvasRenderingContext2D, group: ArtGroup, art: CardArt) {
  c.save();
  if (group.start) {
    c.translate(art.cx, art.cy);
    c.rotate((group.start * Math.PI) / 180);
    c.translate(-art.cx, -art.cy);
  }
  for (const shape of group.shapes) {
    if (shape.kind === 'star') {
      const main = shape.colour ? STAR_CLASSES[shape.colour].color : UNLOGGED_STAR;
      for (const [k, alpha] of [
        [2.8, '33'],
        [2.1, '59'],
        [1.5, '99']
      ] as const)
        ring(c, shape.cx, shape.cy, shape.r * k, `${main}${alpha}`, 0.8, k === 2.8 ? [4, 5] : []);
      disc(c, shape.cx, shape.cy, shape.r, main);
      disc(c, shape.cx, shape.cy, shape.r * 0.6, token(`--color-star-${shape.colour}-core`, '#fff7d6'), 0.9);
    } else if (shape.kind === 'planet') {
      planetDisc(c, shape.cx, shape.cy, shape.r, shape.family);
      // The Infested spore ring, as the SVG marker draws it (round 4b).
      if (shape.infested)
        for (const dot of sporeDots(shape.cx, shape.cy, shape.r))
          disc(c, dot.x, dot.y, dot.r, shape.family ? token(`--color-biome-${shape.family}`, '#94a3b8') : '#475569');
      if (shape.base) ring(c, shape.cx, shape.cy, shape.r + 5, '#22d3ee', 1.4);
    } else if (shape.kind === 'text') {
      put(c, shape.text, shape.x, shape.y, { font: `400 9px ${MONO}`, colour: '#64748b', align: 'center', spacing: 2 });
    } else {
      const path = shape.kind === 'path' ? new Path2D(shape.d) : new Path2D();
      if (shape.kind === 'circle') path.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
      if (shape.fill) {
        c.globalAlpha = shape.fillOpacity ?? 1;
        c.fillStyle = shape.fill;
        c.fill(path);
      }
      if (shape.stroke) {
        c.globalAlpha = shape.strokeOpacity ?? 1;
        c.strokeStyle = shape.stroke;
        c.lineWidth = shape.width ?? 1;
        c.setLineDash(shape.dash ?? []);
        c.stroke(path);
        c.setLineDash([]);
      }
      c.globalAlpha = 1;
    }
  }
  c.restore();
}

function planetDisc(c: CanvasRenderingContext2D, x: number, y: number, r: number, family: string | null) {
  if (!family) {
    disc(c, x, y, r, '#475569');
    return;
  }
  disc(c, x, y, r, token(`--color-biome-${family}`, '#94a3b8'));
  c.save();
  c.globalAlpha = 0.85;
  c.fillStyle = token(`--color-biome-${family}-shade`, '#475569');
  c.beginPath();
  c.arc(x, y, r, -Math.PI / 2, Math.PI / 2);
  c.ellipse(x, y, r * 0.45, r, 0, Math.PI / 2, -Math.PI / 2, true);
  c.fill();
  c.restore();
}

export const CARD_EXPORT = { width: 1080, height: 1350 };
const FINISH_EDGE: Record<string, string> = {
  logged: 'rgba(148,163,184,0.4)',
  addressed: 'rgba(103,232,249,0.6)',
  first: 'rgba(252,211,77,0.8)',
  fleet: 'rgba(192,132,252,0.6)'
};
const RARITY_INK: Record<string, string> = { first: '#fcd34d', fleet: '#e9d5ff', addressed: '#a5f3fc', logged: LABEL };

/** The export layout (c05): 4:5, the art on top, the name and the mark below. */
function drawExport(
  canvas: HTMLCanvasElement,
  parts: {
    paint: (c: CanvasRenderingContext2D) => void;
    title: string;
    sub: string;
    rarity: string;
    finish: string;
    address: string;
  }
) {
  const { width: W, height: H } = CARD_EXPORT;
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  if (!c) return;
  frame(c, W, H);
  c.save();
  c.beginPath();
  c.rect(0, 0, W, 1080);
  c.clip();
  parts.paint(c);
  c.restore();
  grain(c, W, H, parts.title);
  c.fillStyle = 'rgba(148,163,184,0.18)';
  c.fillRect(0, 1080, W, 2);
  const left = 56;
  const size = parts.title.length > 22 ? 44 : 58;
  put(c, wrap(c, parts.title, `900 ${String(size)}px ${DISPLAY}`, W - 420, 1)[0] ?? '', left, 1166, {
    font: `900 ${String(size)}px ${DISPLAY}`,
    colour: '#fff'
  });
  put(c, [parts.sub, parts.address && groupAddress(parts.address)].filter(Boolean).join(' · '), left, 1222, {
    font: `400 27px ${BODY}`,
    colour: MUTED
  });
  put(c, parts.rarity, W - left, 1160, {
    font: `700 22px ${BODY}`,
    colour: RARITY_INK[parts.finish] ?? LABEL,
    align: 'right',
    spacing: 3.6
  });
  const mark = `800 24px ${DISPLAY}`;
  c.font = mark;
  c.letterSpacing = '4px';
  const os = c.measureText(':OS').width;
  const atlas = c.measureText('ATLAS').width;
  c.letterSpacing = '0px';
  put(c, ':OS', W - left - os, 1222, { font: mark, colour: CYAN, spacing: 4 });
  put(c, 'ATLAS', W - left - os - atlas, 1222, { font: mark, colour: '#fff', spacing: 4 });
  put(c, `${SHARE_SITE} · fan-made, not affiliated with Hello Games`, W / 2, 1296, {
    font: `400 20px ${BODY}`,
    colour: '#64748b',
    align: 'center'
  });
  c.strokeStyle = FINISH_EDGE[parts.finish] ?? FINISH_EDGE.logged ?? '';
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(2, 2, W - 4, H - 4, 44);
  c.stroke();
}

export function drawCollectionCard(canvas: HTMLCanvasElement, card: CollectionCard, art: CardArt): void {
  drawExport(canvas, {
    title: card.title,
    sub: card.sub,
    rarity: card.rarity,
    finish: card.kind,
    address: card.address,
    paint: c => {
      c.fillStyle = art.base;
      c.fillRect(0, 0, 1080, 1080);
      const scale = 1080 / art.width;
      c.translate(0, 540 - art.cy * scale);
      c.scale(scale, scale);
      for (const group of [...art.bg, ...art.mid, ...art.fg]) paintShapes(c, group, art);
    }
  });
}

export function drawTravellerExport(
  canvas: HTMLCanvasElement,
  parts: {
    lines: { d: string; colour: string }[];
    eyes: { x: number; y: number; r: number; colour: string }[];
    title: string;
    sub: string;
    rarity: string;
  }
): void {
  drawExport(canvas, {
    ...parts,
    finish: 'first',
    address: '',
    paint: c => {
      const scale = 1080 / 300;
      c.scale(scale, scale);
      c.lineWidth = 0.7;
      for (const line of parts.lines) {
        c.globalAlpha = 0.55;
        c.strokeStyle = line.colour;
        c.stroke(new Path2D(line.d));
      }
      c.globalAlpha = 1;
      for (const eye of parts.eyes) disc(c, eye.x, eye.y, eye.r, eye.colour);
    }
  });
}

const FRONTIER_FAMILIES = ['toxic', 'hot', 'radioactive', 'frozen', 'exotic', 'lush'];

export function drawFrontier(canvas: HTMLCanvasElement, view: Frontier): void {
  const { width: W, height: H } = CARD_EXPORT;
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  if (!c) return;
  frame(c, W, H);
  grain(c, W, H, 'frontier');
  chrome(c, W, H, 1, 'FRONTIER');
  const left = 68;
  const right = W - 68;
  put(c, 'Frontier', left, 230, { font: `900 72px ${DISPLAY}`, colour: '#fff' });
  put(c, `${String(view.firsts)} first${view.firsts === 1 ? '' : 's'}`, right, 226, {
    font: `600 30px ${BODY}`,
    colour: '#6ee7b7',
    align: 'right'
  });
  const empty = (x: number, y: number, r: number) => {
    ring(c, x, y, r, '#475569', 2, [5, 6]);
  };
  const row = (y: number, title: string, count: string, draw: (top: number) => void, note: string) => {
    put(c, title, left, y, { font: `800 32px ${DISPLAY}`, colour: '#fff' });
    put(c, count, right, y, { font: `500 28px ${MONO}`, colour: CYAN, align: 'right' });
    draw(y + 66);
    put(c, wrap(c, note, `400 25px ${BODY}`, right - left, 1)[0] ?? '', left, y + 142, {
      font: `400 25px ${BODY}`,
      colour: MUTED
    });
  };
  const STARS: StarClass[] = ['yellow', 'red', 'green', 'blue', 'purple'];
  const have = STARS.filter(star => view.stars.have.includes(star));
  row(
    320,
    'Star colours',
    `${String(have.length)} / ${String(view.stars.total)}`,
    y => {
      for (let i = 0; i < view.stars.total; i++) {
        const x = left + 34 + i * 120;
        const star = have[i];
        if (star) disc(c, x, y, 26, STAR_CLASSES[star].color);
        else empty(x, y, 24);
      }
    },
    view.stars.note
  );
  const families = FRONTIER_FAMILIES.filter(kind => (view.biomes.have as string[]).includes(kind));
  row(
    560,
    'Biome families',
    `${String(families.length)} / ${String(view.biomes.total)}`,
    y => {
      for (let i = 0; i < view.biomes.total; i++) {
        const x = left + 34 + i * 120;
        const kind = families[i];
        if (kind) planetDisc(c, x, y, 26, kind);
        else empty(x, y, 24);
      }
    },
    view.biomes.note
  );
  const chips = (y: number, labels: string[], total: number, width: number) => {
    for (let i = 0; i < total; i++) {
      const x = left + i * (width + 14);
      const label = labels[i];
      c.strokeStyle = label ? 'rgba(103,232,249,0.5)' : '#475569';
      c.lineWidth = 2;
      c.setLineDash(label ? [] : [6, 6]);
      c.beginPath();
      c.roundRect(x, y - 30, width, 60, 16);
      c.stroke();
      c.setLineDash([]);
      put(c, wrap(c, label ?? '?', `600 24px ${BODY}`, width - 20, 1)[0] ?? '', x + width / 2, y + 8, {
        font: `600 24px ${BODY}`,
        colour: label ? '#fff' : LABEL,
        align: 'center'
      });
    }
  };
  row(
    800,
    'Races met',
    `${String(view.races.have.length)} / ${String(view.races.total)}`,
    y => {
      chips(
        y,
        view.races.have.map(race => RACE_NAME[race]),
        view.races.total,
        300
      );
    },
    view.races.note
  );
  const shipTotal = Math.min(view.ships.slots, 3);
  row(
    1030,
    'Starship types',
    `${String(view.ships.have.length)} logged`,
    y => {
      chips(y, view.ships.have.slice(0, 3), shipTotal, 300);
    },
    view.ships.note
  );
  footer(c, W, H, 1, '');
}
const RACE_NAME = RACES;

export function pictureBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('no picture'));
    }, 'image/png');
  });
}
