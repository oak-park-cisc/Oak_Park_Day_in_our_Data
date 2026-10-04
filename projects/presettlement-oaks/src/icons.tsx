const base = {
	width: 22,
	height: 22,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round" as const,
	strokeLinejoin: "round" as const,
};

export const ListIcon = () => (
	<svg aria-hidden="true" {...base}>
		<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
	</svg>
);

export const InfoIcon = () => (
	<svg aria-hidden="true" {...base}>
		<circle cx="12" cy="12" r="10" />
		<path d="M12 16v-4M12 8h.01" />
	</svg>
);

export const CloseIcon = () => (
	<svg aria-hidden="true" {...base}>
		<path d="M18 6 6 18M6 6l12 12" />
	</svg>
);

export const WarnIcon = () => (
	<svg aria-hidden="true" {...base} width={16} height={16}>
		<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
		<path d="M12 9v4M12 17h.01" />
	</svg>
);

export const ExternalIcon = () => (
	<svg aria-hidden="true" {...base} width={18} height={18}>
		<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
	</svg>
);
