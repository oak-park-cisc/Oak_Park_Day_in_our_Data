import {
	ageRange,
	CONFIDENCE,
	CONFIDENCE_ORDER,
	PRESENT_RING,
	place,
	presentAtSettlement,
} from "./format";
import type { Tree } from "./types";

export function ListPanel({
	trees,
	onPick,
}: {
	trees: Tree[];
	onPick: (key: string) => void;
}) {
	return (
		<div className="space-y-4">
			{CONFIDENCE_ORDER.map((c) => {
				const group = trees.filter((t) => t.confidence === c);
				if (!group.length) return null;
				return (
					<section key={c}>
						<h3 className="mb-1 flex items-center gap-2 font-semibold">
							<span
								className="inline-block size-3 rounded-full ring-2 ring-white"
								style={{ background: CONFIDENCE[c].color }}
								aria-hidden
							/>
							{CONFIDENCE[c].label}
							<span className="font-normal text-ink-2">({group.length})</span>
						</h3>
						<ul className="divide-y divide-line">
							{group.map((t) => (
								<li key={t.key}>
									<button
										type="button"
										onClick={() => onPick(t.key)}
										className="flex min-h-11 w-full items-baseline gap-2 rounded-md px-1 py-2 text-left hover:bg-hover"
									>
										<span className="flex-1">
											<span className="font-medium">{t.common}</span>
											{presentAtSettlement(t) && (
												<span
													className="ml-1.5 inline-block size-3 rounded-full border-2 align-middle"
													style={{ borderColor: PRESENT_RING }}
													role="img"
													aria-label="Likely present at settlement (1833)"
													title="Likely present at settlement (1833)"
												/>
											)}
											<span className="block text-ink-2 text-sm">
												{place(t)}
											</span>
										</span>
										<span className="whitespace-nowrap text-sm">
											{ageRange(t)}
										</span>
									</button>
								</li>
							))}
						</ul>
					</section>
				);
			})}
		</div>
	);
}
