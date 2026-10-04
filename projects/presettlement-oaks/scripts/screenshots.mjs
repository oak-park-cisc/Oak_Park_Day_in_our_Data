// Headless checks: phone and desktop, light and dark. Saves to screenshots/ (git-ignored).
import { chromium } from "playwright";

const URL = process.env.APP_URL ?? "http://127.0.0.1:5173/";
const sizes = [
	["phone360", { width: 360, height: 740 }],
	["phone390-short", { width: 390, height: 600 }],
	["desktop", { width: 1280, height: 800 }],
];
const browser = await chromium.launch();
const errors = [];
for (const scheme of ["light", "dark"]) {
	for (const [name, viewport] of sizes) {
		const page = await browser.newPage({
			viewport,
			colorScheme: scheme,
			hasTouch: name.startsWith("phone"),
		});
		page.on(
			"console",
			(m) =>
				m.type() === "error" && errors.push(`${name}/${scheme}: ${m.text()}`),
		);
		page.on("pageerror", (e) => errors.push(`${name}/${scheme}: ${e.message}`));
		await page.goto(URL, { waitUntil: "networkidle" });
		await page.waitForSelector(".oak-marker");
		await page.waitForTimeout(800);
		const shot = (s) =>
			page.screenshot({ path: `screenshots/${name}-${scheme}-${s}.png` });
		await shot("1-map");
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth,
		);
		if (overflow) errors.push(`${name}/${scheme}: horizontal overflow`);
		// Open the list, pick the first tree (opens popup), then More.
		await page.getByRole("button", { name: "Tree list" }).click();
		await page.waitForTimeout(300);
		await shot("2-list");
		await page
			.locator("section[aria-label$='candidate oaks'] li button")
			.first()
			.click();
		await page.waitForTimeout(1200);
		await shot("3-popup");
		await page.getByRole("button", { name: "More" }).click();
		await page.waitForTimeout(400);
		await shot("4-details");
		await page.getByRole("button", { name: "About this map" }).click();
		await page.waitForTimeout(300);
		await shot("5-about");
		await page.close();
	}
}
await browser.close();
console.log(errors.length ? errors.join("\n") : "no console errors");
