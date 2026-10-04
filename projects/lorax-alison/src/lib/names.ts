// Resident-friendly names for genera in the inventory.
const GENUS_NAMES: Record<string, string> = {
	Abies: "Fir",
	Acer: "Maple",
	Aesculus: "Buckeye",
	Ailanthus: "Tree of heaven",
	Alnus: "Alder",
	Amelanchier: "Serviceberry",
	Betula: "Birch",
	Carpinus: "Hornbeam",
	Carya: "Hickory",
	Catalpa: "Catalpa",
	Celtis: "Hackberry",
	Cercis: "Redbud",
	Circidiphyllum: "Katsura",
	Cladrastis: "Yellowwood",
	Cornus: "Dogwood",
	Corylus: "Hazel",
	Cotinus: "Smoketree",
	Crataegus: "Hawthorn",
	Elaeagnus: "Russian olive",
	Eucommia: "Hardy rubber tree",
	Fagus: "Beech",
	Forsythia: "Forsythia",
	Fraxinus: "Ash",
	Ginkgo: "Ginkgo",
	Gleditsia: "Honeylocust",
	Gymnocladus: "Kentucky coffeetree",
	Hibiscus: "Rose of Sharon",
	Juglans: "Walnut",
	Juniperus: "Juniper",
	Koelreuteria: "Goldenrain tree",
	Larix: "Larch",
	Liquidambar: "Sweetgum",
	Liriodendron: "Tuliptree",
	Lonicera: "Honeysuckle",
	Maackia: "Maackia",
	Maclura: "Osage orange",
	Magnolia: "Magnolia",
	Malus: "Crabapple",
	Metasequoia: "Dawn redwood",
	Morus: "Mulberry",
	Nyssa: "Tupelo",
	Ostrya: "Hophornbeam",
	Parrotia: "Parrotia",
	Phellodendron: "Corktree",
	Picea: "Spruce",
	Pinus: "Pine",
	Platanus: "Sycamore",
	Populus: "Cottonwood",
	Prunus: "Cherry",
	Pseudotsuga: "Douglas fir",
	Pyrus: "Pear",
	Quercus: "Oak",
	Rhus: "Sumac",
	Robinia: "Black locust",
	Salix: "Willow",
	Sambucus: "Elderberry",
	Sophora: "Pagoda tree",
	Syringia: "Lilac",
	Tamarix: "Tamarisk",
	Taxodium: "Bald cypress",
	Taxus: "Yew",
	Thuja: "Arborvitae",
	Tilia: "Linden",
	Tsuga: "Hemlock",
	Ulmus: "Elm",
	Viburnum: "Viburnum",
	Zelkova: "Zelkova",
};

export const genusName = (genus: string) => GENUS_NAMES[genus] ?? genus;

/** "MAPLE-NORWAY" -> "Norway maple", "KENTUCKY COFFEETREE" -> "Kentucky coffeetree", "WILLOW-SPP" -> "Willow (various)". */
export function commonName(raw: string): string {
	if (!raw) return "Unknown tree";
	const various = /\bSPP\b/i.test(raw);
	const parts = raw
		.toLowerCase()
		.replace(/\bspp\b/g, "")
		.split("-")
		.map((p) => p.trim())
		.filter(Boolean);
	const name =
		parts.length > 1 ? [...parts.slice(1), parts[0]].join(" ") : parts[0];
	return `${name.charAt(0).toUpperCase()}${name.slice(1)}${various ? " (various)" : ""}`;
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
export const pct = (share: number) =>
	`${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;
export const tons = (lbs: number) =>
	lbs >= 2000 * 10
		? `${fmt(lbs / 2000)} tons`
		: `${(lbs / 2000).toFixed(1)} tons`;

// Most common inventory common name for each Latin species, filled once the data loads.
const SPECIES_COMMON = new Map<string, string>();

export function registerCommonNames(
	trees: { species: string; common: string }[],
) {
	const counts = new Map<string, Map<string, number>>();
	for (const t of trees) {
		const c = counts.get(t.species) ?? new Map<string, number>();
		c.set(t.common, (c.get(t.common) ?? 0) + 1);
		counts.set(t.species, c);
	}
	for (const [sp, c] of counts) {
		SPECIES_COMMON.set(
			sp,
			commonName([...c].sort((a, b) => b[1] - a[1])[0][0]),
		);
	}
}

/** Resident-friendly name for a Latin species, e.g. "Acer platanoides" -> "Norway maple". */
export const speciesCommon = (species: string) =>
	SPECIES_COMMON.get(species) ?? "";
