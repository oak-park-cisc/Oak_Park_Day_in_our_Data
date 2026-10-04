import { SquareDashedMousePointer, TreeDeciduous } from "lucide-react";
import { useEffect, useRef } from "react";

type Props = {
	open: boolean;
	onClose: () => void;
	/** Close and switch on rectangle drawing */
	onStart: () => void;
};

export function Welcome({ open, onClose, onStart }: Props) {
	const ref = useRef<HTMLDialogElement>(null);
	const startBtn = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const d = ref.current;
		if (!d) return;
		if (open && !d.open) {
			d.showModal();
			// The main action gets focus, not the first button in the markup.
			startBtn.current?.focus();
		}
		if (!open && d.open) d.close();
	}, [open]);

	const close = (start: boolean) => {
		if (start) onStart();
		else onClose();
	};

	return (
		<dialog
			ref={ref}
			aria-labelledby="welcome-title"
			onCancel={(e) => {
				e.preventDefault();
				close(false);
			}}
			className="m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-xl bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-black/50 dark:bg-neutral-900 dark:text-neutral-100"
		>
			<div className="space-y-4 p-5">
				<div className="flex items-center gap-3">
					<span className="grid size-11 shrink-0 place-items-center rounded-full bg-green-100 dark:bg-green-950">
						<TreeDeciduous className="size-6 text-green-700 dark:text-green-400" aria-hidden />
					</span>
					<h2 id="welcome-title" className="text-lg font-semibold">
						Welcome to Oak Park's street trees
					</h2>
				</div>
				<p className="text-sm text-neutral-700 dark:text-neutral-300">
					See how diverse and shady the Village's 18,834 public trees are, block by block.
				</p>
				<div className="flex gap-3 rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-950/60">
					<SquareDashedMousePointer className="mt-0.5 size-5 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden />
					<p>
						<strong>To get started, draw a rectangle on the map.</strong> Tap one corner, then the opposite corner.
						You'll get the trees, species mix, size and estimated canopy for that area.
					</p>
				</div>
				<p className="text-xs text-neutral-600 dark:text-neutral-400">
					The other tabs rank blocks, show trees near an address, compare school zones and show satellite tree cover.
				</p>
				<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<button
						type="button"
						onClick={() => close(false)}
						className="h-11 rounded-md border border-neutral-300 px-4 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
					>
						Explore first
					</button>
					<button
						ref={startBtn}
						type="button"
						onClick={() => close(true)}
						className="flex h-11 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-medium text-white hover:bg-blue-800"
					>
						<SquareDashedMousePointer className="size-4" aria-hidden />
						Draw a rectangle
					</button>
				</div>
			</div>
		</dialog>
	);
}
