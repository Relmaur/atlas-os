// The page's motion: the sky, the sun and what it lights, the chapters, and things arriving as they're scrolled to.
// All of it is extra: the HTML and CSS are complete without this script, and nothing starts hidden until it runs. With
// reduced motion only the still parts run: the sun takes its place and lights what's near it.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phoneWidth = matchMedia('(max-width: 900px)');
const all = <T extends Element = HTMLElement>(selector: string) => [...document.querySelectorAll<T>(selector)];
const clamp = (v: number, low = 0, high = 1) => Math.min(high, Math.max(low, v));

const nav = document.getElementById('nav');
const sunEl = document.getElementById('sun');
const heroPhone = document.getElementById('heroPhone');
const story = document.getElementById('story');
const banner = document.getElementById('banner');
const sky = document.querySelector<HTMLCanvasElement>('#sky');
const chapters = all('.chapter');
const layers = all('.stack .layer');
const dots = all('.dots i');
const arriving = all('.rung .mini-card, .pl-line h3, .device, #priceWord');
const lit = all('.lit, .sunlit');

// The stars. Their places are decoration, so a plain random is fine.
const pen = sky?.getContext('2d');
let stars: { x: number; y: number; r: number; a: number; z: number }[] = [];
function makeStars() {
  if (!sky || !pen) return;
  const density = devicePixelRatio || 1;
  sky.width = innerWidth * density;
  sky.height = innerHeight * density;
  pen.setTransform(density, 0, 0, density, 0, 0);
  stars = Array.from({ length: Math.round((innerWidth * innerHeight) / 9000) }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: Math.random() * 1.1 + 0.2,
    a: Math.random() * 0.6 + 0.15,
    z: Math.random() * 0.6 + 0.2
  }));
}
function drawStars(scrolled: number) {
  if (!pen) return;
  pen.clearRect(0, 0, innerWidth, innerHeight);
  for (const star of stars) {
    const y = (((star.y - scrolled * star.z * 0.15) % innerHeight) + innerHeight) % innerHeight;
    pen.globalAlpha = star.a;
    pen.fillStyle = star.z > 0.6 ? '#cfefff' : '#8fa6c8';
    pen.beginPath();
    pen.arc(star.x, y, star.r, 0, Math.PI * 2);
    pen.fill();
  }
  pen.globalAlpha = 1;
}

// The sun crosses the sky as the page is read, and lights what it passes.
function placeSun(scrolled: number) {
  const room = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const t = clamp(scrolled / room);
  const sun = {
    x: innerWidth * (0.86 - 0.72 * t),
    y: innerHeight * (0.22 + 0.22 * Math.sin(Math.PI * t)),
    k: 0.9 + 0.25 * Math.sin(Math.PI * t * 2)
  };
  if (sunEl) {
    const scale = clamp(Math.min(innerWidth, 1500) / 1300, 0.62, 1.1) * sun.k;
    sunEl.style.transform = `translate(${sun.x.toFixed(1)}px, ${sun.y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
  }
  const reach = Math.hypot(innerWidth, innerHeight) * 0.9;
  for (const el of lit) {
    const box = el.getBoundingClientRect();
    if (box.bottom < -50 || box.top > innerHeight + 50) continue;
    const distance = Math.hypot(sun.x - (box.left + box.width / 2), sun.y - (box.top + box.height / 2));
    el.style.setProperty('--lx', `${(((sun.x - box.left) / Math.max(1, box.width)) * 100).toFixed(1)}%`);
    el.style.setProperty('--ly', `${(((sun.y - box.top) / Math.max(1, box.height)) * 100).toFixed(1)}%`);
    el.style.setProperty('--li', clamp(1.15 - distance / reach, 0.15, 1).toFixed(3));
  }
}

// A screen taller than the phone scrolls with the reader: eased, and snapped to device pixels so its text stays sharp.
const SCREEN_W = 390;
const SCREEN_H = 844;
const shots = all('.shot');
const glide = new Map<HTMLElement, { at: number; to: number }>();
function fitShots() {
  for (const shot of shots) {
    const scale = (shot.parentElement?.clientWidth ?? SCREEN_W) / SCREEN_W;
    shot.style.height = `${(Number(shot.dataset.h) * scale).toFixed(1)}px`;
  }
}
function glideShots() {
  let moving = false;
  const density = devicePixelRatio || 1;
  for (const [shot, y] of glide) {
    if (y.at === y.to) continue;
    y.at = Math.abs(y.to - y.at) < 0.3 ? y.to : y.at + (y.to - y.at) * 0.12;
    const scale = (shot.parentElement?.clientWidth ?? SCREEN_W) / SCREEN_W;
    shot.style.transform = `translate3d(0, ${String(Math.round(-y.at * scale * density) / density)}px, 0)`;
    moving ||= y.at !== y.to;
  }
  if (moving) requestAnimationFrame(glideShots);
}

const arrivalOf = (el: Element, start = 1.02, end = 0.55) =>
  clamp((innerHeight * start - el.getBoundingClientRect().top) / (innerHeight * (start - end)));

let current = -1;
function frame() {
  scheduled = false;
  const scrolled = scrollY;
  const tall = innerHeight;
  nav?.classList.toggle('solid', scrolled > 24);
  drawStars(reduce ? 0 : scrolled);
  placeSun(scrolled);
  if (reduce) return;
  heroPhone?.style.setProperty('--hp', clamp(scrolled / (tall * 0.7)).toFixed(3));
  for (const el of arriving) el.style.setProperty('--rp', arrivalOf(el).toFixed(3));

  // Which chapter is in the middle of the screen.
  let index = 0;
  chapters.forEach((chapter, i) => {
    if (chapter.getBoundingClientRect().top < tall * 0.55) index = i;
    chapter.classList.toggle('on', false);
  });
  chapters[index]?.classList.add('on');
  if (index !== current) {
    current = index;
    layers.forEach((layer, i) => layer.classList.toggle('on', i === index));
    dots.forEach((dot, i) => dot.classList.toggle('on', i === index));
    banner?.classList.toggle('on', index === 3); // the timers chapter: the refiner's done
  }
  const shot = shots[index];
  const chapter = chapters[index];
  if (shot && chapter) {
    const room = Math.max(0, Number(shot.dataset.h) - SCREEN_H);
    const box = chapter.getBoundingClientRect();
    const y = glide.get(shot) ?? { at: 0, to: 0 };
    y.to = room * clamp((tall * 0.55 - box.top) / Math.max(1, box.height * 0.9));
    glide.set(shot, y);
    requestAnimationFrame(glideShots);
  }
}
let scheduled = false;
const schedule = () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(frame);
};
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', () => {
  makeStars();
  fitShots();
  schedule();
});

if (!reduce) {
  story?.classList.add('js');

  // The hero video plays only while it's on screen. With reduced motion, or no script, its poster stands still.
  const video = document.querySelector<HTMLVideoElement>('#heroVideo');
  if (video) {
    new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void video.play().catch(() => undefined);
      else video.pause();
    }).observe(video);
  }

  // Numbers count up once, to what the build wrote into the page.
  const counters = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        counters.unobserve(entry.target);
        const to = Number(entry.target.textContent.replace(/,/g, ''));
        const start = performance.now();
        const step = (now: number) => {
          const t = clamp((now - start) / 1400);
          entry.target.textContent = Math.round(to * (1 - (1 - t) ** 3)).toLocaleString('en-US');
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    },
    { threshold: 0.6 }
  );
  all('[data-count]').forEach(el => {
    counters.observe(el);
  });

  // Chapter text splits into words. The spaces stay, so a screen reader still reads sentences.
  for (const el of all('.split')) {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.style.setProperty('--i', String(i));
      span.textContent = word;
      el.append(span);
      if (i < words.length - 1) el.append(' ');
    });
  }
  // On phones a chapter isn't dimmed by its neighbours: its words arrive once, when it's scrolled to.
  const wordsArrive = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !phoneWidth.matches) continue;
        entry.target.classList.remove('split-pending');
        wordsArrive.unobserve(entry.target);
      }
    },
    { threshold: 0.3 }
  );
  for (const chapter of chapters) {
    if (phoneWidth.matches && chapter.getBoundingClientRect().top > innerHeight) chapter.classList.add('split-pending');
    wordsArrive.observe(chapter);
  }

  // Headings rise word by word out of a mask, and the copy settles in after them, the first time each is seen.
  const heads = all('.sec-head h2, .ladder h2, .pl-line h3, .reveal h2');
  for (const head of heads) {
    const walker = document.createTreeWalker(head, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    while (walker.nextNode()) texts.push(walker.currentNode as Text); // SHOW_TEXT yields only Text nodes
    let i = 0;
    for (const text of texts) {
      const pieces = text.textContent.split(/(\s+)/).filter(Boolean);
      text.replaceWith(
        ...pieces.map(piece => {
          if (/^\s+$/.test(piece)) return ' ';
          const mask = document.createElement('span');
          mask.className = 'mw';
          const word = document.createElement('span');
          word.className = 'wi';
          word.style.setProperty('--i', String(i++));
          word.textContent = piece;
          mask.append(word);
          return mask;
        })
      );
    }
  }
  const copy = all('.sec-head p, .ladder > p, .reveal .lead-in, .reveal .gift, .reveal .ctas, .pl-line p');
  copy.forEach(el => {
    el.classList.add('fx');
  });
  for (const group of all('.sec-head, .ladder, .reveal .wrap')) {
    let delay = 0;
    for (const el of group.querySelectorAll<HTMLElement>('.fx')) {
      if (!el.matches('.eyebrow')) delay += 160;
      el.style.setProperty('--fd', `${String(el.matches('.eyebrow') ? 0 : delay + 200)}ms`);
    }
  }
  const seen = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove('pre');
        seen.unobserve(entry.target);
        if (entry.target.classList.contains('rising')) {
          const words = entry.target.querySelectorAll('.wi').length;
          setTimeout(
            () => {
              entry.target.classList.remove('rising');
            },
            RISE_MS + words * RISE_STAGGER_MS
          );
        }
      }
    },
    { threshold: 0.2, rootMargin: '0px 0px -8% 0px' }
  );
  // The lengths of .wi's transition and its delay per word, in page.css.
  const RISE_MS = 1300;
  const RISE_STAGGER_MS = 75;
  // Only what's below the fold waits. Anything already on screen just stays.
  for (const el of [...heads, ...copy]) {
    if (el.getBoundingClientRect().top <= innerHeight * 0.92) continue;
    el.classList.add('pre');
    if (el.matches('.sunlit')) el.classList.add('rising');
    seen.observe(el);
  }

  // The big card follows the pointer, and sways gently when left alone. It rests while it's off screen.
  const PHONE_IN_HAND = '(pointer: coarse) and (max-width: 767px)';
  const MOTION_DEG = 15; // a turn of the wrist this far is the full tilt, as in the app
  const MOTION_REST_MS = 10_000;
  type AskingOrientation = { requestPermission?: () => Promise<'granted' | 'denied'> };
  const frameEl = document.getElementById('cardframe');
  const box = frameEl?.parentElement;
  if (frameEl && box) {
    // The same variables the card has in the app: its art, badge, foil and sheen follow them.
    const setCardLight = (x: number, y: number) => {
      frameEl.style.setProperty('--tilt-x', x.toFixed(3));
      frameEl.style.setProperty('--tilt-y', y.toFixed(3));
    };
    box.addEventListener('pointermove', event => {
      const area = box.getBoundingClientRect();
      const x = (event.clientX - area.left) / area.width - 0.5;
      const y = (event.clientY - area.top) / area.height - 0.5;
      frameEl.style.transform = `rotateY(${(x * 16).toFixed(2)}deg) rotateX(${(-y * 12).toFixed(2)}deg)`;
      setCardLight(x, y);
    });
    box.addEventListener('pointerleave', () => {
      frameEl.style.transform = '';
      setCardLight(0, 0);
    });
    let swaying = false;
    let following = false;
    const sway = (now: number) => {
      if (!swaying) return;
      if (!following && !box.matches(':hover')) {
        const t = now / 1000;
        frameEl.style.transform = `rotateY(${(Math.sin(t * 0.6) * 7).toFixed(2)}deg) rotateX(${(Math.cos(t * 0.5) * 4).toFixed(2)}deg)`;
        setCardLight(Math.sin(t * 0.6) * 0.45, -Math.cos(t * 0.5) * 0.35);
      }
      requestAnimationFrame(sway);
    };
    new IntersectionObserver(([entry]) => {
      const was = swaying;
      swaying = entry?.isIntersecting ?? false;
      if (swaying && !was) requestAnimationFrame(sway);
    }).observe(box);

    // On a phone it answers the phone's motion too, as the app's card does: measured from how it's held, with level
    // drifting slowly after the hand. The line saying so shows only where that's true. iOS offers motion only after a
    // prompt, which must come from a tap, so there the first tap on the card asks.
    const followMotion = () => {
      let rest: { beta: number; gamma: number; at: number } | null = null;
      window.addEventListener('deviceorientation', event => {
        if (!swaying || event.beta === null || event.gamma === null) return;
        following = true;
        rest ??= { beta: event.beta, gamma: event.gamma, at: event.timeStamp };
        const drift = Math.min(1, (event.timeStamp - rest.at) / MOTION_REST_MS);
        rest.at = event.timeStamp;
        rest.beta += (event.beta - rest.beta) * drift;
        rest.gamma += (event.gamma - rest.gamma) * drift;
        const clamp = (v: number) => Math.max(-0.5, Math.min(0.5, v));
        const x = clamp(((event.gamma - rest.gamma) / MOTION_DEG) * 0.5);
        const y = clamp(((event.beta - rest.beta) / MOTION_DEG) * 0.5);
        frameEl.style.transform = `rotateY(${(x * 24).toFixed(2)}deg) rotateX(${(-y * 24).toFixed(2)}deg)`;
        setCardLight(x, y);
      });
    };
    const tiltLine = document.getElementById('tilt-line');
    if (tiltLine && matchMedia(PHONE_IN_HAND).matches && typeof DeviceOrientationEvent !== 'undefined') {
      tiltLine.hidden = false;
      // iOS only, so it isn't in TypeScript's DOM types; the check below is what proves it's callable.
      const ask = (DeviceOrientationEvent as unknown as AskingOrientation).requestPermission;
      if (ask) {
        tiltLine.textContent = 'Tap the card and tilt your phone: it catches the light.';
        box.addEventListener(
          'click',
          () => {
            ask
              .call(DeviceOrientationEvent)
              .then(answer => {
                if (answer === 'granted') followMotion();
              })
              .catch(() => undefined);
          },
          { once: true }
        );
      } else {
        followMotion();
      }
    }
  }
}

// The live cards and Map load as they come near, so the first screen doesn't wait for them. If they can't, the
// frames simply stay empty.
const liveParts = all('[data-live-card], [data-live-map]');
const nearing = new IntersectionObserver(
  entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    nearing.disconnect();
    import('./live.tsx')
      .then(live => {
        live.mountLive();
      })
      .catch((err: unknown) => {
        console.warn('[atlas]', { event: 'site-live-failed', message: String(err) });
      });
  },
  { rootMargin: '800px 0px' }
);
liveParts.forEach(el => {
  nearing.observe(el);
});

makeStars();
fitShots();
frame();
