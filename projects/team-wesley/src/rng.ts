/** Seeded mulberry32 RNG whose state lives on the game object, so saves replay identically. */
export class Rng {
	private holder: { rng: number };

	constructor(holder: { rng: number }) {
		this.holder = holder;
	}

	next(): number {
		this.holder.rng = (this.holder.rng + 0x6d2b79f5) | 0;
		let t = this.holder.rng;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	range(min: number, max: number): number {
		return min + (max - min) * this.next();
	}

	int(n: number): number {
		return Math.floor(this.next() * n);
	}

	pick<T>(arr: readonly T[]): T {
		return arr[this.int(arr.length)];
	}

	chance(p: number): boolean {
		return this.next() < p;
	}

	shuffle<T>(arr: readonly T[]): T[] {
		const out = [...arr];
		for (let i = out.length - 1; i > 0; i--) {
			const j = this.int(i + 1);
			[out[i], out[j]] = [out[j], out[i]];
		}
		return out;
	}
}

export function newSeed(): number {
	return Math.floor(Math.random() * 2 ** 31);
}
