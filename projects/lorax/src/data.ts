import { useEffect, useState } from "react";

const cache = new Map<string, Promise<unknown>>();

function load<T>(file: string): Promise<T> {
	if (!cache.has(file))
		cache.set(
			file,
			fetch(`${import.meta.env.BASE_URL}data/${file}`).then((r) =>
				r.ok ? r.json() : Promise.reject(new Error(`${file}: HTTP ${r.status}`)),
			),
		);
	return cache.get(file) as Promise<T>;
}

/** Loads a JSON file from public/data once; pass enabled=false to defer large files until needed. */
export function useData<T>(file: string, enabled = true) {
	const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
	useEffect(() => {
		if (!enabled) return;
		let live = true;
		load<T>(file)
			.then((data) => live && setState({ data, error: null }))
			.catch((e) => live && setState({ data: null, error: String(e) }));
		return () => {
			live = false;
		};
	}, [file, enabled]);
	return state;
}
