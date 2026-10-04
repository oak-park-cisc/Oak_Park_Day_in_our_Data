// Size, carbon and rough-age estimates derived from trunk diameter (DBH).
// None of these are measured; the inventory has no age, condition or carbon fields.

/** Larger recorded trunks are treated as likely data errors (one 30 ft honeylocust is recorded at 111"). */
export const MAX_DBH = 80;

export type SizeGroup = "small" | "medium" | "large";

export const SIZE_LABELS: Record<SizeGroup, string> = {
	small: 'Small (under 6")',
	medium: 'Medium (6–18")',
	large: 'Large (18"+)',
};

export function sizeGroup(dbh: number | null): SizeGroup | null {
	if (dbh === null || dbh <= 0) return null;
	if (dbh < 6) return "small";
	if (dbh < 18) return "medium";
	return "large";
}

// Jenkins et al. (2003) national biomass equations: aboveground dry kg = exp(b0 + b1 * ln(DBH cm)).
const JENKINS = {
	hardMapleOak: [-2.0127, 2.4342],
	softMapleBirch: [-1.9123, 2.3651],
	aspenWillow: [-2.2094, 2.3867],
	mixedHardwood: [-2.48, 2.4835],
	pine: [-2.5356, 2.4349],
	spruce: [-2.0773, 2.3323],
	firHemlock: [-2.5384, 2.4814],
	douglasFir: [-2.2304, 2.4435],
	cedarLarch: [-2.0336, 2.2592],
} as const;

const GENUS_GROUP: Record<string, keyof typeof JENKINS> = {
	Quercus: "hardMapleOak",
	Carya: "hardMapleOak",
	Fagus: "hardMapleOak",
	Betula: "softMapleBirch",
	Populus: "aspenWillow",
	Salix: "aspenWillow",
	Alnus: "aspenWillow",
	Pinus: "pine",
	Picea: "spruce",
	Abies: "firHemlock",
	Tsuga: "firHemlock",
	Pseudotsuga: "douglasFir",
	Thuja: "cedarLarch",
	Juniperus: "cedarLarch",
	Larix: "cedarLarch",
	Taxodium: "cedarLarch",
	Metasequoia: "cedarLarch",
	Taxus: "cedarLarch",
};

function jenkinsGroup(genus: string, latin: string): keyof typeof JENKINS {
	if (genus === "Acer") {
		return /Acer (saccharum|nigrum|platanoides)/.test(latin)
			? "hardMapleOak"
			: "softMapleBirch";
	}
	return GENUS_GROUP[genus] ?? "mixedHardwood";
}

const ROOTS = 1.26; // root-to-shoot ratio 0.26, as in i-Tree Eco
const OPEN_GROWN = 0.8; // i-Tree reduction for open-grown urban trees
const CARBON_SHARE = 0.5;
const CO2_PER_C = 44 / 12;
const LBS_PER_KG = 2.20462;

/** Estimated CO2 equivalent of carbon stored in the whole tree, in pounds. */
export function co2Lbs(
	genus: string,
	latin: string,
	dbh: number | null,
): number | null {
	if (dbh === null || dbh < 1 || dbh > MAX_DBH || !genus || genus === "STUMP")
		return null;
	const [b0, b1] = JENKINS[jenkinsGroup(genus, latin)];
	const aboveKg = Math.exp(b0 + b1 * Math.log(dbh * 2.54));
	return aboveKg * ROOTS * OPEN_GROWN * CARBON_SHARE * CO2_PER_C * LBS_PER_KG;
}

// Commonly published ISA growth factors (years per inch of DBH) for forest-grown trees.
const GROWTH_FACTORS: [RegExp, number][] = [
	[/^Acer saccharinum/, 3.0],
	[/^Acer rubrum/, 4.5],
	[/^Acer saccharum/, 5.5],
	[/^Acer platanoides/, 4.5],
	[/^Betula papyrifera/, 5.0],
	[/^Betula nigra/, 3.5],
	[/^Carya ovata/, 7.5],
	[/^Fraxinus pennsylvanica/, 4.0],
	[/^Fraxinus americana/, 5.0],
	[/^Juglans nigra/, 4.5],
	[/^Prunus serotina/, 5.0],
	[/^Quercus rubra/, 4.0],
	[/^Quercus alba/, 5.0],
	[/^Quercus palustris/, 3.0],
	[/^Tilia americana/, 3.0],
	[/^Tilia cordata/, 3.0],
	[/^Ulmus americana/, 4.0],
	[/^Ostrya virginiana/, 7.0],
	[/^Populus deltoides/, 2.0],
	[/^Cercis canadensis/, 7.0],
	[/^Cornus florida/, 7.0],
	[/^Aesculus hippocastanum/, 8.0],
	[/^Pinus sylvestris/, 3.5],
	[/^Pinus strobus/, 5.0],
	[/^Pinus nigra/, 4.5],
	[/^Pseudotsuga menziesii/, 5.0],
	[/^Picea pungens/, 4.5],
];

const round5 = (v: number) => Math.max(5, Math.round(v / 5) * 5);

/** Rough age range in years (±30%), or null when the species has no published factor. */
export function ageRange(
	latin: string,
	dbh: number | null,
): [number, number] | null {
	if (dbh === null || dbh <= 0 || dbh > MAX_DBH) return null;
	const factor = GROWTH_FACTORS.find(([re]) => re.test(latin))?.[1];
	if (!factor) return null;
	const age = dbh * factor;
	return [round5(age * 0.7), round5(age * 1.3)];
}

/** Approximate crown area in square feet from recorded spread (a circle). */
export const crownSqFt = (spread: number | null) =>
	spread ? Math.PI * (spread / 2) ** 2 : 0;
