import type { Polyline } from '$lib/types/geometry.js';
import { distance2D } from '$lib/utils/math.js';

/**
 * Greedy nearest-neighbor path ordering with 2-opt refinement.
 * Reorders polylines to minimize rapid travel distance.
 * Also considers reversing open polylines if it brings the start closer.
 */
export function optimizePathOrder(polylines: Polyline[]): Polyline[] {
	if (polylines.length <= 1) return polylines;

	// Phase 1: Greedy nearest-neighbor
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

	// Phase 2: 2-opt local improvement
	if (result.length > 3) {
		return twoOptRefine(result);
	}

	return result;
}

/**
 * Get the start point of a polyline (where rapid approaches).
 */
function startOf(poly: Polyline) {
	return poly.points[0];
}

/**
 * Get the end point of a polyline (where tool finishes).
 */
function endOf(poly: Polyline) {
	return poly.points[poly.points.length - 1];
}

/**
 * Cost of traveling from the end of poly at index `from` to the start
 * of poly at index `to`. Index -1 means origin (0,0).
 */
function travelCost(order: Polyline[], from: number): number {
	if (from < 0) {
		return distance2D({ x: 0, y: 0 }, startOf(order[0]));
	}
	if (from >= order.length - 1) return 0;
	return distance2D(endOf(order[from]), startOf(order[from + 1]));
}

/**
 * 2-opt local search: repeatedly try reversing sub-sequences
 * to reduce total rapid travel distance. O(n^2) per pass.
 * Limited to a reasonable number of iterations for large path sets.
 */
function twoOptRefine(order: Polyline[]): Polyline[] {
	const n = order.length;
	const maxPasses = Math.min(20, n); // cap iterations for very large sets

	let improved = true;
	let passes = 0;

	while (improved && passes < maxPasses) {
		improved = false;
		passes++;

		for (let i = 0; i < n - 1; i++) {
			for (let j = i + 1; j < n; j++) {
				// Calculate current cost of edges broken by reversing [i..j]
				const prevEnd = i === 0 ? { x: 0, y: 0 } : endOf(order[i - 1]);
				const nextStart = j === n - 1 ? null : startOf(order[j + 1]);

				const currentCost =
					distance2D(prevEnd, startOf(order[i])) +
					segmentTravelCost(order, i, j) +
					(nextStart ? distance2D(endOf(order[j]), nextStart) : 0);

				// If we reverse [i..j], the sub-sequence plays backward
				// Each polyline in [i..j] stays un-reversed internally,
				// but their order is flipped.
				const reversedCost =
					distance2D(prevEnd, startOf(reverseSubPoly(order[j]))) +
					segmentTravelCostReversed(order, i, j) +
					(nextStart ? distance2D(endOf(reverseSubPoly(order[i])), nextStart) : 0);

				if (reversedCost < currentCost - 0.001) {
					// Apply the reversal
					reverseSubSequence(order, i, j);
					improved = true;
				}
			}
		}
	}

	return order;
}

/**
 * Sum of travel costs within a sub-sequence [i..j].
 */
function segmentTravelCost(order: Polyline[], i: number, j: number): number {
	let cost = 0;
	for (let k = i; k < j; k++) {
		cost += distance2D(endOf(order[k]), startOf(order[k + 1]));
	}
	return cost;
}

/**
 * Sum of travel costs within a reversed sub-sequence [i..j].
 * When reversed, order[j] comes first, then j-1, etc.
 * Each polyline must also be reversed if it's open.
 */
function segmentTravelCostReversed(order: Polyline[], i: number, j: number): number {
	let cost = 0;
	for (let k = j; k > i; k--) {
		cost += distance2D(endOf(reverseSubPoly(order[k])), startOf(reverseSubPoly(order[k - 1])));
	}
	return cost;
}

/**
 * Returns a reversed-direction version of a polyline for cost calculation.
 * Closed polylines keep their winding, open ones are reversed.
 */
function reverseSubPoly(poly: Polyline): Polyline {
	if (poly.closed) return poly; // closed polys: start/end same conceptually
	return { points: [...poly.points].reverse(), closed: false };
}

/**
 * Reverse the sub-sequence of polylines in-place, also reversing
 * open polyline point order so the tool enters from the other end.
 */
function reverseSubSequence(order: Polyline[], i: number, j: number): void {
	let left = i;
	let right = j;
	while (left < right) {
		const tmp = order[left];
		order[left] = order[right];
		order[right] = tmp;
		left++;
		right--;
	}
	// Reverse open polylines within the sub-sequence
	for (let k = i; k <= j; k++) {
		if (!order[k].closed) {
			order[k] = { points: [...order[k].points].reverse(), closed: false };
		}
	}
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
