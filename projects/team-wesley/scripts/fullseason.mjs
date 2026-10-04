// Plays one Short season to the end at phone size, screenshotting the finale and results.
import { chromium } from "playwright";
const scheme = process.argv[2] ?? "light";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await page.goto("http://127.0.0.1:5173/");
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByRole("button", { name: /^Short/ }).click();
await page.getByText("Start the season").click();
const has = async (t) => (await page.getByRole("button", { name: t, exact: true }).count()) > 0;
for (let i = 0; i < 400; i++) {
	await page.waitForTimeout(120);
	if (await has("Start a new season") && !(await has("Watch the rest of the season"))) break;
	if (await page.getByText("Final Tribal Council").count() && (await has("Read the jury votes"))) {
		const r = page.locator('input[name="pitch"], input[name="jury"]');
		if (await r.count()) await r.first().check();
		await page.screenshot({ path: `screenshots/full-${scheme}-finale.png` });
		await page.getByRole("button", { name: "Read the jury votes" }).click();
		continue;
	}
	if (await has("Go all out (risky)")) { await page.getByRole("button", { name: "Go all out (risky)" }).click(); continue; }
	if (await page.getByText("Which home has the higher").count()) { await page.getByRole("button", { name: /Home B/ }).click(); continue; }
	if (await page.getByText(/^Question \d/).count()) { await page.locator("main .grid button").nth(1).click(); continue; }
	if (await has("Cast your vote")) { await page.locator('input[name="vote"]').last().check(); await page.getByRole("button", { name: "Cast your vote" }).click(); await page.waitForTimeout(300); continue; }
	if (await has("Watch the rest of the season")) { await page.screenshot({ path: `screenshots/full-${scheme}-elim.png` }); await page.getByRole("button", { name: "Watch the rest of the season" }).click(); continue; }
	for (const t of ["Head to the challenge", "See the answers", "Go to Tribal Council", "Continue", "Next episode", "Go to the Final Tribal Council"]) {
		if (await has(t)) { await page.getByRole("button", { name: t, exact: true }).first().click(); break; }
	}
}
await page.screenshot({ path: `screenshots/full-${scheme}-done.png`, fullPage: false });
// reload resumes the saved season
await page.reload();
await page.getByText(/Sole Survivor/).waitFor({ timeout: 5000 }).then(() => console.log("resume OK"), () => errs.push("resume failed"));
console.log(scheme, errs.length ? errs : "no errors");
await b.close();
