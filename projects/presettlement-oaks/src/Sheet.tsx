import { type ReactNode, useEffect, useRef } from "react";
import { CloseIcon } from "./icons";

/** Bottom sheet on phones, right-hand side panel on wider screens. */
export function Sheet({
	title,
	large = false,
	onClose,
	children,
}: {
	title: string;
	/** Bigger heading, used for the tree species in the details panel. */
	large?: boolean;
	onClose: () => void;
	children: ReactNode;
}) {
	const ref = useRef<HTMLElement>(null);
	useEffect(() => {
		ref.current?.focus();
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<section
			ref={ref}
			tabIndex={-1}
			aria-label={title}
			className="absolute inset-x-0 bottom-0 z-[1000] flex max-h-[70dvh] flex-col rounded-t-2xl bg-surface shadow-2xl outline-none md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[400px] md:rounded-none md:border-line md:border-l"
		>
			<header className="flex items-center gap-2 border-line border-b py-1 pr-1 pl-4">
				<h2
					className={`flex-1 truncate font-semibold ${large ? "text-2xl" : "text-lg"}`}
				>
					{title}
				</h2>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					title="Close"
					className="grid size-11 place-items-center rounded-lg hover:bg-hover"
				>
					<CloseIcon />
				</button>
			</header>
			<div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
				{children}
			</div>
		</section>
	);
}
