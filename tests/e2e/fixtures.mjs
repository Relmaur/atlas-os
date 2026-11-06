// Shared Playwright setup: a seeded save (never the real one) and a page that fails the test on any
// uncaught error or console error.
import { test as base, expect } from '@playwright/test';

export const STORAGE_KEY = 'nms_master_os_state';
const minutesAgo = minutes => new Date(Date.now() - minutes * 60000).toISOString();

// A player's save: a few systems, a ship, a Multi-Tool and a note pinned to Home and Book III.
export function seedState() {
  return {
    meta: { version: '2.0.0', lastUpdated: '2099-01-01T00:00:00.000Z', currentPhase: 'Phase 3: Test run' },
    outlaw: { restockHours: 24, packetsPerVisit: 15, runSize: 5, unitsPerPacket: 75000, nanitesPerPacket: 350 },
    systems: [
      {
        id: 'sys-ekwa',
        name: 'Ekwa Nexus',
        region: 'Odyalutai',
        galaxy: 'Euclid',
        glyphs: '0123456789AB',
        star: 'yellow',
        tags: ['trade-hub', 'base'],
        notes: 'S-class hauler spawns here',
        planets: [],
        visits: [{ at: minutesAgo(10) }],
        createdAt: '2026-10-20T00:00:00.000Z'
      },
      {
        id: 'sys-hesper',
        name: 'Hesper Drift',
        star: 'green',
        tags: ['to-revisit'],
        // A scanned planet in danger and one with nothing logged, for the planet view (36) and its states.
        planets: [
          {
            id: 'pl-storm',
            name: 'Storm Rock',
            biome: 'Frozen',
            descriptor: 'Frostbound',
            body: 'planet',
            weather: 'Deep Freeze',
            sentinels: 'Frenzied',
            temperature: -88.5,
            resources: ['Frost Crystal', 'Emeril'],
            discoveredBy: 'Test Traveller',
            discoveredOn: '2026-11-05',
            discoveredTime: '19:49'
          },
          { id: 'pl-blank', name: 'Geor Beta', body: 'planet' }
        ],
        visits: [{ at: minutesAgo(2 * 24 * 60) }],
        createdAt: '2026-10-21T00:00:00.000Z'
      },
      {
        id: 'sys-den',
        name: 'Outlaw Den',
        region: 'Pirate Reach',
        star: 'red',
        conflict: 'pirate',
        tags: ['outlaw'],
        planets: [],
        visits: [],
        createdAt: '2026-10-22T00:00:00.000Z'
      }
    ],
    gear: [
      {
        id: 'gear-kestrel',
        kind: 'starship',
        name: 'Kestrel IV',
        class: 'S',
        type: 'Interceptor',
        role: 'Flagship',
        superchargedSlots: ['R2C2', 'R2C3', 'R2C4'],
        slotLabels: { R2C3: 'Infra-Knife Accelerator' },
        notes: 'Infra-Knife in the **middle** slot.',
        createdAt: '2026-10-20T00:00:00.000Z'
      },
      {
        id: 'gear-rifle',
        kind: 'multitool',
        name: 'Quiet Rifle',
        class: 'B',
        type: 'Sentinel Rifle',
        role: 'Combat',
        superchargedSlots: [],
        notes: '',
        createdAt: '2026-10-20T00:00:00.000Z'
      }
    ],
    notes: [
      {
        id: 'note-grid',
        title: 'My scanner layout',
        body: '| Slot | Module |\n|---|---|\n| R1C8 | Best scanner |\n\nSee [[Oxygen]].',
        pins: ['home', 'book3'],
        createdAt: '2026-10-20T00:00:00.000Z',
        updatedAt: '2026-10-20T00:00:00.000Z'
      }
    ]
  };
}

export const test = base.extend({
  // Seed once per test; reloads keep whatever the app saved since (sessionStorage marks it done).
  seed: [seedState(), { option: true }],
  // Console errors a test provokes on purpose (Chrome logs every failed response, e.g. a relay answering 503).
  expectedErrors: [[], { option: true }],
  page: async ({ page, seed, expectedErrors }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error' && !expectedErrors.some(pattern => pattern.test(message.text())))
        errors.push(`console: ${message.text()}`);
    });
    await page.addInitScript(
      ([key, value]) => {
        if (sessionStorage.getItem('atlas-test-seeded')) return;
        if (value) localStorage.setItem(key, value);
        else localStorage.removeItem(key);
        sessionStorage.setItem('atlas-test-seeded', '1');
      },
      [STORAGE_KEY, seed ? JSON.stringify(seed) : '']
    );
    await use(page);
    expect(errors, 'no uncaught or console errors').toEqual([]);
  }
});

export { expect };

export async function storedState(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
}

// The layout must never scroll sideways (390px phones especially).
export async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
}

// Home's Start session is hold to activate: press, wait until the session is live, let go. A tap does nothing.
// With Playwright's fake clock installed, pass `{ fakeClock: true }` and the hold's 600ms is run on it.
export async function holdToStartSession(page, { fakeClock = false } = {}) {
  // hover() waits until the button itself takes the pointer: not under the tab bar, nor a screen's view transition.
  await page.locator('#startSession').hover();
  await page.mouse.down();
  if (fakeClock) await page.clock.runFor(700);
  await expect(page.locator('#sessionBar')).toBeVisible();
  await page.mouse.up();
}

// The Session and timers button that's on screen: the app header's, or Home's own on a phone.
export const sessionButton = page => page.locator('#sessionButton:visible, #homeSessionButton:visible');
