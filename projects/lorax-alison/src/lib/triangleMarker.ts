import L from "leaflet";

// Equilateral triangle with the same area as a circle of the marker's radius.
const AREA_MATCH = Math.sqrt(Math.PI / ((3 * Math.sqrt(3)) / 4));

type CanvasInternals = {
	_drawing: boolean;
	_ctx: CanvasRenderingContext2D;
	_fillStroke: (ctx: CanvasRenderingContext2D, layer: L.Path) => void;
};

type MarkerInternals = {
	_renderer: CanvasInternals;
	_point: L.Point;
	_radius: number;
	_empty: () => boolean;
};

/**
 * A canvas-rendered triangle that otherwise behaves like L.circleMarker (clicks, styling).
 * Overrides Leaflet's internal _updatePath, so it only works with the canvas renderer.
 */
const Triangle = L.CircleMarker.extend({
	_updatePath(this: MarkerInternals & L.Path) {
		const r = this._renderer;
		if (!r._drawing || this._empty()) return;
		const { x, y } = this._point;
		const R = this._radius * AREA_MATCH;
		const ctx = r._ctx;
		ctx.beginPath();
		ctx.moveTo(x, y - R);
		ctx.lineTo(x + R * 0.866, y + R / 2);
		ctx.lineTo(x - R * 0.866, y + R / 2);
		ctx.closePath();
		r._fillStroke(ctx, this);
	},
});

export const triangleMarker = (
	latlng: L.LatLngExpression,
	options: L.CircleMarkerOptions,
) => {
	// Leaflet's extend() returns a class typed without constructor arguments.
	const Ctor = Triangle as unknown as new (
		latlng: L.LatLngExpression,
		options: L.CircleMarkerOptions,
	) => L.CircleMarker;
	return new Ctor(latlng, options);
};
