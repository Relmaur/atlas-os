// The Updates pages' small script: the stars, updates rising in as they're reached, and Copy link. The pages read in
// full without it, and nothing starts hidden until it runs.
import './updates.css';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// A quiet starfield, as on the product page. Decoration, so a plain random is fine.
const sky = document.querySelector<HTMLCanvasElement>('#sky');
const pen = sky?.getContext('2d');
function drawStars() {
  if (!sky || !pen) return;
  const density = devicePixelRatio || 1;
  sky.width = innerWidth * density;
  sky.height = innerHeight * density;
  pen.setTransform(density, 0, 0, density, 0, 0);
  for (let i = 0; i < (innerWidth * innerHeight) / 9000; i++) {
    pen.globalAlpha = Math.random() * 0.5 + 0.12;
    pen.fillStyle = Math.random() > 0.6 ? '#cfefff' : '#8fa6c8';
    pen.beginPath();
    pen.arc(Math.random() * innerWidth, Math.random() * innerHeight, Math.random() * 1.1 + 0.2, 0, Math.PI * 2);
    pen.fill();
  }
  pen.globalAlpha = 1;
}
drawStars();
addEventListener('resize', drawStars);

if (!reduce) {
  const reached = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove('pre');
        reached.unobserve(entry.target);
      }
    },
    { threshold: 0.12 }
  );
  for (const update of document.querySelectorAll('.rel')) {
    update.classList.add('rise');
    if (update.getBoundingClientRect().top <= innerHeight * 0.9) continue; // the first is there at rest
    update.classList.add('pre');
    reached.observe(update);
  }
}

// Copy link writes the update's own address. If the clipboard is refused, the address is shown to select by hand.
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  button.addEventListener('click', () => {
    const url = button.dataset.copy ?? '';
    navigator.clipboard
      .writeText(url)
      .then(() => {
        button.textContent = 'Link copied';
        button.classList.add('copied');
        setTimeout(() => {
          button.textContent = 'Copy link';
          button.classList.remove('copied');
        }, 2200);
      })
      .catch(() => {
        const foot = button.closest('.foot');
        if (!foot || foot.querySelector('.copy-url')) return;
        const shown = document.createElement('span');
        shown.className = 'copy-url';
        shown.textContent = url;
        foot.append(shown);
      });
  });
}
