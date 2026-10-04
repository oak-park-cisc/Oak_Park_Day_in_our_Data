import type { MultiLineString, Polygon } from "geojson";

export type BlockProps = {
	block: string;
	street: string;
	/** D97 elementary attendance zone holding most of the block's trees */
	zone: string;
	trees: number;
	species_count: number;
	genus_count: number;
	top_species: string;
	top_species_latin: string;
	top_species_share: number;
	top_genus: string;
	top_genus_common: string;
	top_genus_share: number;
	shannon: number;
	simpson: number;
	low_count: boolean;
	species_over_10pct: boolean;
	genus_over_20pct: boolean;
	genus_30pct_plus: boolean;
	median_dbh_in: number | null;
	median_height_ft: number | null;
	median_spread_ft: number | null;
	canopy_sqft: number;
	/** Ground under at least one crown, overlaps counted once */
	canopy_covered_sqft: number;
	street_length_ft: number | null;
	on_map: boolean;
	/** [common name, latin name, count] */
	species: [string, string, number][];
	/** [genus, familiar label, count] */
	genera: [string, string, number][];
};

export type BlockFeature = {
	type: "Feature";
	geometry: MultiLineString | null;
	properties: BlockProps;
};

export type BlocksData = {
	type: "FeatureCollection";
	metadata: {
		min_trees_for_flags: number;
		records_skipped: number;
		trees_used: number;
		canopy_crown_sum_sqft: number;
		canopy_covered_sqft: number;
		village_area_sqft: number;
	};
	features: BlockFeature[];
};

export type ZoneProps = {
	zone: string;
	trees: number;
	species_count: number;
	genus_count: number;
	top_species: string;
	top_species_latin: string;
	top_species_share: number;
	top_genus: string;
	top_genus_common: string;
	top_genus_share: number;
	shannon: number;
	simpson: number;
	median_dbh_in: number | null;
	median_height_ft: number | null;
	median_spread_ft: number | null;
	canopy_sqft: number;
	canopy_covered_sqft: number;
	area_sqft: number | null;
	canopy_cover_pct: number | null;
	blocks: number;
	blocks_10plus_trees: number;
	blocks_genus_30pct_plus: number;
	share_blocks_genus_30pct_plus: number | null;
	median_block_simpson: number | null;
	canopy_sqft_per_street_ft: number | null;
	/** Top 10: [genus, familiar label, count] */
	genera: [string, string, number][];
};

export type ZonesData = {
	type: "FeatureCollection";
	features: { type: "Feature"; geometry: Polygon; properties: ZoneProps }[];
};

/** Compact tree table: rows are [lat, lon, speciesIdx, dbh_in, height_ft, spread_ft, blockIdx] */
export type TreesData = {
	species: [string, string, string][];
	blocks: string[];
	genusLabels: Record<string, string>;
	trees: [number, number, number, number | null, number | null, number | null, number][];
};

/** [street, left_from, left_to, right_from, right_to, [lat, lon][]] */
export type AddressSegment = [string, number, number, number, number, [number, number][]];

export type ModisCell = {
	id: string;
	/** Percent tree cover per year, aligned with metadata.years */
	cover: (number | null)[];
	recent_mean: number | null;
	inventory_trees: number;
	/** Public inventory crown area as a percent of the cell */
	inventory_canopy_pct: number;
};

export type ModisData = {
	type: "FeatureCollection";
	metadata: {
		product: string;
		retrieved: string;
		cell_size_m: number;
		years: number[];
		recent_years: number[];
		village_mean: number[];
	};
	features: { type: "Feature"; geometry: Polygon; properties: ModisCell }[];
};
