import {
	AlertTriangle,
	ArrowLeft,
	Camera,
	CheckCircle2,
	ChevronDown,
	CircleHelp,
	CircleSlash,
	ExternalLink,
	MapPin,
} from "lucide-react";
import { Fragment, type ReactNode, useState } from "react";
import {
	genusColor,
	isTopGenus,
	OTHER_GENUS_COLOR,
	SIZE_COLORS,
	STATUS_COLORS,
} from "../lib/colors";
import type { Stormwater, Tree } from "../lib/data";
import {
	ageRange,
	crownSqFt,
	MAX_DBH,
	SIZE_LABELS,
	type SizeGroup,
} from "../lib/estimates";
import {
	commonName,
	fmt,
	genusName,
	pct,
	speciesCommon,
	tons,
} from "../lib/names";
import {
	isKnownGenus,
	MIN_TREES,
	STATUS_LABELS,
	type Stats,
	type Status,
	speciesKey,
} from "../lib/stats";

const STATUS_ICONS: Record<Status, typeof CheckCircle2> = {
	good: CheckCircle2,
	warning: AlertTriangle,
	critical: AlertTriangle,
	few: CircleSlash,
};

export function StatusBadge({ status }: { status: Status }) {
	const Icon = STATUS_ICONS[status];
	return (
		<span className="inline-flex items-center gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
			<Icon
				aria-hidden
				size={18}
				color={STATUS_COLORS[status]}
				strokeWidth={2.5}
			/>
			{STATUS_LABELS[status]}
		</span>
	);
}

/** Map marker for a genus: a circle for the named genera, a pink triangle for all others. */
export function GenusSwatch({
	genus,
	className = "",
}: {
	genus: string | null;
	className?: string;
}) {
	const triangle = genus === null || !isTopGenus(genus);
	return (
		<span
			aria-hidden
			className={`inline-block size-3 shrink-0 ${triangle ? "" : "rounded-full"} ${className}`}
			style={{
				background: genus === null ? OTHER_GENUS_COLOR : genusColor(genus),
				clipPath: triangle ? "polygon(50% 0, 100% 100%, 0 100%)" : undefined,
			}}
		/>
	);
}

/** Latin species name first, with the resident-friendly name after it. */
export function SpeciesName({
	species,
	common,
}: {
	species: string;
	common?: string;
}) {
	const friendly = common ?? speciesCommon(species);
	return (
		<span>
			<i>{species}</i>
			{friendly && (
				<span className="text-neutral-600 dark:text-neutral-400">
					{" "}
					· {friendly}
				</span>
			)}
		</span>
	);
}

export function BackButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-blue-700 hover:bg-neutral-100 dark:text-blue-300 dark:hover:bg-neutral-800"
		>
			<ArrowLeft aria-hidden size={18} /> Overview
		</button>
	);
}

function Tile({
	label,
	value,
	hint,
	note,
}: {
	label: string;
	value: string;
	hint?: string;
	note?: ReactNode;
}) {
	return (
		<div
			className="rounded-lg bg-neutral-100 px-3 py-2 dark:bg-neutral-800"
			title={hint}
		>
			<div className="text-xs text-neutral-600 dark:text-neutral-400">
				{label}
				{hint && (
					<CircleHelp
						aria-label={hint}
						className="ml-1 inline align-[-2px]"
						size={12}
					/>
				)}
			</div>
			<div className="text-lg font-semibold">{value}</div>
			{note && <div className="text-xs leading-snug">{note}</div>}
		</div>
	);
}

export function StatTiles({ s }: { s: Stats }) {
	return (
		<div className="grid grid-cols-2 gap-2">
			<Tile label="Trees" value={fmt(s.count)} />
			<Tile label="Species" value={fmt(s.species)} />
			<Tile
				label="Top genus"
				value={
					s.topGenus
						? `${genusName(s.topGenus.name)} ${pct(s.topGenus.share)}`
						: "–"
				}
				hint="Guideline: no genus over 20% of trees"
			/>
			<Tile
				label="Top species"
				value={s.topSpecies ? pct(s.topSpecies.share) : "–"}
				hint="Guideline: no species over 10% of trees"
				note={s.topSpecies && <SpeciesName species={s.topSpecies.name} />}
			/>
			<Tile
				label="Diversity index"
				value={s.shannon.toFixed(2)}
				hint="Shannon index of species. Higher means more variety and more even mix."
			/>
			<Tile
				label="CO₂ stored (est.)"
				value={tons(s.co2Lbs)}
				hint="Estimated from trunk diameter with US Forest Service biomass equations. Not measured."
			/>
		</div>
	);
}

export function GenusBars({ s, limit = 6 }: { s: Stats; limit?: number }) {
	const [open, setOpen] = useState<string | null>(null);
	const top = s.genusCounts.slice(0, limit).map(([g]) => g);
	const other =
		s.count - s.genusCounts.slice(0, limit).reduce((a, [, c]) => a + c, 0);
	const rows: [string, string, number][] = s.genusCounts
		.slice(0, limit)
		.map(([g, c]) => [g, genusName(g), c]);
	if (other > 0) rows.push(["", "All others", other]);
	const speciesOf = (g: string) =>
		s.speciesCounts.filter((sp) =>
			g ? sp.genus === g : !top.includes(sp.genus),
		);
	return (
		<Section title="Most common genera">
			<p className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
				Tap a genus to see its species.
			</p>
			<ul>
				{rows.map(([g, label, c]) => {
					const isOpen = open === (g || "other");
					return (
						<li key={label}>
							<button
								type="button"
								aria-expanded={isOpen}
								onClick={() => setOpen(isOpen ? null : g || "other")}
								className="grid min-h-11 w-full grid-cols-[7.5rem_1fr_3rem_1rem] items-center gap-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
								title={`${label}: ${fmt(c)} trees`}
							>
								<span className="truncate">
									{g ? <i>{g}</i> : label}
									{g && (
										<span className="text-neutral-600 dark:text-neutral-400">
											{" "}
											{label}
										</span>
									)}
								</span>
								<span className="h-3 rounded-r bg-neutral-200 dark:bg-neutral-800">
									<span
										className="block h-3 rounded-r"
										style={{
											width: `${(c / s.count) * 100}%`,
											background: g ? genusColor(g) : OTHER_GENUS_COLOR,
										}}
									/>
								</span>
								<span className="text-right tabular-nums text-neutral-600 dark:text-neutral-400">
									{pct(c / s.count)}
								</span>
								<ChevronDown
									aria-hidden
									size={16}
									className={isOpen ? "rotate-180" : ""}
								/>
							</button>
							{isOpen && (
								<ul className="mb-2 ml-3 border-l-2 border-neutral-200 pl-3 text-sm dark:border-neutral-700">
									{speciesOf(g).map((sp) => (
										<li
											key={sp.name}
											className="flex items-baseline justify-between gap-2 py-1"
										>
											<SpeciesName species={sp.name} />
											<span className="shrink-0 tabular-nums text-neutral-600 dark:text-neutral-400">
												{fmt(sp.count)} · {pct(sp.count / s.count)}
											</span>
										</li>
									))}
								</ul>
							)}
						</li>
					);
				})}
			</ul>
		</Section>
	);
}

export function SizeMix({ s }: { s: Stats }) {
	const total = s.sizes.small + s.sizes.medium + s.sizes.large || 1;
	const groups = Object.keys(SIZE_LABELS) as SizeGroup[];
	return (
		<Section title="Trunk size">
			<div
				className="flex h-3 gap-0.5"
				role="img"
				aria-label={groups
					.map((g) => `${SIZE_LABELS[g]} ${pct(s.sizes[g] / total)}`)
					.join(", ")}
			>
				{groups.map((g) =>
					s.sizes[g] ? (
						<span
							key={g}
							className="first:rounded-l last:rounded-r"
							style={{
								width: `${(s.sizes[g] / total) * 100}%`,
								background: SIZE_COLORS[g],
							}}
							title={`${SIZE_LABELS[g]}: ${fmt(s.sizes[g])}`}
						/>
					) : null,
				)}
			</div>
			<ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
				{groups.map((g) => (
					<li key={g} className="flex items-center gap-1.5">
						<span
							className="size-3 rounded-full"
							style={{ background: SIZE_COLORS[g] }}
						/>
						{SIZE_LABELS[g]}{" "}
						<span className="text-neutral-600 dark:text-neutral-400">
							{pct(s.sizes[g] / total)}
						</span>
					</li>
				))}
			</ul>
			<p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
				Shade: about{" "}
				{s.crownSqFt >= 43_560
					? `${fmt(s.crownSqFt / 43_560)} acres`
					: `${fmt(s.crownSqFt)} sq ft`}{" "}
				of crown, from recorded spread (overlap not removed).
			</p>
		</Section>
	);
}

export function Section({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="mt-5">
			<h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
				{title}
			</h3>
			{children}
		</section>
	);
}

export function AreaDetail({
	title,
	sub,
	s,
	village,
	trees,
	isBlock,
	showingOnly,
	onBack,
	onShowTrees,
	onPick,
}: {
	title: string;
	sub: string;
	s: Stats;
	village: Stats;
	trees: Tree[];
	isBlock: boolean;
	showingOnly: boolean;
	onBack: () => void;
	onShowTrees: () => void;
	onPick: (t: Tree) => void;
}) {
	const [allSpecies, setAllSpecies] = useState(false);
	const species = speciesRows(trees);
	const measured = trees.filter((t) => t.dbh && t.dbh <= MAX_DBH);
	const avg = (vals: number[]) =>
		vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
	const avgDbh = avg(measured.map((t) => t.dbh ?? 0));
	const heights = trees.flatMap((t) => (t.height ? [t.height] : []));
	const confirmed = trees.filter((t) => t.addressStatus === "match").length;
	const largest = [...measured]
		.sort((a, b) => (b.dbh ?? 0) - (a.dbh ?? 0))
		.slice(0, 5);
	const inOrder = [...trees].sort(
		(a, b) =>
			((a.estNumber ?? 0) % 2) - ((b.estNumber ?? 0) % 2) ||
			(a.estNumber ?? 0) - (b.estNumber ?? 0),
	);
	return (
		<div>
			<BackButton onClick={onBack} />
			<h2 className="text-xl font-semibold">{title}</h2>
			<p className="text-sm text-neutral-600 dark:text-neutral-400">{sub}</p>
			<div className="mt-2">
				<StatusBadge status={s.status} />
			</div>
			<button
				type="button"
				onClick={onShowTrees}
				aria-pressed={showingOnly}
				className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 font-medium text-white hover:bg-blue-800"
			>
				<MapPin aria-hidden size={18} />
				{showingOnly
					? "Show all trees on the map"
					: "Show only these trees on the map"}
			</button>
			<div className="mt-3">
				<StatTiles s={s} />
			</div>

			<Section title="Compared with the village">
				<dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-sm">
					<dt className="text-neutral-600 dark:text-neutral-400" />
					<dd className="font-medium">Here</dd>
					<dd className="font-medium">Village</dd>
					{(
						[
							[
								"Top genus share",
								pct(s.topGenus?.share ?? 0),
								pct(village.topGenus?.share ?? 0),
							],
							[
								"Diversity index",
								s.shannon.toFixed(2),
								village.shannon.toFixed(2),
							],
							[
								'Large trunks (18"+)',
								pct(s.sizes.large / (s.count || 1)),
								pct(village.sizes.large / village.count),
							],
							[
								"CO₂ per tree",
								`${fmt(s.co2Lbs / (s.count || 1))} lbs`,
								`${fmt(village.co2Lbs / village.count)} lbs`,
							],
						] as [string, string, string][]
					).map(([k, here, all]) => (
						<Fragment key={k}>
							<dt className="text-neutral-600 dark:text-neutral-400">{k}</dt>
							<dd className="text-right tabular-nums">{here}</dd>
							<dd className="text-right tabular-nums text-neutral-600 dark:text-neutral-400">
								{all}
							</dd>
						</Fragment>
					))}
				</dl>
			</Section>

			<GenusBars s={s} />

			<Section title={`All ${species.length} species`}>
				<table className="w-full text-sm">
					<thead className="text-left text-neutral-600 dark:text-neutral-400">
						<tr>
							<th className="py-1 font-normal">Species</th>
							<th className="py-1 pl-3 text-right font-normal">Trees</th>
							<th className="py-1 pl-3 text-right font-normal">Share</th>
							<th
								className="py-1 pl-3 text-right font-normal"
								title="Average trunk diameter"
							>
								Avg trunk
							</th>
						</tr>
					</thead>
					<tbody className="tabular-nums">
						{(allSpecies ? species : species.slice(0, 8)).map((r) => (
							<tr
								key={r.key}
								className="border-t border-neutral-200 dark:border-neutral-800"
							>
								<td className="py-1.5">
									<GenusSwatch genus={r.genus} className="mr-2" />
									<SpeciesName species={r.name} />
								</td>
								<td className="pl-3 text-right">{r.count}</td>
								<td className="pl-3 text-right">
									{pct(r.count / trees.length)}
								</td>
								<td className="pl-3 text-right">
									{r.avgDbh ? `${r.avgDbh.toFixed(0)}"` : "–"}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{species.length > 8 && (
					<button
						type="button"
						onClick={() => setAllSpecies(!allSpecies)}
						className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 text-sm font-medium dark:border-neutral-700"
					>
						{allSpecies ? "Show fewer" : `Show all ${species.length} species`}
					</button>
				)}
			</Section>

			<SizeMix s={s} />
			<p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
				Average trunk {avgDbh.toFixed(1)}", average height{" "}
				{avg(heights).toFixed(0)} ft. {fmt(confirmed)} of {fmt(trees.length)}{" "}
				tree addresses match a property record.
			</p>

			<Section title="Largest trees">
				<TreeList trees={largest} onPick={onPick} />
			</Section>

			{isBlock && (
				<Section title={`Every tree on this block (${trees.length})`}>
					<p className="mb-1 text-sm text-neutral-600 dark:text-neutral-400">
						Odd-numbered side first, in address order.
					</p>
					<TreeList trees={inOrder} onPick={onPick} />
				</Section>
			)}

			{s.status === "few" && (
				<p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
					Blocks with fewer than {MIN_TREES} trees are not rated.
				</p>
			)}
		</div>
	);
}

function speciesRows(trees: Tree[]) {
	const rows = new Map<
		string,
		{
			key: string;
			name: string;
			genus: string;
			count: number;
			dbhSum: number;
			dbhN: number;
		}
	>();
	for (const t of trees) {
		if (!isKnownGenus(t.genus)) continue;
		const key = speciesKey(t);
		const r = rows.get(key) ?? {
			key,
			name: key,
			genus: t.genus,
			count: 0,
			dbhSum: 0,
			dbhN: 0,
		};
		r.count++;
		if (t.dbh && t.dbh <= MAX_DBH) {
			r.dbhSum += t.dbh;
			r.dbhN++;
		}
		rows.set(key, r);
	}
	return [...rows.values()]
		.map((r) => ({ ...r, avgDbh: r.dbhN ? r.dbhSum / r.dbhN : 0 }))
		.sort((a, b) => b.count - a.count);
}

export function AddressLine({ t }: { t: Tree }) {
	if (t.addressStatus === "none")
		return (
			<span className="text-neutral-600 dark:text-neutral-400">
				No nearby address
			</span>
		);
	const confirmed = t.addressStatus === "match";
	return (
		<span className="inline-flex flex-wrap items-center gap-x-2">
			<span>{t.address}</span>
			{confirmed ? (
				<span
					className="inline-flex items-center gap-1 text-xs text-green-800 dark:text-green-400"
					title="This estimate matches a property address in Cook County Assessor records"
				>
					<CheckCircle2 aria-hidden size={14} /> Matches property record
				</span>
			) : (
				<span
					className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
					title="Estimated from street address ranges; no property address matches this exact spot"
				>
					<AlertTriangle aria-hidden size={14} /> Not confirmed
				</span>
			)}
		</span>
	);
}

export function TreeDetail({
	t,
	streetViewUrl,
	onBack,
	onBlock,
}: {
	t: Tree;
	streetViewUrl: string;
	onBack: () => void;
	onBlock: () => void;
}) {
	const [tab, setTab] = useState<"details" | "street">("details");
	const age = ageRange(t.latin, t.dbh);
	const rows: [string, ReactNode][] = [
		["Address", <AddressLine key="a" t={t} />],
		[
			"Trunk diameter",
			!t.dbh
				? "Not recorded"
				: t.dbh > MAX_DBH
					? `${t.dbh}" recorded (likely a data error)`
					: `${t.dbh}" (${t.size ? SIZE_LABELS[t.size].split(" ")[0].toLowerCase() : "–"})`,
		],
		["Height", t.height ? `${t.height} ft` : "Not recorded"],
		[
			"Spread",
			t.spread
				? `${t.spread} ft (about ${fmt(crownSqFt(t.spread))} sq ft of shade)`
				: "Not recorded",
		],
		[
			"CO₂ stored",
			t.co2 ? `about ${fmt(t.co2)} lbs (estimate)` : "No estimate",
		],
		[
			"Rough age",
			age
				? `${age[0]}–${age[1]} years (estimate)`
				: "No published growth factor for this species",
		],
		["Genus", `${genusName(t.genus)} (${t.genus})`],
		[
			"Block",
			<button
				key="b"
				type="button"
				onClick={onBlock}
				className="min-h-11 text-left text-blue-700 underline dark:text-blue-300"
			>
				{t.block}
			</button>,
		],
		["Zone", t.zone],
	];
	return (
		<div>
			<BackButton onClick={onBack} />
			<h2 className="text-xl font-semibold italic">{t.latin || t.species}</h2>
			<p className="text-neutral-600 dark:text-neutral-400">
				{commonName(t.common)}
				{!t.latin && " (no Latin name recorded)"}
			</p>
			<div
				role="tablist"
				aria-label="Tree information"
				className="mt-3 flex border-b border-neutral-200 dark:border-neutral-800"
			>
				{(
					[
						["details", "Details"],
						["street", "Street View"],
					] as const
				).map(([id, label]) => (
					<button
						key={id}
						type="button"
						role="tab"
						id={`tab-${id}`}
						aria-selected={tab === id}
						aria-controls={`panel-${id}`}
						onClick={() => setTab(id)}
						className="-mb-px min-h-11 border-b-2 border-transparent px-4 text-sm font-medium text-neutral-600 aria-selected:border-blue-700 aria-selected:text-blue-700 dark:text-neutral-400 dark:aria-selected:border-blue-300 dark:aria-selected:text-blue-300"
					>
						{label}
					</button>
				))}
			</div>
			{tab === "details" ? (
				<div role="tabpanel" id="panel-details" aria-labelledby="tab-details">
					<dl className="mt-1 divide-y divide-neutral-200 dark:divide-neutral-800">
						{rows.map(([k, v]) => (
							<div
								key={k}
								className="grid grid-cols-[7.5rem_1fr] gap-2 py-2 text-sm"
							>
								<dt className="text-neutral-600 dark:text-neutral-400">{k}</dt>
								<dd>{v}</dd>
							</div>
						))}
					</dl>
					{t.stormwater && <StormwaterSection s={t.stormwater} />}
					<p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
						Age and CO₂ are rough estimates from trunk size. The inventory
						records no age, planting year or condition.
					</p>
				</div>
			) : (
				<div
					role="tabpanel"
					id="panel-street"
					aria-labelledby="tab-street"
					className="pt-4"
				>
					<p className="text-sm">
						See this tree from the street in Google Street View, facing{" "}
						{t.address ? (
							<span className="font-medium">{t.address}</span>
						) : (
							"the tree"
						)}
						.
					</p>
					<a
						href={streetViewUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 font-medium text-white hover:bg-blue-800"
					>
						<Camera aria-hidden size={18} /> Open Street View
						<ExternalLink aria-hidden size={16} />
						<span className="sr-only">(opens Google Maps in a new tab)</span>
					</a>
					<p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
						Opens Google Maps in a new tab. Street View photos may be older than
						the tree inventory, and the tree is at the center of the view only
						approximately; look along the parkway.
					</p>
				</div>
			)}
		</div>
	);
}

function StormwaterSection({ s }: { s: Stormwater }) {
	const n = (v: number, d = 3) =>
		v.toLocaleString("en-US", {
			maximumFractionDigits: d,
			minimumFractionDigits: 0,
		});
	const rows: [string, string][] = [
		[
			"Runoff avoided",
			`${n(s.runoffGal, 0)} gallons ($${s.runoffUsd.toFixed(2)})`,
		],
		["Phosphorus (TP)", `${n(s.tpLbs, 5)} lbs`],
		["Nitrogen (TN)", `${n(s.tnLbs, 4)} lbs`],
		["Suspended solids (TSS)", `${n(s.tssLbs, 2)} lbs`],
	];
	return (
		<Section title="Stormwater per year (i-Tree)">
			<dl className="divide-y divide-neutral-200 dark:divide-neutral-800">
				{rows.map(([k, v]) => (
					<div
						key={k}
						className="grid grid-cols-[10rem_1fr] gap-2 py-2 text-sm"
					>
						<dt className="text-neutral-600 dark:text-neutral-400">{k}</dt>
						<dd className="tabular-nums">{v}</dd>
					</div>
				))}
			</dl>
			<p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
				i-Tree Stormwater Calculator, Oak Park 2019 weather. Assumes good
				condition, full sun, 50% impervious cover and clay loam soil.
				{s.speciesMatch === "genus only" &&
					` Run as ${s.itreeSpecies} (genus only).`}{" "}
				Courtesy of the i-Tree Cooperative.
			</p>
		</Section>
	);
}

export function TreeList({
	trees,
	onPick,
}: {
	trees: Tree[];
	onPick: (t: Tree) => void;
}) {
	return (
		<ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
			{trees.map((t) => (
				<li key={t.id}>
					<button
						type="button"
						onClick={() => onPick(t)}
						className="flex min-h-11 w-full items-start gap-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
					>
						<GenusSwatch genus={t.genus} className="mt-1.5" />
						<span className="text-sm">
							<span className="font-medium italic">{t.species}</span>
							<span className="text-neutral-600 dark:text-neutral-400">
								{" "}
								· {commonName(t.common)}
							</span>
							{t.dbh ? (
								<span className="text-neutral-600 dark:text-neutral-400">
									{" "}
									· {t.dbh}" trunk
								</span>
							) : null}
							<br />
							<AddressLine t={t} />
						</span>
					</button>
				</li>
			))}
		</ul>
	);
}
