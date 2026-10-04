import type { FeatureCollection, MultiLineString, Polygon } from "geojson";
import Papa from "papaparse";
import { co2Lbs, type SizeGroup, sizeGroup } from "./estimates";
import { registerCommonNames } from "./names";

export type AddressStatus = "match" | "between" | "corner" | "near" | "none";

export type Tree = {
	id: string;
	common: string;
	latin: string;
	genus: string;
	/** Normalized Latin species name, the key for all species counts. */
	species: string;
	dbh: number | null;
	height: number | null;
	spread: number | null;
	lat: number;
	lon: number;
	address: string;
	addressStatus: AddressStatus;
	estNumber: number | null;
	block: string;
	zone: string;
	size: SizeGroup | null;
	co2: number | null;
	/** i-Tree Stormwater Calculator results; only the 100 largest and 100 smallest trees were run. */
	stormwater: Stormwater | null;
};

export type Stormwater = {
	set: string;
	itreeSpecies: string;
	speciesMatch: string;
	runoffGal: number;
	runoffUsd: number;
	tpLbs: number;
	tnLbs: number;
	tssLbs: number;
};

async function loadStormwater(): Promise<Map<string, Stormwater>> {
	const text = await fetch("/data/stormwater.csv").then((r) => r.text());
	const { data } = Papa.parse<Row>(text, {
		header: true,
		skipEmptyLines: true,
	});
	return new Map(
		data.map((r) => [
			r.tree_id,
			{
				set: r.set,
				itreeSpecies: r.itree_species,
				speciesMatch: r.species_match,
				runoffGal: Number(r.runoff_gal_yr),
				runoffUsd: Number(r.runoff_value_usd_yr),
				tpLbs: Number(r.tp_lbs_yr),
				tnLbs: Number(r.tn_lbs_yr),
				tssLbs: Number(r.tss_lbs_yr),
			},
		]),
	);
}

type Row = Record<string, string>;

/**
 * "Acer x freemanii 'Jeffersred'" -> "Acer × freemanii", "Ulmus 'Homestead'" / "Ulmus spp" -> "Ulmus spp.",
 * "Ulmus x spp" -> "Ulmus × spp.", blank -> "Ulmus (no Latin name)".
 */
export function latinSpecies(latin: string, genus: string): string {
	const base = latin
		.replace(/['"].*$/, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!base) return genus ? `${genus} (no Latin name)` : "";
	const words = base.split(" ").map((w) => (w === "x" ? "×" : w));
	if (words.length === 1 || words.at(-1) === "spp") {
		const head = words.filter((w) => w !== "spp");
		return `${head.join(" ")} spp.`;
	}
	return words.join(" ");
}

const num = (v: string) => (v === "" ? null : Number(v));

export async function loadTrees(): Promise<Tree[]> {
	const [text, stormwater] = await Promise.all([
		fetch("/data/trees.csv").then((r) => r.text()),
		loadStormwater(),
	]);
	const { data } = Papa.parse<Row>(text, {
		header: true,
		skipEmptyLines: true,
	});
	const trees: Tree[] = data.map((r) => {
		const dbh = num(r.dbh_in);
		return {
			id: r.id,
			common: r.common_name,
			latin: r.latin_name,
			genus: r.genus,
			species: latinSpecies(r.latin_name, r.genus),
			dbh,
			height: num(r.height_ft),
			spread: num(r.spread_ft),
			lat: Number(r.lat),
			lon: Number(r.lon),
			address: r.address,
			addressStatus: (r.address_status || "none") as AddressStatus,
			estNumber: num(r.est_number),
			block: r.block,
			zone: r.zone,
			size: sizeGroup(dbh),
			co2: co2Lbs(r.genus, r.latin, dbh),
			stormwater: stormwater.get(r.id) ?? null,
		};
	});
	registerCommonNames(trees);
	return trees;
}

export type BlocksGeo = FeatureCollection<MultiLineString, { block: string }>;
export type ZonesGeo = FeatureCollection<Polygon, { zone: string }>;

export const loadJson = <T>(path: string): Promise<T> =>
	fetch(path).then((r) => r.json() as Promise<T>);
