import { streetViewUrl } from "./format";
import { ExternalIcon } from "./icons";
import type { Tree } from "./types";

export function StreetViewButton({
	tree,
	className = "",
	label = "Street View",
}: {
	tree: Tree;
	className?: string;
	label?: string;
}) {
	return (
		<a
			href={streetViewUrl(tree)}
			target="_blank"
			rel="noopener noreferrer"
			title="Open Google Street View in a new tab"
			className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-accent px-3 font-semibold text-accent! no-underline hover:bg-hover dark:border-[#86b6ef] dark:text-[#86b6ef]! ${className}`}
		>
			{label}
			<ExternalIcon />
			<span className="sr-only">(opens Google Maps in a new tab)</span>
		</a>
	);
}
