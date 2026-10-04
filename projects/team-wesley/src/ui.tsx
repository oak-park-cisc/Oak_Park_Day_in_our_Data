import { Flame } from "lucide-react";
import { useState } from "react";
import { MERGE_COLOR, MERGE_NAME } from "./engine";
import type { GameData } from "./types";

const FALLBACK = [
	"#2563eb",
	"#dc2626",
	"#059669",
	"#d97706",
	"#db2777",
	"#0891b2",
];

function rgb(hex: string) {
	const h = hex.replace("#", "");
	const n = Number.parseInt(
		h.length === 3 ? [...h].map((c) => c + c).join("") : h,
		16,
	);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function far(a: string, b: string) {
	const [x, y] = [rgb(a), rgb(b)];
	return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) > 90;
}
function usable(hex: string) {
	const [r, g, b] = rgb(hex);
	const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return lum > 0.12 && lum < 0.85;
}

/** School colors where available, swapped for a distinct fallback when two tribes would look alike. */
export function tribeColors(
	d: GameData,
	schools: string[],
): Record<string, string> {
	const out: Record<string, string> = { merge: MERGE_COLOR };
	const taken: string[] = [];
	for (const id of schools) {
		const sch = d.schools.find((s) => s.id === id);
		const options = [
			...(sch?.colors ?? []),
			...(sch?.logoAccent ? [sch.logoAccent] : []),
			...FALLBACK,
		].filter(usable);
		const c =
			options.find((o) => taken.every((t) => far(o, t))) ??
			FALLBACK[taken.length % 6];
		out[id] = c;
		taken.push(c);
	}
	return out;
}

export function textOn(hex: string) {
	const [r, g, b] = rgb(hex);
	return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1c1917" : "#fff";
}

export function tribeName(d: GameData, id: string) {
	if (id === "merge") return MERGE_NAME;
	return d.schools.find((s) => s.id === id)?.short ?? id;
}

export function initials(name: string) {
	const parts = name.split(" ").filter(Boolean);
	return ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

/** Official photo when one is published; otherwise a cartoon castaway in tribe colors. */
export function Avatar({
	d,
	id,
	color,
	size = 40,
	out = false,
}: {
	d: GameData;
	id: string;
	color: string;
	size?: number;
	out?: boolean;
}) {
	const o = d.officials.find((x) => x.id === id);
	const [failed, setFailed] = useState(false);
	const style = { width: size, height: size, borderColor: color };
	const cls = `shrink-0 rounded-full border-[3px] overflow-hidden bg-white ${out ? "grayscale opacity-50" : ""}`;
	if (o?.photoUrl && !failed) {
		return (
			<img
				src={o.photoUrl}
				alt=""
				title={o.photoCredit ? `Photo: ${o.photoCredit}` : undefined}
				onError={() => setFailed(true)}
				loading="lazy"
				referrerPolicy="no-referrer"
				className={`${cls} object-cover object-top`}
				style={style}
			/>
		);
	}
	return (
		<span className={cls} style={style} aria-hidden="true">
			<svg viewBox="0 0 40 40" width="100%" height="100%" role="presentation">
				<rect width="40" height="40" fill={color} opacity="0.18" />
				<circle cx="20" cy="17" r="8" fill="#f5c9a0" />
				<path d="M11 14c2-6 16-6 18 0-5-2-13-2-18 0z" fill={color} />
				<path d="M8 40c1-9 6-13 12-13s11 4 12 13z" fill={color} />
				<circle cx="17" cy="17" r="1.1" fill="#3b2a1a" />
				<circle cx="23" cy="17" r="1.1" fill="#3b2a1a" />
				<path d="M17 21q3 2 6 0" stroke="#3b2a1a" strokeWidth="1" fill="none" />
				<text
					x="20"
					y="37"
					textAnchor="middle"
					fontSize="7"
					fontWeight="700"
					fill="#fff"
				>
					{initials(o?.name ?? "")}
				</text>
			</svg>
		</span>
	);
}

export function Btn({
	children,
	onClick,
	variant = "primary",
	disabled,
	className = "",
	type = "button",
	...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "ghost" | "outline";
}) {
	const v = {
		primary:
			"bg-orange-600 text-white hover:bg-orange-700 disabled:bg-stone-400",
		outline:
			"border border-stone-300 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50",
		ghost: "hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50",
	}[variant];
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled}
			className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed ${v} ${className}`}
			{...rest}
		>
			{children}
		</button>
	);
}

export function IconBtn({
	label,
	children,
	onClick,
	pressed,
}: {
	label: string;
	children: React.ReactNode;
	onClick: () => void;
	pressed?: boolean;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			aria-pressed={pressed}
			onClick={onClick}
			className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-orange-500 dark:hover:bg-stone-800"
		>
			{children}
		</button>
	);
}

export function Card({
	children,
	className = "",
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900 ${className}`}
		>
			{children}
		</div>
	);
}

export function TribeChip({
	d,
	id,
	color,
}: {
	d: GameData;
	id: string;
	color: string;
}) {
	return (
		<span
			className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold"
			style={{ background: color, color: textOn(color) }}
		>
			{tribeName(d, id)}
		</span>
	);
}

export const HOST = "Jeff";

/** Jeff, the host, narrating in a speech bubble. */
export function Host({ children }: { children: React.ReactNode }) {
	return (
		<figure className="flex items-start gap-3">
			<span
				className="flex size-11 shrink-0 items-center justify-center rounded-full bg-stone-800 text-orange-400 ring-2 ring-orange-500 dark:bg-stone-700"
				aria-hidden
			>
				<Flame size={22} />
			</span>
			<div className="min-w-0">
				<figcaption className="text-xs font-bold uppercase tracking-wide text-orange-700 dark:text-orange-400">
					{HOST}, your host
				</figcaption>
				<blockquote className="relative mt-0.5 rounded-xl rounded-tl-none bg-white px-3 py-2 font-medium shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">
					{children}
				</blockquote>
			</div>
		</figure>
	);
}
