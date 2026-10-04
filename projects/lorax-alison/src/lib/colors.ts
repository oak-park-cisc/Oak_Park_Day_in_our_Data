import type { SizeGroup } from "./estimates";
import type { Status } from "./stats";

// Map basemap is always light, so map marks use the light-surface steps.
export const STATUS_COLORS: Record<Status, string> = {
	good: "#0ca30c",
	warning: "#fab219",
	critical: "#d03b3b",
	few: "#898781",
};

// Scatter-style map: five named genera plus one pink "other" slot, validated all-pairs
// (linden yellow and hackberry brown requested by the team; yellow needs the legend labels for contrast).
export const GENUS_COLORS: [string, string][] = [
	["Acer", "#2a78d6"],
	["Quercus", "#eb6834"],
	["Ulmus", "#1baf7a"],
	["Tilia", "#d4a900"],
	["Celtis", "#7a4a1e"],
];
export const OTHER_COLOR = "#a3a29b"; // missing data
// Pink for every genus not named above; passes the all-pairs color checks with them.
export const OTHER_GENUS_COLOR = "#d6409f";

export const genusColor = (genus: string) =>
	GENUS_COLORS.find(([g]) => g === genus)?.[1] ?? OTHER_GENUS_COLOR;

// Ordinal blue ramp, steps 250 / 450 / 650.
export const SIZE_COLORS: Record<SizeGroup, string> = {
	small: "#86b6ef",
	medium: "#2a78d6",
	large: "#104281",
};

export const isTopGenus = (genus: string) =>
	GENUS_COLORS.some(([g]) => g === genus);
