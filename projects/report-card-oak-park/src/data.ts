export type Unit = "count" | "pct" | "usd" | "ratio" | "rate" | "pts";

export type Indicator = {
	key: string;
	label: string;
	unit: Unit;
	group: string;
	/** Finance columns describe the prior fiscal year. */
	lag?: boolean;
	/** 2025 used new performance levels (and ACT instead of SAT in high school). */
	testBreak?: boolean;
	note?: string;
};

export type Entity = {
	id: string;
	name: string;
	county: string;
	city: string;
	type: "elementary" | "high" | "unit" | "state" | "";
	district_id?: string;
	school_type?: string;
	data: Record<string, (number | string | null)[]>;
};

export type Dataset = { years: number[]; rows: Entity[] };

export const D97 = "060160970020000";
export const D200 = "060162000130000";
export const STATE = "STATE";
export const ANCHORS = [D97, D200];

export const SUGGESTED = [
	"060160900020000", // River Forest SD 90
	"050160650040000", // Evanston CCSD 65
	"050162020170000", // Evanston Twp HSD 202
	"060160980020000", // Berwyn North SD 98
	"060161000020000", // Berwyn South SD 100
	"060160910020000", // Forest Park SD 91
];

export const LATEST_COMPARABLE_TEST_YEAR = 2024;

export const INDICATORS: Indicator[] = [
	{ key: "enrollment", label: "Enrollment", unit: "count", group: "Students" },
	{
		key: "pct_low_income",
		label: "Low-income students",
		unit: "pct",
		group: "Students",
	},
	{ key: "pct_white", label: "White students", unit: "pct", group: "Students" },
	{ key: "pct_black", label: "Black students", unit: "pct", group: "Students" },
	{
		key: "pct_hispanic",
		label: "Hispanic or Latino students",
		unit: "pct",
		group: "Students",
	},
	{ key: "pct_asian", label: "Asian students", unit: "pct", group: "Students" },
	{
		key: "pct_multiracial",
		label: "Multiracial students",
		unit: "pct",
		group: "Students",
	},
	{ key: "pct_el", label: "English learners", unit: "pct", group: "Students" },
	{
		key: "pct_iep",
		label: "Students with an IEP",
		unit: "pct",
		group: "Students",
	},
	{
		key: "pct_homeless",
		label: "Students experiencing homelessness",
		unit: "pct",
		group: "Students",
	},
	{
		key: "mobility_rate",
		label: "Student mobility rate",
		unit: "pct",
		group: "Students",
	},
	{
		key: "attendance_rate",
		label: "Attendance rate",
		unit: "pct",
		group: "Attendance",
		note: "2020 reflects the spring 2020 school closures.",
	},
	{
		key: "chronic_absenteeism",
		label: "Chronic absenteeism",
		unit: "pct",
		group: "Attendance",
		note: "Share of students missing 10% or more of school days. 2020 reflects the spring 2020 school closures.",
	},
	{
		key: "operating_per_pupil",
		label: "Operating spending per pupil",
		unit: "usd",
		group: "Money",
		lag: true,
	},
	{
		key: "instructional_per_pupil",
		label: "Instructional spending per pupil",
		unit: "usd",
		group: "Money",
		lag: true,
	},
	{
		key: "pct_local_property_tax",
		label: "Revenue from local property taxes",
		unit: "pct",
		group: "Money",
		lag: true,
	},
	{
		key: "pct_state_funding",
		label: "Revenue from state funding",
		unit: "pct",
		group: "Money",
		lag: true,
	},
	{
		key: "pct_federal_funding",
		label: "Revenue from federal funding",
		unit: "pct",
		group: "Money",
		lag: true,
	},
	{
		key: "ebf_capacity",
		label: "Funding adequacy (EBF)",
		unit: "pct",
		group: "Money",
		note: "Evidence-Based Funding: the district's resources as a share of what the state formula says it needs. Over 100% means more than adequate.",
	},
	{
		key: "tax_rate",
		label: "School tax rate",
		unit: "rate",
		group: "Taxes",
		note: "Dollars of school tax per $100 of taxable property value (EAV). Each report card shows the rate from three tax years earlier (2025 report card = tax year 2022).",
	},
	{
		key: "local_tax_per_pupil",
		label: "Local property tax per student",
		unit: "usd",
		group: "Taxes",
		lag: true,
		note: "Local property tax revenue divided by enrollment.",
	},
	{
		key: "eav_per_pupil",
		label: "Taxable property per student (EAV)",
		unit: "usd",
		group: "Taxes",
		note: "The district's tax base. Less property per student means a higher rate is needed to raise the same money.",
	},
	{
		key: "teacher_salary",
		label: "Average teacher salary",
		unit: "usd",
		group: "Staff",
	},
	{
		key: "admin_salary",
		label: "Average administrator salary",
		unit: "usd",
		group: "Staff",
	},
	{
		key: "teacher_retention",
		label: "Teacher retention",
		unit: "pct",
		group: "Staff",
	},
	{
		key: "teacher_fte",
		label: "Teachers (full-time equivalent)",
		unit: "count",
		group: "Staff",
	},
	{
		key: "pct_teachers_white",
		label: "White teachers",
		unit: "pct",
		group: "Staff",
	},
	{
		key: "avg_class_size",
		label: "Average class size",
		unit: "ratio",
		group: "Staff",
	},
	{
		key: "pupil_teacher_elem",
		label: "Pupils per teacher (elementary)",
		unit: "ratio",
		group: "Staff",
	},
	{
		key: "pupil_teacher_hs",
		label: "Pupils per teacher (high school)",
		unit: "ratio",
		group: "Staff",
	},
	{
		key: "ela_prof",
		label: "ELA proficiency",
		unit: "pct",
		group: "Test results",
		testBreak: true,
	},
	{
		key: "math_prof",
		label: "Math proficiency",
		unit: "pct",
		group: "Test results",
		testBreak: true,
	},
	{
		key: "science_prof",
		label: "Science proficiency",
		unit: "pct",
		group: "Test results",
		note: "Illinois Science Assessment, grades 5, 8 and high school. Not reported for districts in 2018.",
	},
	{
		key: "ela_gap_wb",
		label: "Reading gap: White vs. Black students",
		unit: "pts",
		group: "Gaps",
		testBreak: true,
		note: "Percentage points between White and Black students' ELA proficiency. Higher means a wider gap.",
	},
	{
		key: "math_gap_wb",
		label: "Math gap: White vs. Black students",
		unit: "pts",
		group: "Gaps",
		testBreak: true,
		note: "Percentage points between White and Black students' math proficiency.",
	},
	{
		key: "ela_prof_white",
		label: "ELA proficiency: White students",
		unit: "pct",
		group: "Gaps",
		testBreak: true,
	},
	{
		key: "ela_prof_black",
		label: "ELA proficiency: Black students",
		unit: "pct",
		group: "Gaps",
		testBreak: true,
	},
	{
		key: "ela_prof_hispanic",
		label: "ELA proficiency: Hispanic students",
		unit: "pct",
		group: "Gaps",
		testBreak: true,
	},
	{
		key: "ela_prof_low_income",
		label: "ELA proficiency: low-income students",
		unit: "pct",
		group: "Gaps",
		testBreak: true,
	},
	{
		key: "math_prof_white",
		label: "Math proficiency: White students",
		unit: "pct",
		group: "Gaps",
		testBreak: true,
	},
	{
		key: "math_prof_black",
		label: "Math proficiency: Black students",
		unit: "pct",
		group: "Gaps",
		testBreak: true,
	},
	{
		key: "math_prof_hispanic",
		label: "Math proficiency: Hispanic students",
		unit: "pct",
		group: "Gaps",
		testBreak: true,
	},
	{
		key: "math_prof_low_income",
		label: "Math proficiency: low-income students",
		unit: "pct",
		group: "Gaps",
		testBreak: true,
	},
	{
		key: "grad_rate_4yr",
		label: "4-year graduation rate",
		unit: "pct",
		group: "High school",
	},
	{
		key: "dropout_rate",
		label: "Dropout rate",
		unit: "pct",
		group: "High school",
	},
	{
		key: "ninth_on_track",
		label: "9th graders on track",
		unit: "pct",
		group: "High school",
	},
];

export const INDICATOR_BY_KEY = Object.fromEntries(INDICATORS.map((i) => [i.key, i]));
export const GROUPS = [...new Set(INDICATORS.map((i) => i.group))];

export async function loadDataset(file: string): Promise<Dataset> {
	const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
	if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`);
	return res.json();
}

export function value(e: Entity | undefined, key: string, yearIndex: number): number | null {
	const v = e?.data[key]?.[yearIndex];
	return typeof v === "number" ? v : null;
}

export function format(v: number | null | undefined, unit: Unit, compact = false): string {
	if (v == null) return "–";
	switch (unit) {
		case "usd":
			if (compact && Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}K`;
			return `$${Math.round(v).toLocaleString("en-US")}`;
		case "pct":
			return `${v.toFixed(1)}%`;
		case "count":
			if (compact && Math.abs(v) >= 10000) return `${(v / 1000).toFixed(1)}K`;
			return Math.round(v).toLocaleString("en-US");
		case "rate":
			return `$${v.toFixed(2)}`;
		case "pts":
			return compact ? v.toFixed(0) : `${v.toFixed(1)} pts`;
		default:
			return v.toFixed(1);
	}
}

export function formatDelta(d: number, unit: Unit): string {
	const sign = d > 0 ? "+" : d < 0 ? "−" : "±";
	const a = Math.abs(d);
	if (unit === "pct") return `${sign}${a.toFixed(1)} pts`;
	if (unit === "usd") return `${sign}$${Math.round(a).toLocaleString("en-US")}`;
	if (unit === "count") return `${sign}${Math.round(a).toLocaleString("en-US")}`;
	if (unit === "rate") return `${sign}$${a.toFixed(2)}`;
	if (unit === "pts") return `${sign}${a.toFixed(1)} pts`;
	return `${sign}${a.toFixed(1)}`;
}

export function yearLabel(year: number, ind: Indicator): string {
	return ind.lag ? `${year} report (FY${year - 1})` : String(year);
}

export function typeLabel(t: Entity["type"]): string {
	return t === "elementary" ? "Elementary" : t === "high" ? "High school" : t === "unit" ? "Unit (K–12)" : "";
}

/**
 * Pick the from/to years for a "then vs now" comparison, honoring the 2025 test
 * break (compare 2024 instead) and falling back to the nearest earlier year
 * with data (2020 had no tests).
 */
export function comparisonYears(
	ind: Indicator,
	e: Entity | undefined,
	years: number[],
	fromYear: number,
	toYear: number,
): { from: number | null; to: number | null } {
	let to = toYear;
	if (ind.testBreak && fromYear < 2025 && to >= 2025) to = LATEST_COMPARABLE_TEST_YEAR;
	const pick = (target: number, min: number) => {
		for (let y = target; y >= min; y--) {
			const i = years.indexOf(y);
			if (i >= 0 && value(e, ind.key, i) != null) return y;
		}
		return null;
	};
	const t = pick(to, fromYear + 1);
	const f = pick(fromYear, years[0]);
	return { from: f, to: t };
}
