import { CONFIDENCE, CONFIDENCE_ORDER, PRESENT_RING } from "./format";

export function Legend() {
	return (
		<section
			aria-label="Confidence legend"
			className="pointer-events-auto rounded-lg bg-surface/95 px-3 py-2 text-sm shadow-md"
		>
			<p className="mb-0.5 font-semibold">Over 200 years?</p>
			<ul className="space-y-0.5">
				{CONFIDENCE_ORDER.map((c) => (
					<li key={c} className="flex items-center gap-2">
						<span className="grid w-6 place-items-center" aria-hidden>
							<span
								className="inline-block rounded-full ring-2 ring-white"
								style={{
									background: CONFIDENCE[c].color,
									width: CONFIDENCE[c].size,
									height: CONFIDENCE[c].size,
								}}
							/>
						</span>
						{CONFIDENCE[c].label}
					</li>
				))}
				<li className="flex items-center gap-2">
					<span className="grid w-6 place-items-center" aria-hidden>
						<span
							className="inline-block size-5 rounded-full border-[3px] bg-white"
							style={{ borderColor: PRESENT_RING }}
						/>
					</span>
					Likely present at settlement (1833)
				</li>
			</ul>
		</section>
	);
}
