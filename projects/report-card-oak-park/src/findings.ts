import { D97, D200, type Dataset, type Entity, STATE, value } from "./data";

/** Where a card's link goes, with the settings that make its point. */
export type FindingLink = (
	| { tab: "trends"; group: string }
	| { tab: "taxes" }
	| { tab: "scatter"; x: string; y: string; type: string; year: number }
) & {
	/** Comparison districts to show besides D97 and D200. */
	extras?: string[];
	/** What to look for, shown above the chart. */
	note?: string;
};

export type Point = {
	id: string;
	group: "stand" | "improve";
	claim: string;
	stat: string;
	statLabel: string;
	argument: string[];
	counter: string;
	link: FindingLink;
	linkLabel: string;
};

export type Summary = {
	points: Point[];
	alsoNotable: string[];
	questions: string[];
};

export type LevyRow = { tax_year: number; extension: number };

// Elementary + high school district pairs that make up each community's school tax.
export const COMMUNITIES = [
	{ name: "Oak Park", elem: D97, high: D200 },
	{ name: "River Forest", elem: "060160900020000", high: D200 },
	{ name: "Forest Park", elem: "060160910020000", high: "060162090170000" },
	{ name: "Berwyn (south)", elem: "060161000020000", high: "060162010170000" },
	{ name: "Berwyn (north)", elem: "060160980020000", high: "060162010170000" },
	{ name: "Riverside", elem: "060160960020000", high: "060162080170000" },
	{ name: "La Grange", elem: "060161020020000", high: "060162040170000" },
	{ name: "Western Springs", elem: "060161010020000", high: "060162040170000" },
	{ name: "Park Ridge", elem: "050160640040000", high: "050162070170000" },
	{ name: "Evanston", elem: "050160650040000", high: "050162020170000" },
	{ name: "Wilmette", elem: "050160390020000", high: "050162030170000" },
];

/** Last pre-pandemic test year and last year on the old test scale. */
export const T0 = 2019;
export const T1 = 2024;

export const PEERS = {
	RF90: "060160900020000",
	EV65: "050160650040000",
	RS96: "060160960020000",
	LG102: "060161020020000",
	EV202: "050162020170000",
	NT203: "050162030170000",
	LT204: "060162040170000",
	RB208: "060162080170000",
	P209: "060162090170000",
};

const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v)}%`);
const usd = (v: number | null) => (v == null ? "–" : `$${Math.round(v).toLocaleString("en-US")}`);
export const ordinal = (n: number) => {
	const s = ["th", "st", "nd", "rd"];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function linearFit(xs: number[], ys: number[]) {
	const n = xs.length;
	const mx = xs.reduce((a, b) => a + b, 0) / n;
	const my = ys.reduce((a, b) => a + b, 0) / n;
	let sxy = 0;
	let sxx = 0;
	let syy = 0;
	for (let i = 0; i < n; i++) {
		sxy += (xs[i] - mx) * (ys[i] - my);
		sxx += (xs[i] - mx) ** 2;
		syy += (ys[i] - my) ** 2;
	}
	const b = sxy / sxx;
	return { predict: (x: number) => my - b * mx + b * x, r: sxy / Math.sqrt(sxx * syy) };
}

/** Tools for ranking and comparing districts in one report card year. */
export function makeTools(ds: Dataset) {
	const years = ds.years;
	const byId = new Map(ds.rows.map((r) => [r.id, r]));
	const g = (e: Entity | undefined, k: string, y: number) => value(e, k, years.indexOf(y));
	const cook = (type: string) => ds.rows.filter((r) => r.county === "Cook" && r.type === type);
	const rank = (pool: Entity[], id: string, k: string, y: number) => {
		const sorted = pool
			.filter((r) => g(r, k, y) != null)
			.sort((a, b) => (g(b, k, y) ?? 0) - (g(a, k, y) ?? 0));
		const vals = sorted.map((r) => g(r, k, y) ?? 0);
		return {
			rank: sorted.findIndex((r) => r.id === id) + 1,
			of: sorted.length,
			median: vals[vals.length >> 1],
		};
	};
	const relation = (pool: Entity[], xk: string, yk: string, y: number) => {
		const pts = pool.filter((r) => g(r, xk, y) != null && g(r, yk, y) != null);
		return linearFit(
			pts.map((r) => g(r, xk, y) ?? 0),
			pts.map((r) => g(r, yk, y) ?? 0),
		);
	};
	const communities = (y: number) =>
		COMMUNITIES.map((c) => {
			const e = byId.get(c.elem);
			const h = byId.get(c.high);
			const er = g(e, "tax_rate", y);
			const hr = g(h, "tax_rate", y);
			return { ...c, e, h, er, hr, total: er != null && hr != null ? er + hr : null };
		})
			.filter((c) => c.total != null)
			.sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
	return { years, byId, g, cook, rank, relation, communities };
}

/** Computed from the loaded data so the numbers always match the charts. */
export function computeSummary(
	ds: Dataset,
	levies?: Record<"D97" | "D200", LevyRow[]> | null,
): Summary | null {
	const { years, byId, g, cook, rank, relation, communities } = makeTools(ds);
	const d97 = byId.get(D97);
	const d200 = byId.get(D200);
	const il = byId.get(STATE);
	const rf = byId.get("060160900020000");
	const ev65 = byId.get("050160650040000");
	if (!d97 || !d200 || !il) return null;
	const NOW = years[years.length - 1];
	const elem = cook("elementary");
	const high = cook("high");
	const pts = (v: number) => `${Math.round(Math.abs(v))} points`;

	// OPRF
	const hsRank = rank(high, D200, "ela_prof", T1);
	const hsMath = rank(high, D200, "math_prof", T1);
	const hsAbove =
		(g(d200, "ela_prof", T1) ?? 0) -
		relation(high, "pct_low_income", "ela_prof", T1).predict(g(d200, "pct_low_income", T1) ?? 0);
	// Tax rate and spending in the same report card year as the test ranking, to match the chart.
	const hsRate = rank(high, D200, "tax_rate", T1);
	const hsSpend = rank(high, D200, "operating_per_pupil", T1);
	const d200Rate = g(d200, "tax_rate", T1) ?? 0;
	const d200Ela = g(d200, "ela_prof", T1) ?? 0;
	const pricier = high.filter((r) => (g(r, "tax_rate", T1) ?? 0) > d200Rate && g(r, "ela_prof", T1) != null);
	const pricierBest = Math.max(...pricier.map((r) => g(r, "ela_prof", T1) ?? 0));
	const above = high.filter((r) => (g(r, "ela_prof", T1) ?? 0) > d200Ela);
	const aboveNote =
		above.length === 0
			? "No Cook County high school scores higher."
			: above.length === 1
				? `Only ${above[0].name.replace(/ Twp HSD \d+$/, "")} scores higher, at a ${(g(above[0], "tax_rate", T1) ?? 0) < d200Rate ? "lower" : "higher"} rate.`
				: `${above.length} districts score higher.`;

	// OPRF across core subjects (tests in the same year as the reading ranking)
	const subjects = (
		[
			["Reading", "ela_prof", T1],
			["Math", "math_prof", T1],
			["Science", "science_prof", T1],
			["Graduation rate", "grad_rate_4yr", NOW],
		] as const
	).map(([label, key, y]) => ({
		label,
		key,
		y,
		...rank(high, D200, key, y),
		v: g(d200, key, y),
		il: g(il, key, y),
	}));
	const worstSubjectRank = Math.max(...subjects.map((r) => r.rank));
	const liReading = rank(high, D200, "ela_prof_low_income", T1);
	const liMath = rank(high, D200, "math_prof_low_income", T1);
	const liShare = rank(high, D200, "pct_low_income", T1);

	// D97 scores
	const r19 = rank(elem, D97, "ela_prof", T0);
	const r24 = rank(elem, D97, "ela_prof", T1);
	const lowPov = elem.filter((r) => (g(r, "pct_low_income", T1) ?? 100) <= 25);
	const peerRank = rank(lowPov, D97, "ela_prof", T1);
	const vsExpected = (y: number) =>
		(g(d97, "ela_prof", y) ?? 0) -
		relation(elem, "pct_low_income", "ela_prof", y).predict(g(d97, "pct_low_income", y) ?? 0);
	const e19 = vsExpected(T0);
	const e24 = vsExpected(T1);

	// D97 math
	const m19 = rank(elem, D97, "math_prof", T0);
	const m24 = rank(elem, D97, "math_prof", T1);
	const mathPeer = rank(lowPov, D97, "math_prof", T1);
	const d97MathGain = (g(d97, "math_prof", T1) ?? 0) - (g(d97, "math_prof", T0) ?? 0);
	const d97ReadGain = (g(d97, "ela_prof", T1) ?? 0) - (g(d97, "ela_prof", T0) ?? 0);
	const ilMathGain = (g(il, "math_prof", T1) ?? 0) - (g(il, "math_prof", T0) ?? 0);

	// Taxes
	const comm = communities(NOW);
	const opIdx = comm.findIndex((c) => c.name === "Oak Park");
	const spendRank = rank(elem, D97, "operating_per_pupil", NOW);
	const levyGrowth = (k: "D97" | "D200") => {
		const rows = levies?.[k] ?? [];
		const a = rows.find((r) => r.tax_year === 2015);
		const b = rows[rows.length - 1];
		return a && b ? Math.round(((b.extension - a.extension) / a.extension) * 100) : null;
	};
	// Spending growth per student between the T0 and latest report cards (fiscal years one earlier)
	const spendGrowth = (e: Entity | undefined) => {
		const a = g(e, "operating_per_pupil", T0);
		const b = g(e, "operating_per_pupil", NOW);
		return a && b ? ((b - a) / a) * 100 : 0;
	};
	const instShare = (e: Entity | undefined) =>
		((g(e, "instructional_per_pupil", NOW) ?? 0) / (g(e, "operating_per_pupil", NOW) ?? 1)) * 100;
	const elemShares = elem
		.filter((r) => g(r, "instructional_per_pupil", NOW) && g(r, "operating_per_pupil", NOW))
		.map(instShare)
		.sort((a, b) => a - b);
	const medianShare = elemShares[elemShares.length >> 1];
	const sg97 = spendGrowth(d97);
	const sg200 = spendGrowth(d200);
	const sgIl = spendGrowth(il);
	const lg97 = levyGrowth("D97");
	const lg200 = levyGrowth("D200");

	const rSpend = relation(elem, "operating_per_pupil", "ela_prof", T1).r;
	const rPov = relation(elem, "pct_low_income", "ela_prof", T1).r;
	const Y0 = years[0];
	const enr0 = g(d97, "enrollment", Y0) ?? 0;
	const enr1 = g(d97, "enrollment", NOW) ?? 0;

	return {
		points: [
			{
				id: "oprf",
				group: "stand",
				claim: "OPRF delivers top results for a middle-of-the-road tax rate.",
				stat: `${ordinal(hsRank.rank)} of ${hsRank.of}`,
				statLabel: `Cook County high school districts in reading, ${T1}`,
				argument: [
					`${pct(g(d200, "ela_prof", T1))} of OPRF students were proficient in reading in ${T1}, ${ordinal(hsRank.rank)} of ${hsRank.of} Cook County high school districts (${ordinal(hsMath.rank)} in math).`,
					`That is about ${pts(hsAbove)} above what its share of low-income students (${pct(g(d200, "pct_low_income", T1))}) predicts.`,
					`Its school tax rate in the ${T1} report card, $${d200Rate.toFixed(2)} per $100, ranks ${ordinal(hsRate.rank)} of ${hsRate.of} (median $${hsRate.median?.toFixed(2)}); spending per student ranks ${ordinal(hsSpend.rank)}.`,
					`The 4-year graduation rate is ${pct(g(d200, "grad_rate_4yr", NOW))}, against ${pct(g(il, "grad_rate_4yr", NOW))} statewide.`,
				],
				counter: `OPRF has fewer low-income students (${pct(g(d200, "pct_low_income", T1))}) than most Cook County high schools (median ${pct(liShare.median)}), which tends to lift scores. It still scores well above the trend for its share.`,
				link: {
					tab: "scatter",
					x: "tax_rate",
					y: "ela_prof",
					type: "high",
					year: T1,
					extras: [PEERS.NT203, PEERS.EV202, PEERS.RB208, PEERS.P209],
					note: `Find OPRF D200: its school tax rate ($${d200Rate.toFixed(2)} per $100) sits near the Cook County median ($${hsRate.median?.toFixed(2)}), yet ${pct(d200Ela)} of its students read proficiently. ${pricier.length === 0 ? "No district charges more." : pricierBest < d200Ela ? `All ${pricier.length} districts with a higher rate score lower (best: ${pct(pricierBest)}).` : `Some districts with a higher rate score higher.`} ${aboveNote}`,
				},
				linkLabel: "Compare Cook County high schools",
			},
			{
				id: "subjects",
				group: "stand",
				claim: "OPRF ranks in the top 3 of Cook County in every core subject.",
				stat: `Top ${worstSubjectRank}`,
				statLabel: `of ${subjects[0].of} Cook County high schools in reading, math, science and graduation rate`,
				argument: [
					...subjects.map(
						(r) =>
							`${r.label}: ${pct(r.v)}, ${ordinal(r.rank)} of ${r.of} (Illinois: ${pct(r.il)}${r.y !== T1 ? `, ${r.y}` : ""}).`,
					),
					`Low-income students do well too: ${pct(g(d200, "ela_prof_low_income", T1))} are proficient in reading, ${ordinal(liReading.rank)} of ${liReading.of} (Illinois: ${pct(g(il, "ela_prof_low_income", T1))}).`,
				],
				counter: `Low-income students' math ranks lower, ${ordinal(liMath.rank)} of ${liMath.of} (${pct(g(d200, "math_prof_low_income", T1))} proficient).`,
				link: {
					tab: "scatter",
					x: "pct_low_income",
					y: "math_prof",
					type: "high",
					year: T1,
					extras: [PEERS.NT203, PEERS.EV202, PEERS.RB208, PEERS.P209],
					note: `This chart shows math. Find OPRF D200: ${pct(g(d200, "math_prof", T1))} of its students are proficient, ${ordinal(subjects[1].rank)} of ${subjects[1].of} Cook County high schools and well above the trend line for its share of low-income students.`,
				},
				linkLabel: "Compare Cook County high schools in math",
			},
			{
				id: "taxes",
				group: "stand",
				claim:
					"Oak Park's school spending has grown slower than the state's; the high tax rate comes from a small tax base.",
				stat: `+${Math.round(sg200)}% / +${Math.round(sg97)}%`,
				statLabel: `spending per student, OPRF / D97, FY${T0 - 1}–FY${NOW - 1} (Illinois: +${Math.round(sgIl)}%)`,
				argument: [
					`Spending per student: OPRF ${usd(g(d200, "operating_per_pupil", T0))} → ${usd(g(d200, "operating_per_pupil", NOW))} (+${Math.round(sg200)}%); D97 ${usd(g(d97, "operating_per_pupil", T0))} → ${usd(g(d97, "operating_per_pupil", NOW))} (+${Math.round(sg97)}%); Illinois average +${Math.round(sgIl)}%.`,
					`D97 spends near the Cook County median (${ordinal(spendRank.rank)} of ${spendRank.of}) and puts ${pct(instShare(d97))} of it into instruction (Cook County median: ${pct(medianShare)}).`,
					`The combined school tax rate is still high, $${comm[opIdx]?.total?.toFixed(2)} per $100 (${ordinal(opIdx + 1)} of ${comm.length} nearby towns), because D97 has ${usd(g(d97, "eav_per_pupil", NOW))} of taxable property per student vs. ${usd(g(ev65, "eav_per_pupil", NOW))} in Evanston 65, and the state covers only ${pct(g(d97, "pct_state_funding", NOW))} of its revenue.`,
				],
				counter:
					lg97 != null && lg200 != null
						? `Taxpayers still feel it: school taxes billed rose ${lg97}% (D97) and ${lg200}% (D200) since 2015, not adjusted for inflation. A rate is not a bill; home values and exemptions decide what each household pays.`
						: "A rate is not a bill: home values and exemptions decide what each household pays.",
				link: {
					tab: "taxes",
					note: `Oak Park's combined school tax rate is ${ordinal(opIdx + 1)} highest of ${comm.length} nearby towns, but the table further down shows why: D97 has relatively little taxable property per student and spends near the Cook County median.`,
				},
				linkLabel: "See taxes and value",
			},
			{
				id: "d97",
				group: "improve",
				claim: "D97 is improving faster than the state, but still trails towns like it.",
				stat: `${pct(g(d97, "ela_prof", T0))} → ${pct(g(d97, "ela_prof", T1))}`,
				statLabel: `D97 students proficient in reading, ${T0}–${T1}`,
				argument: [
					`D97 gained ${pts((g(d97, "ela_prof", T1) ?? 0) - (g(d97, "ela_prof", T0) ?? 0))} in reading; the Illinois average gained ${pts((g(il, "ela_prof", T1) ?? 0) - (g(il, "ela_prof", T0) ?? 0))}.`,
					`Among ${r24.of} Cook County elementary districts, it moved from ${ordinal(r19.rank)} to ${ordinal(r24.rank)}.`,
					`Compared with districts with a similar share of low-income students, it went from ${pts(e19)} ${e19 < 0 ? "below" : "above"} the expected level to ${pts(e24)} ${e24 < 0 ? "below" : "above"}.`,
					`Yet among the ${peerRank.of} Cook County districts with 25% or fewer low-income students, it ranks ${ordinal(peerRank.rank)}. River Forest 90, next door, is at ${pct(g(rf, "ela_prof", T1))}.`,
				],
				counter: `Math moved less: ${pct(g(d97, "math_prof", T0))} → ${pct(g(d97, "math_prof", T1))}.`,
				link: {
					tab: "scatter",
					x: "pct_low_income",
					y: "ela_prof",
					type: "elementary",
					year: T1,
					extras: [PEERS.RF90, PEERS.RS96, PEERS.LG102, PEERS.EV65],
					note: `Find Oak Park D97 (${pct(g(d97, "pct_low_income", T1))} low-income): nearby districts with similar or fewer low-income students, like River Forest 90 and Riverside 96, score higher. D97 sits ${pts(e24)} ${e24 < 0 ? "below" : "above"} the trend line.`,
				},
				linkLabel: "Compare Cook County elementary districts",
			},
			{
				id: "math",
				group: "improve",
				claim: "D97 math has barely moved while reading took off.",
				stat: `${pct(g(d97, "math_prof", T0))} → ${pct(g(d97, "math_prof", T1))}`,
				statLabel: `D97 students proficient in math, ${T0}–${T1}`,
				argument: [
					`Math rose ${pts(d97MathGain)}; reading rose ${pts(d97ReadGain)} over the same years.`,
					`Among the ${mathPeer.of} Cook County districts with 25% or fewer low-income students, D97 ranks ${ordinal(mathPeer.rank)} in math.`,
					`River Forest 90, next door: ${pct(g(rf, "math_prof", T1))} proficient in math vs. D97's ${pct(g(d97, "math_prof", T1))}.`,
				],
				counter: `Illinois math ${ilMathGain < 0 ? "fell" : "rose"} ${pts(ilMathGain)} over the same years, so D97 still climbed from ${ordinal(m19.rank)} to ${ordinal(m24.rank)} among Cook County elementary districts.`,
				link: {
					tab: "trends",
					group: "Test results",
					extras: [PEERS.RF90, PEERS.RS96, PEERS.LG102, PEERS.EV65],
					note: `Compare the reading and math charts: D97's reading line climbs after 2022, while its math line stays nearly flat at ${pct(g(d97, "math_prof", T1))}, below River Forest 90, Riverside 96 and La Grange 102.`,
				},
				linkLabel: "See reading and math over time",
			},
			{
				id: "absent",
				group: "improve",
				claim: "Chronic absenteeism has nearly doubled in D97.",
				stat: `${pct(g(d97, "chronic_absenteeism", T0))} → ${pct(g(d97, "chronic_absenteeism", NOW))}`,
				statLabel: `D97 students missing 10% or more of school days, ${T0}–${NOW}`,
				argument: [
					`${pct(g(d97, "chronic_absenteeism", T0))} of D97 students were chronically absent in ${T0}; ${pct(g(d97, "chronic_absenteeism", NOW))} in ${NOW}.`,
					`At OPRF it rose from ${pct(g(d200, "chronic_absenteeism", T0))} to ${pct(g(d200, "chronic_absenteeism", NOW))}.`,
					`Neighbors: River Forest 90 ${pct(g(rf, "chronic_absenteeism", NOW))}, Evanston 65 ${pct(g(ev65, "chronic_absenteeism", NOW))}.`,
				],
				counter: `Both districts remain well below the statewide rate (${pct(g(il, "chronic_absenteeism", NOW))}).`,
				link: {
					tab: "trends",
					group: "Attendance",
					extras: [PEERS.RF90, PEERS.EV65],
					note: `In the chronic absenteeism chart, D97 jumps after 2021 and stays near ${pct(g(d97, "chronic_absenteeism", NOW))}, still below the Illinois average (dashed).`,
				},
				linkLabel: "See attendance trends",
			},
		],
		alsoNotable: [
			Math.abs(rSpend) < 0.2 && Math.abs(rPov) > 0.5
				? "Across Cook County elementary districts, spending per student has almost no link to reading scores; the share of low-income students has a strong one."
				: `Across Cook County elementary districts, reading scores track spending (r = ${rSpend.toFixed(2)}) and low-income share (r = ${rPov.toFixed(2)}).`,
			`D97 enrollment fell ${Math.round(((enr0 - enr1) / enr0) * 100)}% since ${Y0}, while students with an IEP rose from ${pct(g(d97, "pct_iep", Y0))} to ${pct(g(d97, "pct_iep", NOW))}.`,
			`Average teacher pay: D97 ${usd(g(d97, "teacher_salary", NOW))}, OPRF ${usd(g(d200, "teacher_salary", NOW))} (Illinois: ${usd(g(il, "teacher_salary", NOW))}). OPRF keeps ${pct(g(d200, "teacher_retention", NOW))} of its teachers year to year (Illinois: ${pct(g(il, "teacher_retention", NOW))}).`,
			`Local property taxes fund ${pct(g(d97, "pct_local_property_tax", NOW))} of D97 and ${pct(g(d200, "pct_local_property_tax", NOW))} of D200 (statewide: ${pct(g(il, "pct_local_property_tax", NOW))}).`,
		],
		questions: [
			`D97 reading rose ${pts(d97ReadGain)} since ${T0}, but math only ${pts(d97MathGain)}. What is the plan for math?`,
			`OPRF's instructional spending per student fell (${usd(g(d200, "instructional_per_pupil", T0))} → ${usd(g(d200, "instructional_per_pupil", NOW))}) while total spending rose. Real shift or accounting change?`,
			"What is behind rising absenteeism, and which schools are most affected?",
		],
	};
}
