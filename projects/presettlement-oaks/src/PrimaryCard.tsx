import { ageRange, circumference, feet } from "./format";
import { StreetViewButton } from "./StreetViewButton";
import type { Narrative, Tree } from "./types";

export function PrimaryCard({
	tree,
	narrative,
	onMore,
}: {
	tree: Tree;
	narrative?: Narrative;
	onMore: () => void;
}) {
	return (
		<div className="space-y-2 text-[15px] leading-snug">
			<div>
				<h2 className="font-semibold text-base">{tree.common}</h2>
				<p className="text-ink-2 italic">{tree.latin}</p>
			</div>
			<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
				<dt className="text-ink-2">Est. age</dt>
				<dd className="font-semibold">{ageRange(tree)}</dd>
				<dt className="text-ink-2">Circumference</dt>
				<dd>{circumference(tree)}</dd>
				<dt className="text-ink-2">Canopy</dt>
				<dd>{feet(tree.spread_ft)} wide</dd>
			</dl>
			{narrative && (
				<p className="max-h-[26dvh] overflow-y-auto">{narrative.text}</p>
			)}
			<div className="grid grid-cols-2 gap-2">
				<button
					type="button"
					onClick={onMore}
					className="min-h-11 rounded-lg bg-accent px-3 font-semibold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2"
				>
					More
				</button>
				<StreetViewButton tree={tree} />
			</div>
		</div>
	);
}
