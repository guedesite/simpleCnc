import type { Polyline } from '$lib/types/geometry.js';
import { distance2D } from '$lib/utils/math.js';

/**
 * Greedy nearest-neighbor path ordering.
 * Reorders polylines to minimize rapid travel distance.
 * Also considers reversing open polylines if it brings the start closer.
 */
export function optimizePathOrder(polylines: Polyline[]): Polyline[] {
	if (polylines.length <= 1) return polylines;

	const used = new Array(polylines.length).fill(false);
	const result: Polyline[] = [];
	let currentEnd = { x: 0, y: 0 };

	for (let step = 0; step < polylines.length; step++) {
		let bestIdx = -1;
		let bestDist = Infinity;
		let bestReversed = false;

		for (let i = 0; i < polylines.length; i++) {
			if (used[i]) continue;

			const poly = polylines[i];
			if (poly.points.length === 0) continue;

			const startPt = poly.points[0];
			const endPt = poly.points[poly.points.length - 1];

			// Distance to start
			const distToStart = distance2D(currentEnd, startPt);
			if (distToStart < bestDist) {
				bestDist = distToStart;
				bestIdx = i;
				bestReversed = false;
			}

			// For open polylines, also try reversed
			if (!poly.closed) {
				const distToEnd = distance2D(currentEnd, endPt);
				if (distToEnd < bestDist) {
					bestDist = distToEnd;
					bestIdx = i;
					bestReversed = true;
				}
			}
		}

		if (bestIdx === -1) break;

		used[bestIdx] = true;
		let poly = polylines[bestIdx];

		if (bestReversed) {
			poly = { points: [...poly.points].reverse(), closed: poly.closed };
		}

		result.push(poly);
		currentEnd = poly.points[poly.points.length - 1];
	}

	return result;
}

/**
 * Compute total rapid travel distance for a given path order.
 * Useful for comparing optimization results.
 */
export function computeRapidDistance(polylines: Polyline[]): number {
	let total = 0;
	let currentEnd = { x: 0, y: 0 };

	for (const poly of polylines) {
		if (poly.points.length === 0) continue;
		total += distance2D(currentEnd, poly.points[0]);
		currentEnd = poly.points[poly.points.length - 1];
	}

	return total;
}
