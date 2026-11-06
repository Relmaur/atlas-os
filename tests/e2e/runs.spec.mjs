import AxeBuilder from '@axe-core/playwright';
import { test, expect, storedState } from './fixtures.mjs';

test('a run you make is checked against the wiki, estimated, and kept under Yours', async ({ page }) => {
  await page.goto('./#runs');
  await page.getByRole('button', { name: 'New run' }).click();
  const editor = page.getByRole('dialog', { name: 'New run' });
  await editor.getByRole('textbox', { name: 'Name' }).fill('Cryo-Pump loop');
  await editor.getByRole('button', { name: 'Add a step' }).click();
  await editor.getByRole('combobox', { name: 'Step 1: system' }).fill('Ekwa Nexus');
  await expect(editor.locator('#runSteps')).toContainText('your system');
  await editor.getByRole('button', { name: 'Add a step' }).click();
  await editor.getByRole('combobox', { name: 'Step 2 verb' }).selectOption('sell');
  await editor.getByRole('combobox', { name: 'Step 2: item' }).fill('Cryo-Pump');
  await editor.getByRole('spinbutton', { name: 'Sold' }).fill('2');
  // The wiki's value for a Cryo-Pump, from the mirror.
  await expect(editor.locator('#runSteps')).toContainText('1,500,000 Units each');
  await expect(editor.locator('#runEstimate')).toContainText('≈ 3,000,000');
  await expect(editor.locator('#runEstimate')).toContainText(/checked · v\d+\.\d+/);

  const { violations } = await new AxeBuilder({ page }).include('#runEditor').analyze();
  expect(violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);

  await editor.getByRole('button', { name: 'Save run' }).click();
  await expect(editor).toBeHidden();
  await expect(page.locator('#runsYours')).toContainText('≈ 3.0M per run');
  await expect(page.locator('#runsYours')).toContainText(/Works in v\d+\.\d+/);
  const [run] = (await storedState(page)).runs;
  expect(run.steps.map(step => [step.verb, step.target, step.systemId])).toEqual([
    ['go', 'Ekwa Nexus', 'sys-ekwa'],
    ['sell', 'Cryo-Pump', '']
  ]);
  expect(run.checked.values).toEqual({ 'sell:Cryo-Pump': '1500000' });
});

test('d06: Runs on the Workbench at 1024, 1440 and 1920 has no text out of its box and passes axe', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sets its own widths');
  test.setTimeout(90_000);
  for (const [width, height] of [
    [1024, 768],
    [1440, 900],
    [1920, 1080]
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('./#outlaw');
    await expect(page.locator('#sec-outlaw h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const spills = await page.evaluate(() =>
      [...document.querySelectorAll('#sec-runs *, #sec-outlaw *')]
        .filter(el => el instanceof HTMLElement && el.offsetParent && el.scrollWidth > el.clientWidth + 1)
        .filter(el => !['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX))
        .map(el => el.outerHTML.slice(0, 120))
    );
    expect(spills).toEqual([]);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});

test('d07: the run editor panel at 1024, 1440 and 1920 pairs its fields, keeps text in its boxes and passes axe', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sets its own widths');
  test.setTimeout(90_000);
  for (const [width, height] of [
    [1024, 768],
    [1440, 900],
    [1920, 1080]
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('./#runs');
    await page.reload(); // the same hash doesn't reload, and the last width's editor would still be open
    await page.getByRole('button', { name: 'New run' }).click();
    const editor = page.getByRole('dialog', { name: 'New run' });
    await editor.getByRole('button', { name: 'Add a step' }).click();
    const name = await editor.getByRole('textbox', { name: 'Name' }).boundingBox();
    const line = await editor.getByRole('textbox', { name: 'One line about it' }).boundingBox();
    expect(line.y).toBe(name.y);
    expect(line.x).toBeGreaterThan(name.x + name.width);
    const spills = await page.evaluate(() =>
      [...document.querySelectorAll('#runEditor *')]
        .filter(el => el instanceof HTMLElement && el.offsetParent && el.scrollWidth > el.clientWidth + 1)
        .filter(el => !['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX))
        .map(el => el.outerHTML.slice(0, 120))
    );
    expect(spills).toEqual([]);
    const { violations } = await new AxeBuilder({ page }).include('#runEditor').analyze();
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});
