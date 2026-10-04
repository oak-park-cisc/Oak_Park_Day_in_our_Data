// Captures the chart images used in docs/presentation.md and the README.
// Each image is taken after clicking the bottom-line card's link, so the
// chart shows the same preset the dashboard uses. Usage (dev server running):
//   node scripts/capture-docs.mjs
import { chromium } from "playwright";

const URL = process.env.APP_URL ?? "http://127.0.0.1:5173";
const OUT = "docs/img";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2, colorScheme: "light" });
const page = await context.newPage();
await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByText("The argument").first().waitFor();

await page.screenshot({ path: `${OUT}/00-overview.png` });

const viaCard = async (card, link, file, nth = 0) => {
	await page.evaluate(() => window.scrollTo(0, 0));
	const summary = page.locator("summary").filter({ hasText: card });
	await summary.click();
	await page.getByRole("button", { name: link }).click();
	await page.mouse.move(0, 0);
	await page.waitForTimeout(700);
	await page.locator("#learn-panel figure").nth(nth).screenshot({ path: `${OUT}/${file}` });
	await summary.click();
};

await viaCard("OPRF delivers", "Compare Cook County high schools", "01-oprf-high-schools.png");
await viaCard("every core subject", "Compare Cook County high schools in math", "01b-oprf-math.png");
await viaCard("D97 math", "See reading and math over time", "02-d97-math.png", 1);
await viaCard("D97 is improving", "Compare Cook County elementary districts", "03-d97-elementary.png");
await viaCard("grown slower", "See taxes and value", "04-tax-rates.png");
await page.mouse.move(0, 0);
await page.locator("#learn-panel figure").nth(1).screenshot({ path: `${OUT}/05-levies.png` });
await viaCard("Chronic absenteeism", "See attendance trends", "06-absenteeism.png", 1);

await browser.close();
console.log("saved images to", OUT);
