// Pins every headline number on the page. Expected values were computed
// independently (Python, from the same ISBE files) before the UI existed.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { comparisonYears, type Dataset, format, formatDelta, INDICATOR_BY_KEY } from "../src/data";
import { computeSummary, makeTools } from "../src/findings";

const districts = JSON.parse(readFileSync("public/data/districts.json", "utf8")) as Dataset;
const levies = JSON.parse(readFileSync("public/data/levies.json", "utf8"));
const summary = computeSummary(districts, levies);
const point = (id: string) => {
	const p = summary?.points.find((x) => x.id === id);
	if (!p) throw new Error(`missing point ${id}`);
	return p;
};
const D97 = "060160970020000";
const D200 = "060162000130000";

describe("bottom line", () => {
	it("orders the six points as on the page", () => {
		expect(summary?.points.map((p) => p.id)).toEqual(["oprf", "subjects", "taxes", "d97", "math", "absent"]);
	});

	it("OPRF ranks 2nd of 27 Cook County high school districts in reading (2024)", () => {
		expect(point("oprf").stat).toBe("2nd of 27");
		expect(point("oprf").argument.join(" ")).toContain("about 20 points above");
	});

	it("keeps race out of the bottom line", () => {
		const text = JSON.stringify(summary);
		expect(text).not.toMatch(/White|Black|Hispanic|racial/);
	});

	it("'Where we stand' holds the two OPRF strengths and spending restraint", () => {
		expect(summary?.points.filter((p) => p.group === "stand").map((p) => p.id)).toEqual([
			"oprf",
			"subjects",
			"taxes",
		]);
	});

	it("OPRF is top 3 of 27 Cook County high schools in reading, math, science and graduation", () => {
		const p = point("subjects");
		expect(p.stat).toBe("Top 3");
		const text = p.argument.join(" ");
		expect(text).toContain("Reading: 64%, 2nd of 27");
		expect(text).toContain("Math: 55%, 3rd of 27");
		expect(text).toContain("Science: 72%, 3rd of 27");
		expect(text).toContain("Graduation rate: 97%, 3rd of 27");
		expect(p.link).toMatchObject({ tab: "scatter", y: "math_prof", type: "high", year: 2024 });
	});

	it("D97 math rose 43% -> 45% while reading rose 13 points; still climbed in Cook County", () => {
		const p = point("math");
		expect(p.stat).toBe("43% → 45%");
		expect(p.argument.join(" ")).toContain("Math rose 2 points; reading rose 13 points");
		expect(p.counter).toContain("from 42nd to 28th");
		expect(p.link).toMatchObject({ tab: "trends", group: "Test results" });
	});

	it("OPRF's link shows tax rate vs. reading for Cook County high schools, matching the claim", () => {
		const p = point("oprf");
		expect(p.link).toMatchObject({ tab: "scatter", x: "tax_rate", y: "ela_prof", type: "high", year: 2024 });
		expect(p.link.note).toContain("$3.04 per $100");
		expect(p.link.note).toContain("All 14 districts with a higher rate score lower");
		expect(p.link.note).toContain("Only New Trier scores higher, at a lower rate.");
		expect(p.argument.join(" ")).toContain("ranks 15th of 27 (median $3.18)");
	});

	it("D97 reading rose 42% -> 55% and ranks 22nd of 25 similar districts", () => {
		const p = point("d97");
		expect(p.stat).toBe("42% → 55%");
		expect(p.argument.join(" ")).toContain("ranks 22nd");
	});

	it("spending grew slower than the state's (OPRF +7%, D97 +40%, Illinois +46%); rate still $8.37, 3rd of 11", () => {
		const p = point("taxes");
		expect(p.stat).toBe("+7% / +40%");
		expect(p.statLabel).toContain("Illinois: +46%");
		const text = p.argument.join(" ");
		expect(text).toContain("$8.37 per $100 (3rd of 11 nearby towns)");
		expect(text).toContain("near the Cook County median (56th of 114)");
		expect(p.counter).toContain("rose 74% (D97) and 34% (D200) since 2015");
	});

	it("D97 chronic absenteeism rose 8% -> 14%", () => {
		expect(point("absent").stat).toBe("8% → 14%");
	});

	it("every card links somewhere with a note", () => {
		for (const p of summary?.points ?? []) expect(p.link.note?.length ?? 0).toBeGreaterThan(20);
	});
});

describe("supporting statistics", () => {
	const { cook, relation, rank, g } = makeTools(districts);
	const elem = cook("elementary");

	it("spending barely predicts reading scores across Cook County elementary districts; poverty does", () => {
		expect(Math.abs(relation(elem, "operating_per_pupil", "ela_prof", 2024).r)).toBeLessThan(0.2);
		expect(relation(elem, "pct_low_income", "ela_prof", 2024).r).toBeLessThan(-0.7);
	});

	it("ranks D97 among Cook County elementary districts on local tax and spending", () => {
		expect(rank(elem, D97, "local_tax_per_pupil", 2025).rank).toBe(39);
		expect(rank(elem, D97, "operating_per_pupil", 2025).rank).toBe(56);
	});

	it("uses report-card values for the districts", () => {
		expect(
			g(
				districts.rows.find((r) => r.id === D200),
				"grad_rate_4yr",
				2025,
			),
		).toBe(96.8);
	});
});

describe("comparison rules", () => {
	const d97 = districts.rows.find((r) => r.id === D97);

	it("stops test comparisons at 2024 because 2025 used a new scale", () => {
		expect(comparisonYears(INDICATOR_BY_KEY.ela_prof, d97, districts.years, 2020, 2025)).toEqual({
			from: 2019, // 2020 had no tests
			to: 2024,
		});
	});

	it("keeps non-test measures through 2025", () => {
		expect(comparisonYears(INDICATOR_BY_KEY.enrollment, d97, districts.years, 2020, 2025)).toEqual({
			from: 2020,
			to: 2025,
		});
	});

	it("formats values and changes", () => {
		expect(format(20214, "usd")).toBe("$20,214");
		expect(format(5.14, "rate")).toBe("$5.14");
		expect(format(39.3, "pts")).toBe("39.3 pts");
		expect(formatDelta(-1.234, "pct")).toBe("−1.2 pts");
		expect(format(null, "pct")).toBe("–");
	});
});
