// Headless browser check: screenshots each tab at phone and desktop sizes in both
// color schemes and logs console errors. Usage: node scripts/screenshots.mjs [tab...]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const URL = process.env.APP_URL ?? "http://127.0.0.1:5173";
const OUT = "screenshots";
const TABS = process.argv.slice(2).length
	? process.argv.slice(2)
	: ["Priorities", "Taxes & value", "Trends", "Cook County", "Schools", "Map"];
const VIEWPORTS = [
	{ name: "phone360", width: 360, height: 740, mobile: true },
	{ name: "phone390", width: 390, height: 844, mobile: true },
	{ name: "desktop", width: 1280, height: 900, mobile: false },
];
const SCHEMES = ["light", "dark"];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let problems = 0;
for (const vp of VIEWPORTS) {
	for (const scheme of SCHEMES) {
		const ctx = await browser.newContext({
			viewport: { width: vp.width, height: vp.height },
			colorScheme: scheme,
			isMobile: vp.mobile,
			hasTouch: vp.mobile,
			deviceScaleFactor: vp.mobile ? 2 : 1,
		});
		const page = await ctx.newPage();
		page.on("console", (m) => {
			if (m.type() === "error" || m.type() === "warning") {
				problems++;
				console.log(`[${vp.name}/${scheme}] console.${m.type()}: ${m.text()}`);
			}
		});
		page.on("pageerror", (e) => {
			problems++;
			console.log(`[${vp.name}/${scheme}] pageerror: ${e.message}`);
		});
		await page.goto(URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByRole("tab", { name: "Taxes & value" }).waitFor();
		for (const tab of TABS) {
			await page.getByRole("tab", { name: tab }).click();
			await page.waitForTimeout(400);
			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
			if (overflow > 0) {
				problems++;
				console.log(`[${vp.name}/${scheme}] ${tab}: page overflows horizontally by ${overflow}px`);
			}
			const slug = tab.toLowerCase().replace(/[^a-z]+/g, "-");
			await page.screenshot({ path: `${OUT}/${vp.name}-${scheme}-${slug}.png`, fullPage: true });
		}
		await ctx.close();
	}
}
await browser.close();
console.log(problems ? `${problems} problem(s)` : "no console errors or overflow");
