import { useSyncExternalStore } from "react";

// Validated categorical palette (dataviz reference palette), light and dark steps.
const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

export type Theme = {
	dark: boolean;
	series: string[];
	surface: string;
	ink: string;
	inkSecondary: string;
	muted: string;
	grid: string;
	axis: string;
	stateLine: string;
	other: string;
	band: string;
};

const LIGHT: Theme = {
	dark: false,
	series: SERIES_LIGHT,
	surface: "#fcfcfb",
	ink: "#0b0b0b",
	inkSecondary: "#52514e",
	muted: "#898781",
	grid: "#e1e0d9",
	axis: "#c3c2b7",
	stateLine: "#6b6a65",
	other: "#c3c2b7",
	band: "#f0efec",
};

const DARK: Theme = {
	dark: true,
	series: SERIES_DARK,
	surface: "#1a1a19",
	ink: "#ffffff",
	inkSecondary: "#c3c2b7",
	muted: "#898781",
	grid: "#2c2c2a",
	axis: "#383835",
	stateLine: "#a8a79f",
	other: "#4a4a46",
	band: "#262624",
};

const query = "(prefers-color-scheme: dark)";
const subscribe = (cb: () => void) => {
	const m = window.matchMedia(query);
	m.addEventListener("change", cb);
	return () => m.removeEventListener("change", cb);
};

export function useTheme(): Theme {
	const dark = useSyncExternalStore(
		subscribe,
		() => window.matchMedia(query).matches,
		() => false,
	);
	return dark ? DARK : LIGHT;
}
