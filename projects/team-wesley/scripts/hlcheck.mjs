// Checks the Higher-or-Lower flow (map pins, answer reveal) and a tied jury finale.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
const URL = "http://127.0.0.1:5173/";
const b = await chromium.launch();
for (const [tag, vp, mobile, scheme] of [["desk", { width: 1280, height: 800 }, false, "light"], ["p360", { width: 360, height: 740 }, true, "dark"]]) {
	const page = await b.newPage({ viewport: vp, colorScheme: scheme, isMobile: mobile, hasTouch: mobile });
	const errs = [];
	page.on("pageerror", (e) => errs.push(String(e)));
	page.on("console", (m) => m.type() === "error" && !m.text().includes("403") && errs.push(m.text()));
	await page.goto(URL);
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await page.getByText("Start the season").click();
	const has = async (t) => (await page.getByRole("button", { name: t, exact: true }).count()) > 0;
	for (let i = 0; i < 60 && !(await page.getByText("Which home has the higher").count()); i++) {
		await page.waitForTimeout(150);
		if (await has("Go all out (risky)")) { await page.getByRole("button", { name: "Go all out (risky)" }).click(); continue; }
		if (await page.getByText(/^Question \d/).count()) { await page.locator("main .grid button").first().click(); continue; }
		if (await has("Cast your vote")) { await page.locator('input[name="vote"]').first().check(); await page.getByRole("button", { name: "Cast your vote" }).click(); await page.waitForTimeout(200); continue; }
		for (const t of ["Head to the challenge", "See the answers", "Go to Tribal Council", "Continue", "Next episode", "Watch the rest of the season"]) {
			if (await has(t)) { await page.getByRole("button", { name: t, exact: true }).first().click(); break; }
		}
	}
	await page.waitForTimeout(1200);
	await page.screenshot({ path: `screenshots/hl-${tag}-question.png` });
	if (mobile) {
		await page.getByRole("button", { name: "Map", exact: true }).first().click();
		await page.waitForTimeout(1500);
		await page.screenshot({ path: `screenshots/hl-${tag}-map.png` });
		console.log(tag, "house pins:", await page.locator(".op-house").count());
		await page.getByRole("button", { name: "Game" }).click();
	} else console.log(tag, "house pins:", await page.locator(".op-house").count());
	await page.getByRole("button", { name: /Home A/ }).click();
	await page.waitForTimeout(1200);
	await page.screenshot({ path: `screenshots/hl-${tag}-reveal.png` });
	await page.getByRole("button", { name: "Next pair" }).click();
	await page.waitForTimeout(800);
	console.log(tag, "pins after next:", await page.locator(".op-house").count());
	// tied finale
	await page.evaluate((s) => localStorage.setItem("op-survivor-save-v1", s), readFileSync("screenshots/tied-finale.json", "utf8"));
	await page.reload();
	await page.getByRole("button", { name: "Read the jury votes" }).click();
	await page.waitForTimeout(500);
	await page.screenshot({ path: `screenshots/tie-${tag}.png`, fullPage: false });
	const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
	console.log(tag, scheme, over ? "OVERFLOW" : "no overflow", errs.length ? errs : "no errors");
	await page.close();
}
await b.close();
