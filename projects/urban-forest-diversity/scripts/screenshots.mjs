import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:5173';
const OUT = '.shots';
mkdirSync(OUT, { recursive: true });

const setups = [
  { name: 'phone-360-light', width: 360, height: 740, scheme: 'light' },
  { name: 'phone-390-dark', width: 390, height: 844, scheme: 'dark' },
  { name: 'phone-short-light', width: 390, height: 560, scheme: 'light' },
  { name: 'desktop-light', width: 1280, height: 900, scheme: 'light' },
  { name: 'desktop-dark', width: 1440, height: 900, scheme: 'dark' },
];

const errors = [];

const browser = await chromium.launch();
for (const s of setups) {
  const ctx = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    colorScheme: s.scheme,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[${s.name}] console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[${s.name}] pageerror: ${err.message}`));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/${s.name}-1-initial.png` });

  const phone = s.name.startsWith('phone');
  if (phone) {
    await page.getByRole('button', { name: /Village of Oak Park/ }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${s.name}-2-sheet.png` });
  }

  // select a block via search (keyboard-reachable path)
  await page.getByPlaceholder('Find a street').fill('Elmwood');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${s.name}-3-search.png` });
  await page.locator('#root ul button').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${s.name}-4-block.png` });

  if (phone) {
    // collapse sheet to peek with block selected
    await page.locator('aside button[aria-expanded]').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${s.name}-5-peek.png` });
  } else {
    // click a block directly on the map
    const box = await page.locator('.leaflet-container').boundingBox();
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${s.name}-5-mapclick.png` });
  }

  // switch the map to social vulnerability coloring (block still selected)
  const key = page.locator('details:has(summary:text("Key"))');
  if (!(await key.evaluate((d) => d.open))) await key.locator('summary').click();
  await key.getByText('Vulnerability', { exact: true }).click();
  await page.waitForTimeout(600);
  if (phone) {
    await key.locator('summary').click(); // close the key so the map is visible
    await page.locator('aside button[aria-expanded]').click();
    await page.waitForTimeout(400);
    await page.getByRole('heading', { name: 'Social vulnerability' }).scrollIntoViewIfNeeded();
  }
  await page.screenshot({ path: `${OUT}/${s.name}-6-vulnerability.png` });
  // back to the village view to show the comparison table
  const back = page.getByRole('button', { name: 'Back to village view' }).first();
  if (await back.isVisible()) await back.click();
  await page.waitForTimeout(400);
  await page
    .getByRole('heading', { name: 'Public trees vs social vulnerability' })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/${s.name}-7-village-table.png` });

  // hover a scatter dot for the tooltip
  const dot = page.locator('figure svg circle[fill="transparent"]').nth(10);
  await dot.hover({ force: true });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${s.name}-8-scatter-hover.png` });
  // priority list, then open the first priority block
  const heading = page.getByRole('heading', { name: /Look here first/ });
  await heading.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/${s.name}-9-priority-list.png` });
  await heading.locator('xpath=following-sibling::ul//button').first().click();
  await page.waitForTimeout(1500);
  if (phone) await page.getByRole('heading', { name: 'Social vulnerability' }).waitFor();
  await page.screenshot({ path: `${OUT}/${s.name}-10-priority-block.png` });

  // dashboard tab: unfiltered numbers must match the precomputed village stats
  await page.getByRole('button', { name: 'Dashboard' }).click();
  await page.waitForTimeout(500);
  const dashText = await page.locator('main.overflow-y-auto').innerText();
  for (const want of ['18,837', '208', '336 ac', '14"', '188']) {
    if (!dashText.includes(want)) errors.push(`[${s.name}] dashboard missing ${want}`);
  }
  await page.screenshot({ path: `${OUT}/${s.name}-11-dashboard.png` });
  const dash = page.locator('main.overflow-y-auto');
  // drilldown: genus bar → species bar → size column
  await page.getByRole('button', { name: /^Maple Acer/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Norway Maple/ }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/${s.name}-12-drill-genus.png` });
  await page.getByRole('button', { name: /^Norway Maple/ }).click();
  await page.waitForTimeout(300);
  await page.getByTitle('Filter to 30"+', { exact: true }).click();
  await page.waitForTimeout(300);
  await dash.evaluate((el) => el.scrollTo(0, 0));
  await page.screenshot({ path: `${OUT}/${s.name}-13-drill-species-size.png` });
  // slicer: vulnerability fifth via the filter panel
  await page.getByRole('button', { name: 'Clear all' }).click();
  const filtersBtn = page.getByRole('button', { name: /^Filters/ });
  if ((await filtersBtn.getAttribute('aria-expanded')) !== 'true') await filtersBtn.click();
  await page.locator('#dashboard-slicers').getByLabel('Vulnerability').selectOption('5');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${s.name}-14-slicer.png` });
  await dash.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${s.name}-15-slicer-end.png` });
  const dashOverflow = await dash.evaluate((el) => el.scrollWidth > el.clientWidth);
  if (dashOverflow) errors.push(`[${s.name}] dashboard horizontal overflow`);
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${s.name}-16-back-to-map.png` });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  if (overflow) errors.push(`[${s.name}] horizontal page overflow`);
  await ctx.close();
}
await browser.close();

console.log(errors.length ? `PROBLEMS:\n${errors.join('\n')}` : 'No console errors or overflow.');
console.log('Screenshots written to .shots/');
