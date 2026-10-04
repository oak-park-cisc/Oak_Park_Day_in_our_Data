export type Confidence = "likely" | "possible" | "long_shot";

export interface Tree {
	key: string;
	source: "village" | "park";
	tree_id: string;
	global_id: string;
	common: string;
	latin: string;
	latin_raw: string;
	name_flag: string | null;
	native: boolean;
	group: "white" | "red";
	dbh_in: number;
	height_ft: number | null;
	spread_ft: number | null;
	circumference: { in: number; ft: number; rem_in: number };
	age_low: number;
	age_high: number;
	age_low_basis: string;
	age_high_basis: string;
	extrapolated: boolean;
	confidence: Confidence;
	confidence_reasons: string[];
	rank: number;
	rank_of: number;
	address: string | null;
	block: string | null;
	park: string | null;
	landcover_1830s: string | null;
	historic_district: string | null;
	nearest_house: {
		address: string;
		year: number;
		certainty: string;
		distance_ft: number;
	} | null;
	/** Camera on the nearest street, facing the tree. Null for park trees. */
	street_view: { lat: number; lon: number; heading: number } | null;
	lat: number;
	lon: number;
}

export interface Narrative {
	status: "draft" | "approved";
	text: string;
}

export type Panel = "details" | "list" | "about" | null;
