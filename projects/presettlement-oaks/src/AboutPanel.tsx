import { CONFIDENCE, CONFIDENCE_ORDER } from "./format";

export function AboutPanel({ count }: { count: number }) {
	return (
		<div className="space-y-4 text-[15px] leading-relaxed">
			<p>
				This map shows {count} public oaks in Oak Park, Illinois, whose
				estimated age range reaches 200 years. Some may have been growing before
				the Kettlestrings family arrived in 1833.
			</p>

			<section>
				<h3 className="font-semibold">How age is estimated</h3>
				<p>
					Age comes from trunk diameter (DBH), not tree rings, so every age is a
					range.
				</p>
				<ul className="mt-1 list-disc space-y-1 pl-5">
					<li>
						<strong>Low end:</strong> the Morton Arboretum's table of
						Chicago-area <em>street trees</em> (Dwyer 2009, 2010). Values beyond
						the table's diameters are extrapolated.
					</li>
					<li>
						<strong>High end:</strong> Morton Arboretum growth factors from
						Chicago-area <em>old-growth forest</em>.
					</li>
					<li>A tree is shown if the high end reaches 200 years.</li>
					<li>
						A gold ring marks trees{" "}
						<strong>likely present at settlement (1833)</strong>: Likely
						confidence, and the middle of the age range is at least 193 years.
					</li>
				</ul>
				<p className="mt-1">
					Old oaks that grew up in open savanna likely fall somewhere between
					the two.
				</p>
			</section>

			<section>
				<h3 className="font-semibold">Confidence</h3>
				<ul className="mt-1 space-y-1">
					{CONFIDENCE_ORDER.map((c) => (
						<li key={c} className="flex gap-2">
							<span
								className="mt-1.5 inline-block size-3 shrink-0 rounded-full ring-2 ring-white"
								style={{ background: CONFIDENCE[c].color }}
								aria-hidden
							/>
							<span>
								<strong>{CONFIDENCE[c].label}:</strong> {CONFIDENCE[c].blurb}
							</span>
						</li>
					))}
				</ul>
				<p className="mt-1 text-ink-2 text-sm">
					Based on species group (white oaks live longer), how far the range
					reaches past 200, and whether the 1830s land survey mapped the spot as
					timber.
				</p>
			</section>

			<section>
				<h3 className="font-semibold">Limits</h3>
				<ul className="list-disc space-y-1 pl-5">
					<li>
						Ages are estimates. Only tree-ring cores or records can confirm
						them.
					</li>
					<li>
						Public trees only: Village parkways and Park District parks. Private
						yards are not included.
					</li>
					<li>
						Native oaks only. Pin oaks are left out because they are almost
						always planted.
					</li>
					<li>Addresses are approximate, interpolated along the street.</li>
					<li>Narratives are generated from the data sources below.</li>
				</ul>
			</section>

			<section>
				<h3 className="font-semibold">Sources</h3>
				<ul className="list-disc space-y-1 pl-5 text-sm">
					<li>
						<a
							className="link"
							href="https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_TreeInventory_PUBLICVIEW/FeatureServer/0"
						>
							Village of Oak Park tree inventory
						</a>
						, via{" "}
						<a
							className="link"
							href="https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data"
						>
							Oak Park Day in our Data
						</a>
					</li>
					<li>
						<a
							className="link"
							href="https://services.arcgis.com/QPJQ2OoF7CFF9UvK/arcgis/rest/services/PDOP_Trees_8_30_22_Public/FeatureServer/0"
						>
							Park District of Oak Park tree inventory
						</a>{" "}
						(2022)
					</li>
					<li>
						<a
							className="link"
							href="http://content.govdelivery.com/attachments/INSTATE/2015/01/12/file_attachments/355000/TMAestimatetreeDBH_Age.pdf"
						>
							Morton Arboretum, Estimated Age of Urban Trees by Species and
							Diameter
						</a>
					</li>
					<li>
						<a
							className="link"
							href="https://friendsofeloisebutler.org/pages/photosubpages/photoinfopages/treeagecalculator.html"
						>
							Morton Arboretum old-growth growth factors
						</a>{" "}
						(as summarized by Friends of Eloise Butler)
					</li>
					<li>
						<a
							className="link"
							href="https://clearinghouse.isgs.illinois.edu/data/landcover/illinois-landcover-early-1800s"
						>
							Illinois landcover in the early 1800s
						</a>{" "}
						(INHS / ISGS)
					</li>
					<li>Village Historic Building Dataset and historic districts</li>
				</ul>
			</section>
		</div>
	);
}
