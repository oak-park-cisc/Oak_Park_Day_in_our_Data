import type { ReactNode } from "react";
import {
	ageRange,
	CONFIDENCE,
	circumference,
	feet,
	PRESENT_RING,
	presentAtSettlement,
	rankText,
} from "./format";
import { WarnIcon } from "./icons";
import { StreetViewButton } from "./StreetViewButton";
import type { Narrative, Tree } from "./types";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="border-line border-t py-3 first:border-t-0 first:pt-0">
			<h3 className="mb-1.5 font-semibold text-ink-2 text-sm uppercase tracking-wide">
				{title}
			</h3>
			{children}
		</section>
	);
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
	return (
		<dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-1">
			{rows.map(([k, v]) => (
				<div key={k} className="contents">
					<dt className="text-ink-2">{k}</dt>
					<dd>{v}</dd>
				</div>
			))}
		</dl>
	);
}

export function ConfidenceBadge({ tree }: { tree: Tree }) {
	const c = CONFIDENCE[tree.confidence];
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-sm">
			<span
				className="inline-block size-3 rounded-full ring-2 ring-white"
				style={{ background: c.color }}
				aria-hidden
			/>
			{c.label}
		</span>
	);
}

export function PresentBadge() {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-sm">
			<span
				className="inline-block size-3 rounded-full border-2"
				style={{ borderColor: PRESENT_RING }}
				aria-hidden
			/>
			Likely present at settlement (1833)
		</span>
	);
}

export function DetailPanel({
	tree,
	narrative,
}: {
	tree: Tree;
	narrative?: Narrative;
}) {
	const isPark = tree.source === "park";
	// "Likely present at settlement" implies Likely confidence, so it replaces that badge.
	const present = presentAtSettlement(tree);
	return (
		<div className="text-[15px] leading-relaxed">
			<div className="mb-3">
				<p className="text-ink-2 text-lg italic">{tree.latin}</p>
				<div className="mt-1.5 flex flex-wrap gap-1.5">
					{present ? <PresentBadge /> : <ConfidenceBadge tree={tree} />}
					<span className="rounded-full border border-line px-2 py-0.5 text-sm">
						Native to Illinois
					</span>
				</div>
				<StreetViewButton
					tree={tree}
					className="mt-3 w-full"
					label="See this spot in Street View"
				/>
				<p className="mt-1 text-ink-2 text-sm">
					Opens Google Maps. Imagery may be several years old, and nearby trees
					can look alike.
				</p>
				{tree.name_flag && (
					<p className="mt-2 flex gap-1.5 rounded-lg bg-amber-50 p-2 text-amber-950 text-sm dark:bg-amber-950/50 dark:text-amber-100">
						<WarnIcon />
						<span>
							<strong>Name check:</strong> {tree.name_flag}
						</span>
					</p>
				)}
			</div>

			<Section title="Location">
				<Facts
					rows={[
						isPark
							? ["Park", tree.park]
							: ["Address", `~${tree.address} (approximate)`],
						...(tree.block ? [["Block", tree.block] as [string, string]] : []),
						...(tree.historic_district
							? [
									["Historic district", tree.historic_district] as [
										string,
										string,
									],
								]
							: []),
					]}
				/>
			</Section>

			<Section title="Estimated age">
				<p className="font-semibold text-xl">{ageRange(tree)}</p>
				<ul className="mt-1 space-y-0.5 text-ink-2 text-sm">
					<li>Low: {tree.age_low_basis}</li>
					<li>High: {tree.age_high_basis}</li>
				</ul>
			</Section>

			<Section title="Confidence">
				<p className="mb-1">
					{present ? <PresentBadge /> : <ConfidenceBadge tree={tree} />}
				</p>
				<ul className="list-disc space-y-0.5 pl-5 text-sm">
					{tree.confidence_reasons.map((r) => (
						<li key={r}>{r}</li>
					))}
				</ul>
			</Section>

			<Section title="Size">
				<Facts
					rows={[
						["Trunk diameter", `${tree.dbh_in} in (DBH)`],
						["Circumference", `${circumference(tree)}, calculated`],
						["Height", feet(tree.height_ft)],
						["Crown spread", feet(tree.spread_ft)],
						["Rank", rankText(tree)],
					]}
				/>
			</Section>

			<Section title="History">
				{narrative && <p className="mb-2">{narrative.text}</p>}
				<Facts
					rows={[
						["1830s land", tree.landcover_1830s ?? "Unknown"],
						[
							"Nearest house",
							tree.nearest_house
								? `${tree.nearest_house.address}, built ${tree.nearest_house.year} (${tree.nearest_house.certainty})`
								: "None surveyed nearby",
						],
					]}
				/>
			</Section>

			<Section title="Tree ID">
				<Facts
					rows={[
						[isPark ? "Park District ID" : "Village ID", tree.tree_id],
						[
							"GlobalID",
							<span key="gid" className="break-all text-sm">
								{tree.global_id}
							</span>,
						],
					]}
				/>
			</Section>

			<Section title="Data sources">
				<ul className="list-disc space-y-1 pl-5 text-sm">
					{isPark ? (
						<li>
							<a
								className="link"
								href="https://services.arcgis.com/QPJQ2OoF7CFF9UvK/arcgis/rest/services/PDOP_Trees_8_30_22_Public/FeatureServer/0"
							>
								Park District of Oak Park tree inventory
							</a>{" "}
							(2022 snapshot)
						</li>
					) : (
						<li>
							<a
								className="link"
								href="https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_TreeInventory_PUBLICVIEW/FeatureServer/0"
							>
								Village of Oak Park tree inventory
							</a>{" "}
							via the{" "}
							<a
								className="link"
								href="https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data"
							>
								Oak Park Day in our Data
							</a>{" "}
							repository (measured 2023–2026)
						</li>
					)}
					<li>
						Age range: Morton Arboretum urban street-tree table and old-growth
						forest factors
					</li>
					<li>
						1830s land cover:{" "}
						<a
							className="link"
							href="https://clearinghouse.isgs.illinois.edu/data/landcover/illinois-landcover-early-1800s"
						>
							Illinois landcover in the early 1800s
						</a>
					</li>
					<li>Houses and districts: Village Historic Building Dataset</li>
				</ul>
			</Section>
		</div>
	);
}
