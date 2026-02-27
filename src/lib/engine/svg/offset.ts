import type { Point2D, Polyline } from '$lib/types/geometry.js';

/**
 * Offset a polyline by a given distance using a simplified approach.
 * Positive offset = outward (for closed), negative = inward.
 * This uses a simple parallel line offset method for open paths
 * and a polygon offset approach for closed paths.
 */
export function offsetPolyline(polyline: Polyline, offset: number): Polyline[] {
	if (offset === 0) return [polyline];
	if (polyline.points.length < 2) return [polyline];

	if (polyline.closed) {
		return offsetClosedPolyline(polyline, offset);
	} else {
		return offsetOpenPolyline(polyline, offset);
	}
}

/**
 * Offset multiple polylines by tool radius for tool compensation.
 * @param polylines Input polylines
 * @param toolRadius Tool radius in mm (positive = outside, negative = inside)
 */
export function offsetForTool(polylines: Polyline[], toolRadius: number): Polyline[] {
	if (toolRadius === 0) return polylines;

	const result: Polyline[] = [];
	for (const polyline of polylines) {
		const offset = offsetPolyline(polyline, toolRadius);
		result.push(...offset);
	}
	return result;
}

function offsetClosedPolyline(polyline: Polyline, offset: number): Polyline[] {
	const { points } = polyline;
	if (points.length < 3) return [polyline];

	// Remove duplicate closing point if present
	let pts = points;
	if (pts.length > 1 && Math.abs(pts[0].x - pts[pts.length - 1].x) < 0.001 &&
		Math.abs(pts[0].y - pts[pts.length - 1].y) < 0.001) {
		pts = pts.slice(0, -1);
	}

	if (pts.length < 3) return [polyline];

	const normals = computeEdgeNormals(pts, true);
	const offsetPoints: Point2D[] = [];

	for (let i = 0; i < pts.length; i++) {
		const prev = (i - 1 + pts.length) % pts.length;
		const n1 = normals[prev];
		const n2 = normals[i];

		// Miter join: bisector of two normals
		const bisector = bisectNormals(n1, n2);
		const dot = n1.x * bisector.x + n1.y * bisector.y;
		const miterLen = dot !== 0 ? offset / dot : offset;

		offsetPoints.push({
			x: pts[i].x + bisector.x * miterLen,
			y: pts[i].y + bisector.y * miterLen
		});
	}

	// Close the polygon
	offsetPoints.push({ ...offsetPoints[0] });

	return [{ points: offsetPoints, closed: true }];
}

function offsetOpenPolyline(polyline: Polyline, offset: number): Polyline[] {
	const { points } = polyline;
	if (points.length < 2) return [polyline];

	const normals = computeEdgeNormals(points, false);
	const offsetPoints: Point2D[] = [];

	// First point: use first edge normal
	offsetPoints.push({
		x: points[0].x + normals[0].x * offset,
		y: points[0].y + normals[0].y * offset
	});

	// Interior points: bisector of adjacent normals
	for (let i = 1; i < points.length - 1; i++) {
		const n1 = normals[i - 1];
		const n2 = normals[i];
		const bisector = bisectNormals(n1, n2);
		const dot = n1.x * bisector.x + n1.y * bisector.y;
		const miterLen = dot !== 0 ? offset / dot : offset;

		offsetPoints.push({
			x: points[i].x + bisector.x * miterLen,
			y: points[i].y + bisector.y * miterLen
		});
	}

	// Last point: use last edge normal
	const lastIdx = points.length - 1;
	const lastNormal = normals[normals.length - 1];
	offsetPoints.push({
		x: points[lastIdx].x + lastNormal.x * offset,
		y: points[lastIdx].y + lastNormal.y * offset
	});

	return [{ points: offsetPoints, closed: false }];
}

function computeEdgeNormals(points: Point2D[], closed: boolean): Point2D[] {
	const normals: Point2D[] = [];
	const len = closed ? points.length : points.length - 1;

	for (let i = 0; i < len; i++) {
		const next = (i + 1) % points.length;
		const dx = points[next].x - points[i].x;
		const dy = points[next].y - points[i].y;
		const d = Math.sqrt(dx * dx + dy * dy);
		if (d > 0) {
			// Left-hand normal
			normals.push({ x: -dy / d, y: dx / d });
		} else {
			normals.push({ x: 0, y: 0 });
		}
	}

	return normals;
}

function bisectNormals(n1: Point2D, n2: Point2D): Point2D {
	const bx = n1.x + n2.x;
	const by = n1.y + n2.y;
	const d = Math.sqrt(bx * bx + by * by);
	if (d < 0.0001) {
		return n1;
	}
	return { x: bx / d, y: by / d };
}
