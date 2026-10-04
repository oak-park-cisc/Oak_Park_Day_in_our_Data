import { LocateFixed, MapPin, Search } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useData } from "./data";
import { geocode } from "./geocode";
import { niceName } from "./metrics";
import type { Center, Nearby } from "./nearby";
import type { AddressSegment } from "./types";
import { pct } from "./ui";

type Props = {
	center: Center | null;
	onCenter: (c: Center) => void;
	radiusFt: number;
	onRadius: (r: number) => void;
	nearby: Nearby | null;
	treesLoading: boolean;
	treesError: string | null;
	selectedTree: number | null;
	onSelectTree: (idx: number) => void;
	onOpenBlock: (block: string) => void;
};

export function NearMe({
	center,
	onCenter,
	radiusFt,
	onRadius,
	nearby,
	treesLoading,
	treesError,
	selectedTree,
	onSelectTree,
	onOpenBlock,
}: Props) {
	const [address, setAddress] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [locating, setLocating] = useState(false);
	const { data: segments, error: addrError } = useData<AddressSegment[]>("addresses.json");

	function submit(e: FormEvent) {
		e.preventDefault();
		if (!segments) return;
		const r = geocode(address, segments);
		if ("error" in r) setMessage(r.error);
		else {
			setMessage(null);
			onCenter({ lat: r.lat, lon: r.lon, label: titleCase(r.label) });
		}
	}

	function locate() {
		if (!navigator.geolocation) {
			setMessage("Location isn't available in this browser.");
			return;
		}
		setLocating(true);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setLocating(false);
				setMessage(null);
				onCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: "your location" });
			},
			(err) => {
				setLocating(false);
				setMessage(
					err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "Couldn't get your location.",
				);
			},
			{ enableHighAccuracy: true, timeout: 10000 },
		);
	}

	const top = nearby?.legend[0];
	const total = nearby?.trees.length ?? 0;

	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<div className="sticky top-0 z-10 space-y-2 border-b border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
				<form onSubmit={submit} className="flex gap-2">
					<label className="relative block min-w-0 flex-1">
						<span className="sr-only">Oak Park address</span>
						<MapPin
							className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-500"
							aria-hidden
						/>
						<input
							type="search"
							enterKeyHint="search"
							autoComplete="street-address"
							value={address}
							onChange={(e) => setAddress(e.target.value)}
							placeholder="Address, e.g. 1043 N Kenilworth"
							className="h-11 w-full rounded-md border border-neutral-300 bg-white pr-3 pl-9 text-base dark:border-neutral-700 dark:bg-neutral-900"
						/>
					</label>
					<button
						type="submit"
						disabled={!segments || !address.trim()}
						title="Find address"
						aria-label="Find address"
						className="grid size-11 shrink-0 place-items-center rounded-md bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40"
					>
						<Search className="size-5" aria-hidden />
					</button>
					<button
						type="button"
						onClick={locate}
						disabled={locating}
						title="Use my location"
						aria-label="Use my location"
						className="grid size-11 shrink-0 place-items-center rounded-md border border-neutral-300 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
					>
						<LocateFixed className={`size-5 ${locating ? "animate-pulse" : ""}`} aria-hidden />
					</button>
				</form>
				<div className="flex items-center justify-between gap-2 text-sm">
					<span className="text-neutral-600 dark:text-neutral-400">Or tap the map.</span>
					<label className="flex items-center gap-2">
						Within
						<select
							value={radiusFt}
							onChange={(e) => onRadius(Number(e.target.value))}
							className="h-11 rounded-md border border-neutral-300 bg-white px-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
						>
							<option value={150}>150 ft</option>
							<option value={300}>300 ft</option>
							<option value={600}>600 ft</option>
						</select>
					</label>
				</div>
				{(message || addrError) && (
					<p role="alert" className="text-sm text-red-700 dark:text-red-400">
						{message ?? `Couldn't load addresses: ${addrError}`}
					</p>
				)}
			</div>

			{!center && (
				<p className="p-4 text-sm text-neutral-600 dark:text-neutral-400">
					See every public tree recorded near an address: species, trunk size, height and crown spread. Addresses are
					matched to street address ranges, so locations are approximate. Nothing you type leaves this page.
				</p>
			)}
			{center && treesLoading && <p className="p-4 text-sm text-neutral-500">Loading trees…</p>}
			{treesError && <p className="p-4 text-sm text-red-700 dark:text-red-400">Couldn't load trees: {treesError}</p>}

			{center && nearby && (
				<div className="space-y-3 p-3">
					<p className="text-sm">
						<strong>{total}</strong> public {total === 1 ? "tree" : "trees"} within {radiusFt} ft of {center.label}
						{total > 0 && (
							<>
								{" "}
								· {nearby.speciesCount} species · ~{nearby.canopySqft.toLocaleString()} sq ft canopy
							</>
						)}
					</p>
					{top && total >= 10 && (
						<p className="text-sm text-neutral-700 dark:text-neutral-300">
							Most common genus here: {niceName(top.label)} ({top.genus}), {pct(top.count / total)} of trees
							{top.count / total > 0.2 ? " — above the 20% guideline." : "."}
						</p>
					)}
					{total > 0 && (
						<ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Tree colors on the map">
							{nearby.legend.map((l) => (
								<li key={l.genus} className="flex items-center gap-1.5">
									<span
										className="size-3 rounded-full ring-2 ring-white dark:ring-neutral-950"
										style={{ background: l.color }}
										aria-hidden
									/>
									{l.genus === "Other" ? "Other genera" : `${niceName(l.label)} (${l.genus})`} · {l.count}
								</li>
							))}
						</ul>
					)}
				</div>
			)}

			{center && nearby && total > 0 && (
				<ol aria-label="Nearby trees, closest first">
					{nearby.trees.slice(0, 300).map((t) => (
						<li key={t.idx} className="border-b border-neutral-100 dark:border-neutral-800/60">
							<button
								type="button"
								onClick={() => onSelectTree(t.idx)}
								aria-current={t.idx === selectedTree}
								className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-100 aria-[current=true]:bg-blue-50 dark:hover:bg-neutral-800 dark:aria-[current=true]:bg-blue-950"
							>
								<span className="size-3 shrink-0 rounded-full" style={{ background: t.color }} aria-hidden />
								<span className="min-w-0 flex-1">
									<span className="block truncate font-medium">{niceName(t.common)}</span>
									<span className="block truncate text-xs text-neutral-600 dark:text-neutral-400">
										{[
											t.latin && <i key="l">{t.latin}</i>,
											fmt(t.dbh, "in DBH"),
											fmt(t.height, "ft tall"),
											fmt(t.spread, "ft wide"),
										]
											.filter(Boolean)
											.flatMap((part, i) => (i ? [" · ", part] : [part]))}
									</span>
								</span>
								<span className="shrink-0 text-sm text-neutral-600 tabular-nums dark:text-neutral-400">
									{Math.round(t.distFt)} ft
								</span>
							</button>
							{t.idx === selectedTree && (
								<button
									type="button"
									onClick={() => onOpenBlock(t.block)}
									className="mb-2 ml-9 min-h-11 rounded-md px-2 text-sm text-blue-700 underline hover:bg-neutral-100 dark:text-blue-400 dark:hover:bg-neutral-800"
								>
									View {t.block} block
								</button>
							)}
						</li>
					))}
					{total > 300 && <li className="p-3 text-xs text-neutral-500">Showing the closest 300 trees.</li>}
				</ol>
			)}
		</div>
	);
}

const fmt = (v: number | null, unit: string) => (v ? `${v} ${unit}` : `— ${unit}`);

const titleCase = (s: string) =>
	s
		.toLowerCase()
		.replace(/\b([a-z])/g, (c) => c.toUpperCase())
		.replace(/\b(N|S|E|W)\b/gi, (d) => d.toUpperCase());
