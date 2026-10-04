import {
	CalendarOff,
	Clock,
	ExternalLink,
	FileWarning,
	type LucideIcon,
	Ruler,
	School,
	Wallet,
} from "lucide-react";

const CAVEATS: { title: string; icon: LucideIcon; body: string }[] = [
	{
		title: "2025 test scores start a new series",
		icon: FileWarning,
		body: "Illinois changed its performance levels in 2025, and high schools switched from the SAT to the ACT. The jump in 2025 proficiency is mostly the new scale, not a sudden improvement. Charts set 2025 apart, and the “then vs now” table compares 2024 when the starting year is earlier.",
	},
	{
		title: "No tests in 2020",
		icon: CalendarOff,
		body: "Spring 2020 tests were canceled, so proficiency is blank for 2020. Attendance and absenteeism for 2020 reflect the closures too.",
	},
	{
		title: "Spending lags a year",
		icon: Clock,
		body: "Finance figures in each report card describe the previous fiscal year: the 2025 report card shows FY2024 spending.",
	},
	{
		title: "Elementary vs. high school districts",
		icon: School,
		body: "D97 is a K–8 district and D200 is a high school district. Compare each with districts of the same type: high school spending per pupil is typically much higher, and test grades differ.",
	},
	{
		title: "Proficiency is one measure",
		icon: Ruler,
		body: "“Percent proficient” is a cutoff, not an average. Districts with more low-income students tend to post lower rates statewide. Student-group results (Gaps) show who is being served well.",
	},
	{
		title: "Spending is not a budget",
		icon: Wallet,
		body: "Operating spending per pupil excludes capital projects and debt. Instructional spending is the share spent directly on teaching.",
	},
];

export function AboutData() {
	return (
		<section className="flex max-w-4xl flex-col gap-4" aria-label="Caveats and sources">
			<ul className="grid gap-3 sm:grid-cols-2">
				{CAVEATS.map((c) => (
					<li
						key={c.title}
						className="rounded-xl border border-line bg-card p-4 dark:border-line-dark dark:bg-card-dark"
					>
						<h3 className="flex items-center gap-2 font-semibold">
							<c.icon size={18} aria-hidden className="shrink-0" />
							{c.title}
						</h3>
						<p className="mt-1 text-sm text-ink-2 dark:text-ink-2-dark">{c.body}</p>
					</li>
				))}
			</ul>
			<div className="rounded-xl border border-line bg-card p-4 text-sm dark:border-line-dark dark:bg-card-dark">
				<h3 className="font-semibold">Sources</h3>
				<ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-ink-2 dark:text-ink-2-dark">
					<li>
						<strong className="font-semibold text-ink dark:text-ink-dark">School data:</strong> Illinois State
						Board of Education, Illinois Report Card public data sets, 2018–2025 (every Illinois district,
						plus the D97 and D200 schools). Includes school tax rates and taxable property per student.
					</li>
					<li>
						<strong className="font-semibold text-ink dark:text-ink-dark">Tax levies:</strong> Cook County
						Clerk Agency Tax Rate Reports for D97 and D200, tax years 2006–2025, via the Day in Our Data repo.
					</li>
					<li>
						<strong className="font-semibold text-ink dark:text-ink-dark">Map:</strong> Village of Oak Park
						GIS (attendance zones, school buildings, village boundary) and OpenStreetMap.
					</li>
				</ul>
				<p className="mt-2 text-ink-2 dark:text-ink-2-dark">
					All retrieved October 3, 2026. Files, filters and methods are in <code>public/data/SOURCES.md</code>
					.
				</p>
				<ul className="mt-2 flex flex-col">
					{[
						[
							"ISBE Report Card Data Library",
							"https://www.isbe.net/Pages/Illinois-State-Report-Card-Data.aspx",
						],
						[
							"Illinois Report Card: Oak Park ESD 97",
							"https://www.illinoisreportcard.com/District.aspx?source=profile&Districtid=06016097002",
						],
						[
							"Illinois Report Card: OPRF D200",
							"https://www.illinoisreportcard.com/District.aspx?source=profile&Districtid=06016200013",
						],
						[
							"Cook County Clerk: tax extension and rates",
							"https://www.cookcountyclerkil.gov/property-taxes/tax-extension-and-rates",
						],
						[
							"Village of Oak Park: elementary attendance zones",
							"https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Elementary_Attendance_Zones/FeatureServer/0",
						],
						["OpenStreetMap", "https://www.openstreetmap.org/copyright"],
					].map(([label, href]) => (
						<li key={href}>
							<a
								href={href}
								target="_blank"
								rel="noreferrer"
								className="inline-flex min-h-11 items-center gap-1.5 text-accent underline-offset-2 hover:underline dark:text-accent-dark"
							>
								{label} <ExternalLink size={14} aria-hidden />
							</a>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
