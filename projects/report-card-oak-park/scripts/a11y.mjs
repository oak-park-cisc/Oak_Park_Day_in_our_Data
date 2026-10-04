// Automated accessibility scan (axe-core, WCAG 2.1 A/AA) of every view.
// Usage: node scripts/a11y.mjs   (with the dev server running)
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const URL = process.env.APP_URL ?? "http://127.0.0.1:5173";
const VIEWS = ["Priorities", "Taxes & value", "Trends", "Cook County", "Schools", "Map"];
const browser = await chromium.launch();
const found = new Map();
for (const scheme of ["light", "dark"]) {
	for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
		const context = await browser.newContext({ viewport, colorScheme: scheme });
		const page = await context.newPage();
		await page.goto(URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByRole("tab", { name: VIEWS[0] }).waitFor();
		await page.locator("summary").first().click();
		await page.locator("#about summary").click();
		for (const view of VIEWS) {
			await page.getByRole("tab", { name: view }).click();
			await page.waitForTimeout(300);
			const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
			for (const v of violations)
				for (const n of v.nodes) {
					const key = `${scheme} ${v.id}: ${n.target.join(" ")}`;
					if (!found.has(key)) found.set(key, `[${scheme} ${viewport.width}px ${view}] ${v.impact} ${v.id} — ${v.help}\n    ${n.target.join(" ")}\n    ${n.failureSummary?.split("\n").slice(1, 2).join(" ")}`);
				}
		}
		await context.close();
	}
}
await browser.close();
console.log(found.size ? [...found.values()].join("\n") : "No WCAG 2.1 A/AA violations found.");
console.log(`${found.size} issue(s)`);
