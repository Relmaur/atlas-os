import { test, expect, storedState, holdToStartSession, liveBar, openLiveBar } from './fixtures.mjs';

test('a session with a one-minute timer: the bar counts down, then announces it once', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  await holdToStartSession(page, { fakeClock: true });
  await openLiveBar(page); // starting shows the bar; the bar opens the Session screen
  await expect(page.locator('#sessionClock')).toBeVisible();
  await page.getByRole('button', { name: 'Custom timer' }).click();
  const sheet = page.locator('#timerSheet');
  await expect(sheet).toHaveAttribute('aria-hidden', 'false');
  await sheet.getByLabel('Name').fill('Storm passes');
  await sheet.getByLabel('Minutes').fill('1');
  await sheet.getByRole('button', { name: /^Start timer/ }).click();
  await expect(sheet).toHaveAttribute('aria-hidden', 'true'); // starting closes the sheet
  await expect(page.locator('#timerList')).toContainText('Storm passes');
  await page.evaluate(() => {
    location.hash = '#home';
  });
  await expect(liveBar(page)).toContainText('Storm passes');
  await page.clock.fastForward('01:05');
  await expect(page.locator('#toastMessage')).toHaveText('Timer done: Storm passes.');
  await expect(liveBar(page)).toContainText(/Storm passes\s*done/);
  const state = await storedState(page);
  expect(state.timers[0]).toMatchObject({ label: 'Storm passes', alerted: true });
  expect(state.session.timersDone).toBe(1);
});

test('timers and the session survive a reload and end in a recap', async ({ page }) => {
  await page.goto('./');
  await holdToStartSession(page);
  await openLiveBar(page);
  await page.getByRole('button', { name: 'Crop timer' }).click();
  const sheet = page.locator('#timerSheet');
  await sheet.getByLabel('Crop').fill('Frostwort');
  await sheet.getByLabel('Minutes').fill('60');
  await sheet.getByRole('button', { name: /Start crop timer/ }).click();
  await page.reload(); // still on the Session screen
  await expect(page.locator('#timerList')).toContainText('Frostwort');
  await page.locator('#sec-session').getByRole('button', { name: 'End session' }).click();
  await expect(page.locator('#sessionRecap')).toContainText('Played');
  expect((await storedState(page)).sessions).toHaveLength(1);
  // An End tapped by mistake is undone from the recap.
  await page.locator('#sec-session').getByRole('button', { name: 'Resume session' }).click();
  await expect(page.locator('#sessionClock')).toBeVisible();
  expect((await storedState(page)).sessions).toHaveLength(0);
});
