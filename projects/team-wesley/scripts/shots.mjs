// Browser check: drives a season at phone/desktop sizes in light and dark, saving screenshots.
import { chromium } from "playwright";
const URL = "http://127.0.0.1:5173/";
const sizes = [
	["p360", 360, 740, true],
	["p390short", 390, 600, true],
	["desk", 1280, 800, false],
];
const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
	for (const [name, width, height, mobile] of sizes) {
		const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, isMobile: mobile, hasTouch: mobile });
		const page = await ctx.newPage();
		const errs = [];
		page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
		page.on("pageerror", (e) => errs.push(String(e)));
		const tag = `${name}-${scheme}`;
		const shot = async (s) => {
			await page.waitForTimeout(400);
			const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
			if (over) errs.push(`horizontal overflow at ${s}`);
			await page.screenshot({ path: `screenshots/${tag}-${s}.png` });
		};
		await page.goto(URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByText("Start the season").waitFor();
		await shot("01-setup");
		if (mobile) { await page.getByRole("button", { name: "Map", exact: true }).last().click(); await page.waitForTimeout(1500); await shot("02-setup-map"); await page.getByRole("button", { name: "Setup" }).click(); }
		await page.getByText("Start the season").click();
		await page.getByText("Head to the challenge").waitFor();
		await shot("03-camp");
		await page.getByRole("button", { name: "Talk" }).click();
		await shot("04-talk");
		await page.locator("ul li button").first().click();
		await page.getByRole("button", { name: "Idol hunt" }).click();
		await shot("05-idol");
		if (mobile) { await page.getByRole("button", { name: "Map", exact: true }).last().click(); await page.waitForTimeout(1500); await shot("06-idol-map"); await page.getByRole("button", { name: "Game" }).click(); }
		await page.getByText("Head to the challenge").click();
		// play through phases for a few steps
		for (let step = 0; step < 40; step++) {
			await page.waitForTimeout(250);
			const has = async (t) => (await page.getByRole("button", { name: t }).count()) > 0;
			if (await has("Go all out (risky)")) { await shot(`10-${step}-physical`); await page.getByRole("button", { name: "Go all out (risky)" }).click(); continue; }
			if (await page.getByText("Which home has the higher").count()) { if (step < 12) await shot(`10-${step}-hl`); await page.getByRole("button", { name: /Home A/ }).click(); continue; }
			if (await page.getByText(/^Question \d/).count()) { await shot(`10-${step}-trivia`); await page.locator("main .grid button").first().click(); continue; }
			if (await has("Cast your vote")) {
				await page.locator('input[name="vote"]').first().check();
				await shot(`10-${step}-tribal`);
				await page.getByRole("button", { name: "Cast your vote" }).click();
				await page.waitForTimeout(3500);
				await shot(`10-${step}-reveal`);
				continue;
			}
			if (await has("Head to the challenge")) { await shot(`10-${step}-camp`); await page.getByRole("button", { name: "Head to the challenge" }).click(); continue; }
			if (await has("Watch the rest of the season")) { await shot(`10-${step}-elim`); await page.getByRole("button", { name: "Watch the rest of the season" }).click(); continue; }
			if (await has("Next episode")) { await shot(`10-${step}-recap`); if (step > 10) break; await page.getByRole("button", { name: "Next episode" }).click(); continue; }
			for (const t of ["See the answers", "Go to Tribal Council", "Continue"]) {
				if (await has(t)) { await shot(`10-${step}-${t.replace(/\s/g, "")}`); await page.getByRole("button", { name: t }).first().click(); break; }
			}
		}
		if (mobile) { await page.getByRole("button", { name: "Cast" }).click(); await shot("20-cast"); await page.getByRole("button", { name: "Map", exact: true }).last().click(); await page.waitForTimeout(1500); await shot("21-map"); }
		else { await page.getByRole("tab", { name: "Cast" }).click(); await shot("20-cast"); }
		console.log(tag, errs.length ? errs : "no errors");
		await ctx.close();
	}
}
await browser.close();
