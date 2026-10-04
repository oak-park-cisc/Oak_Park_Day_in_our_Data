import { ChevronDown } from "lucide-react";
import { useId } from "react";

type Option = { value: string; label: string; group?: string };

type Props = {
	label: string;
	value: string;
	options: Option[];
	onChange: (v: string) => void;
	className?: string;
};

export function Select({ label, value, options, onChange, className = "" }: Props) {
	const id = useId();
	const groups = [...new Set(options.map((o) => o.group ?? ""))];
	const render = (os: Option[]) =>
		os.map((o) => (
			<option key={o.value} value={o.value}>
				{o.label}
			</option>
		));
	return (
		<div className={`flex min-w-0 flex-col gap-1 ${className}`}>
			<label htmlFor={id} className="text-xs font-medium text-ink-2 dark:text-ink-2-dark">
				{label}
			</label>
			<div className="relative">
				<select
					id={id}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					className="min-h-11 w-full appearance-none truncate rounded-lg border border-line bg-card py-2 pr-9 pl-3 text-base focus:outline-2 focus:outline-accent sm:text-sm dark:border-line-dark dark:bg-card-dark"
				>
					{groups.length > 1
						? groups.map((g) => (
								<optgroup key={g} label={g}>
									{render(options.filter((o) => (o.group ?? "") === g))}
								</optgroup>
							))
						: render(options)}
				</select>
				<ChevronDown
					size={16}
					aria-hidden
					className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted dark:text-muted-dark"
				/>
			</div>
		</div>
	);
}
