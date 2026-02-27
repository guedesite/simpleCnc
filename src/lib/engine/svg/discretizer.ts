import type { Point2D, Polyline } from '$lib/types/geometry.js';
import { distance2D } from '$lib/utils/math.js';

/**
 * Ensures all segments in a polyline are shorter than maxSegmentLength.
 * Subdivides segments that are too long.
 */
export function subdividePolyline(polyline: Polyline, maxSegmentLength: number = 1.0): Polyline {
	if (maxSegmentLength <= 0) return polyline;

	const result: Point2D[] = [];
	const { points } = polyline;

	if (points.length === 0) return { points: [], closed: polyline.closed };

	result.push(points[0]);

	for (let i = 1; i < points.length; i++) {
		const prev = points[i - 1];
		const curr = points[i];
		const dist = distance2D(prev, curr);

		if (dist > maxSegmentLength) {
			const segments = Math.ceil(dist / maxSegmentLength);
			for (let j = 1; j < segments; j++) {
				const t = j / segments;
				result.push({
					x: prev.x + (curr.x - prev.x) * t,
					y: prev.y + (curr.y - prev.y) * t
				});
			}
		}
		result.push(curr);
	}

	return { points: result, closed: polyline.closed };
}

/**
 * Removes consecutive duplicate points that are closer than tolerance.
 */
export function deduplicatePoints(polyline: Polyline, tolerance: number = 0.001): Polyline {
	if (polyline.points.length <= 1) return polyline;

	const result: Point2D[] = [polyline.points[0]];

	for (let i = 1; i < polyline.points.length; i++) {
		if (distance2D(result[result.length - 1], polyline.points[i]) > tolerance) {
			result.push(polyline.points[i]);
		}
	}

	return { points: result, closed: polyline.closed };
}

/**
 * Douglas-Peucker simplification to reduce point count while maintaining shape.
 */
export function simplifyPolyline(polyline: Polyline, epsilon: number = 0.1): Polyline {
	if (polyline.points.length <= 2) return polyline;

	const simplified = douglasPeucker(polyline.points, epsilon);
	return { points: simplified, closed: polyline.closed };
}

function douglasPeucker(points: Point2D[], epsilon: number): Point2D[] {
	if (points.length <= 2) return [...points];

	let maxDist = 0;
	let maxIndex = 0;
	const first = points[0];
	const last = points[points.length - 1];

	for (let i = 1; i < points.length - 1; i++) {
		const dist = perpendicularDistance(points[i], first, last);
		if (dist > maxDist) {
			maxDist = dist;
			maxIndex = i;
		}
	}

	if (maxDist > epsilon) {
		const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
		const right = douglasPeucker(points.slice(maxIndex), epsilon);
		return [...left.slice(0, -1), ...right];
	}

	return [first, last];
}

function perpendicularDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
	const dx = lineEnd.x - lineStart.x;
	const dy = lineEnd.y - lineStart.y;
	const lenSq = dx * dx + dy * dy;

	if (lenSq === 0) return distance2D(point, lineStart);

	const num = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
	return num / Math.sqrt(lenSq);
}

/**
 * Reverse the direction of a polyline.
 */
export function reversePolyline(polyline: Polyline): Polyline {
	return { points: [...polyline.points].reverse(), closed: polyline.closed };
}

/**
 * Process a batch of polylines: deduplicate, optionally subdivide and simplify.
 */
export function processPolylines(
	polylines: Polyline[],
	options: {
		maxSegmentLength?: number;
		simplifyEpsilon?: number;
		deduplicateTolerance?: number;
	} = {}
): Polyline[] {
	const {
		maxSegmentLength = 1.0,
		simplifyEpsilon = 0.05,
		deduplicateTolerance = 0.001
	} = options;

	return polylines
		.map((p) => deduplicatePoints(p, deduplicateTolerance))
		.filter((p) => p.points.length >= 2)
		.map((p) => simplifyPolyline(p, simplifyEpsilon))
		.map((p) => subdividePolyline(p, maxSegmentLength));
}
