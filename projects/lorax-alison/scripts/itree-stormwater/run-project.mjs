// Loads one exports/itree-stormwater/oak-park-<name>.itr project into the i-Tree Stormwater Calculator
// (stormwater.itreetools.org), steps through its tabs and saves the report tables to /tmp/sw-<name>-tables.json.
// Usage: node scripts/itree-stormwater/run-project.mjs largest-100-part1   (needs Playwright + Chromium)
import { chromium } from "playwright";
import fs from "node:fs";
const name = process.argv[2];
const file = `/home/sprite/project/exports/itree-stormwater/oak-park-${name}.itr`;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 1100 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
let failed = false;
p.on("console", (m) => { if (m.type() === "error") { console.log("console.error", m.text().slice(0, 160)); if (/Group \d+ – failed/.test(m.text())) failed = true; } });
await p.goto("https://stormwater.itreetools.org/app/", { waitUntil: "networkidle" });
await p.click("text=Project");
const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.click("#load-project")]);
await chooser.setFiles(file);
await p.waitForTimeout(8000);
await p.screenshot({ path: `/home/sprite/project/screenshots/sw/${name}-1-loaded.png` });
const trees = await p.$$eval("#tree-rows tr", (rs) => rs.length);
console.log("tree rows:", trees);
for (const tab of ["#location", "#parameters", "#trees"]) {
  await p.click(`a[data-toggle="tab"][href="${tab}"]`); await p.waitForTimeout(1500);
  if (tab === "#location") {
    // re-apply weather year so precipitation is loaded
    await p.selectOption("#id_year", "2019"); await p.waitForTimeout(4000);
  }
  if (tab === "#trees") await p.screenshot({ path: `/home/sprite/project/screenshots/sw/${name}-2-trees.png` });
  await p.click(`${tab} .next`); await p.waitForTimeout(2000);
}
console.log("globals", JSON.stringify(await p.evaluate(() => ({ landUseValue: window.landUseValue, imperviousValue: window.imperviousValue, soilType: window.soilType, huc8: window.huc8, oid: window.oidValue, precip: window.precipitation_inches }))));
const t0 = Date.now();
// wait until report tables have rows and loading modal is gone
for (;;) {
  if (failed) { console.log("RESULT failed"); await b.close(); process.exit(2); }
  const ready = await p.evaluate(() => {
    const busy = document.querySelector(".modal.in, .modal.show");
    return !busy && document.querySelectorAll("#report table tbody tr").length > 10;
  });
  if (ready) break;
  if (Date.now() - t0 > 300000) { console.log("RESULT timeout"); await b.close(); process.exit(3); }
  await p.waitForTimeout(2000);
}
console.log("report ready in", Math.round((Date.now() - t0) / 1000), "s");
await p.waitForTimeout(2000);
await p.screenshot({ path: `/home/sprite/project/screenshots/sw/${name}-3-report.png` });
const tables = await p.$$eval("#report table", (ts) => ts.map((t) => ({
  id: t.id, cls: t.className,
  head: [...t.querySelectorAll("thead tr")].map((r) => [...r.children].map((c) => c.textContent.trim())),
  rows: [...t.querySelectorAll("tbody tr")].map((r) => [...r.children].map((c) => c.textContent.trim())),
})));
fs.writeFileSync(`/tmp/sw-${name}-tables.json`, JSON.stringify(tables, null, 1));
for (const t of tables) console.log(t.id, t.cls, "rows", t.rows.length, JSON.stringify(t.head).slice(0, 300), JSON.stringify(t.rows[0] ?? []).slice(0, 300));
await b.close();
console.log("RESULT ok");
