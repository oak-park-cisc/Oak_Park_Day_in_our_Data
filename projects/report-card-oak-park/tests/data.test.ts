// Checks the extract against the parent repo's cached report card CSV
// (oak-park-cisc/Oak_Park_Day_in_our_Data, data/report-card-d97-d200.csv).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Row = { id: string; data: Record<string, (number | string | null)[]> };
const load = (f: string) =>
	JSON.parse(readFileSync(`public/data/${f}`, "utf8")) as { years: number[]; rows: Row[] };
const districts = load("districts.json");
const schools = load("schools.json");
const byId = new Map([...districts.rows, ...schools.rows].map((r) => [r.id, r]));

// Parent CSV column -> our key
const COLUMNS: Record<string, string> = {
	enrollment: "enrollment",
	pct_low_income: "pct_low_income",
	pct_el: "pct_el",
	pct_iep: "pct_iep",
	chronic_absenteeism_pct: "chronic_absenteeism",
	operating_expenditure_per_pupil: "operating_per_pupil",
	instructional_expenditure_per_pupil: "instructional_per_pupil",
	ela_proficiency_pct: "ela_prof",
	math_proficiency_pct: "math_prof",
	science_proficiency_pct: "science_prof",
	grad_rate_4yr_pct: "grad_rate_4yr",
	ninth_grade_on_track_pct: "ninth_on_track",
	teacher_avg_salary: "teacher_salary",
	teacher_retention_rate_pct: "teacher_retention",
	avg_class_size_all_grades: "avg_class_size",
};
const DOLLARS = new Set(["operating_per_pupil", "instructional_per_pupil", "teacher_salary"]);

function parseCsv(text: string) {
	const [head, ...lines] = text.trim().split("\n");
	const cols = head.split(",");
	return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
}

describe("extract matches the parent repo's cached CSV", () => {
	const rows = parseCsv(readFileSync("data/report-card-d97-d200.csv", "utf8"));

	it("has every entity", () => {
		const missing = rows.filter((r) => !byId.has(r.rcdts)).map((r) => `${r.year} ${r.rcdts}`);
		expect(missing).toEqual([]);
	});

	it("matches every overlapping value", () => {
		const mismatches: string[] = [];
		let checked = 0;
		for (const r of rows) {
			const e = byId.get(r.rcdts);
			const i = districts.years.indexOf(Number(r.year));
			for (const [col, key] of Object.entries(COLUMNS)) {
				const ref = r[col] === "" ? null : Number(r[col]);
				const got = e?.data[key]?.[i] ?? null;
				checked++;
				if (ref == null && got == null) continue;
				const tol = DOLLARS.has(key) ? 0.51 : 0.06;
				if (ref == null || typeof got !== "number" || Math.abs(ref - got) > tol)
					mismatches.push(`${r.year} ${r.district_name} ${r.school_name} ${col}: ${ref} vs ${got}`);
			}
		}
		expect(checked).toBe(3000);
		expect(mismatches).toEqual([]);
	});
});

describe("dataset shape", () => {
	it("covers 2018-2025 and every Illinois district", () => {
		expect(districts.years).toEqual([2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
		expect(districts.rows.length).toBeGreaterThan(850);
		for (const r of districts.rows)
			for (const v of Object.values(r.data)) expect(v).toHaveLength(districts.years.length);
	});

	it("has no 2020 test scores (tests were canceled)", () => {
		const i = districts.years.indexOf(2020);
		const with2020 = districts.rows.filter((r) => typeof r.data.ela_prof?.[i] === "number");
		expect(with2020).toEqual([]);
	});
});
