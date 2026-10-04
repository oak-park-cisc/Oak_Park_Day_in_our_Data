import { Gavel, Star } from "lucide-react";
import { TrustMeter } from "./Camp";
import { allianceOf, getRel, player } from "./engine";
import { BODY_SHORT, ordinal } from "./text";
import type { GameData, GameState } from "./types";
import { Avatar, TribeChip } from "./ui";

export function CastList({
	d,
	s,
	colors,
}: {
	d: GameData;
	s: GameState;
	colors: Record<string, string>;
}) {
	const p = player(s);
	const mine = allianceOf(s, p.id);
	const live = s.cast.filter((c) => !c.out);
	const tribes = [...new Set(live.map((c) => c.tribe))];
	const out = s.cast
		.filter((c) => c.out)
		.sort((a, b) => (a.out?.place ?? 0) - (b.out?.place ?? 0));

	const row = (
		id: string,
		tribe: string,
		faded: boolean,
		extra?: React.ReactNode,
	) => {
		const o = d.officials.find((x) => x.id === id);
		return (
			<li key={id} className="flex items-center gap-3 py-1.5">
				<Avatar
					d={d}
					id={id}
					color={colors[tribe] ?? "#78716c"}
					size={40}
					out={faded}
				/>
				<span className="min-w-0 flex-1">
					<span className="flex items-center gap-1 font-semibold">
						<span className="truncate">{o?.name}</span>
						{id === p.id && (
							<span className="rounded bg-orange-600 px-1.5 text-xs text-white">
								You
							</span>
						)}
						{mine?.members.includes(id) && id !== p.id && (
							<Star
								size={14}
								className="shrink-0 text-amber-500"
								aria-label="In your alliance"
							/>
						)}
					</span>
					<span className="block truncate text-xs text-stone-500 dark:text-stone-400">
						{o?.role}, {BODY_SHORT[o?.body ?? "Township"]}
					</span>
					{extra}
				</span>
			</li>
		);
	};

	return (
		<div className="space-y-4 p-4">
			{tribes.map((t) => (
				<section key={t}>
					<h3 className="mb-1">
						<TribeChip d={d} id={t} color={colors[t]} />
					</h3>
					<ul>
						{live
							.filter((c) => c.tribe === t)
							.map((c) =>
								row(
									c.id,
									t,
									false,
									c.id !== p.id && !p.out ? (
										<TrustMeter value={getRel(s, p.id, c.id)} />
									) : null,
								),
							)}
					</ul>
				</section>
			))}
			{out.length > 0 && (
				<section>
					<h3 className="mb-1 font-bold">Voted out</h3>
					<ul>
						{out.map((c) =>
							row(
								c.id,
								c.origTribe,
								true,
								<span className="flex items-center gap-1 text-xs">
									{ordinal(c.out?.place ?? 0)} place
									{c.juror && (
										<>
											{" · "}
											<Gavel size={12} aria-hidden /> Jury
										</>
									)}
								</span>,
							),
						)}
					</ul>
				</section>
			)}
		</div>
	);
}
