import { describe, it, expect } from 'vitest';
import { optimizePathOrder, computeRapidDistance } from '../optimizer.js';
import type { Polyline } from '$lib/types/geometry.js';

describe('optimizePathOrder', () => {
	it('should return empty for empty input', () => {
		expect(optimizePathOrder([])).toEqual([]);
	});

	it('should return single polyline unchanged', () => {
		const polys: Polyline[] = [
			{ points: [{ x: 10, y: 10 }, { x: 20, y: 20 }], closed: false }
		];
		const result = optimizePathOrder(polys);
		expect(result).toHaveLength(1);
	});

	it('should reorder polylines for shorter travel', () => {
		const polys: Polyline[] = [
			{ points: [{ x: 100, y: 100 }, { x: 110, y: 100 }], closed: false },
			{ points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], closed: false },
			{ points: [{ x: 50, y: 50 }, { x: 60, y: 60 }], closed: false }
		];
		const result = optimizePathOrder(polys);
		// Starting from origin (0,0), nearest should be (1,1)
		expect(result[0].points[0].x).toBeCloseTo(1);
	});

	it('should consider reversing open polylines', () => {
		const polys: Polyline[] = [
			// This polyline ends at (1,1) which is closer to origin
			{ points: [{ x: 50, y: 50 }, { x: 1, y: 1 }], closed: false },
			{ points: [{ x: 100, y: 100 }, { x: 110, y: 110 }], closed: false }
		];
		const result = optimizePathOrder(polys);
		// First polyline should be reversed so it starts at (1,1)
		expect(result[0].points[0].x).toBeCloseTo(1);
		expect(result[0].points[0].y).toBeCloseTo(1);
	});

	it('should not reverse closed polylines', () => {
		const polys: Polyline[] = [
			{ points: [{ x: 50, y: 50 }, { x: 1, y: 1 }], closed: true },
			{ points: [{ x: 100, y: 100 }, { x: 110, y: 110 }], closed: false }
		];
		const result = optimizePathOrder(polys);
		// Closed polyline should keep its original order
		const firstPoly = result[0];
		if (firstPoly.closed) {
			expect(firstPoly.points[0].x).toBe(50);
		}
	});

	it('should handle polylines with empty points', () => {
		const polys: Polyline[] = [
			{ points: [], closed: false },
			{ points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], closed: false }
		];
		const result = optimizePathOrder(polys);
		expect(result.length).toBeGreaterThanOrEqual(1);
	});

	it('should produce lower rapid distance than unoptimized', () => {
		const polys: Polyline[] = [
			{ points: [{ x: 90, y: 90 }, { x: 95, y: 95 }], closed: false },
			{ points: [{ x: 0, y: 0 }, { x: 5, y: 5 }], closed: false },
			{ points: [{ x: 45, y: 45 }, { x: 50, y: 50 }], closed: false }
		];
		const unoptimizedDist = computeRapidDistance(polys);
		const optimized = optimizePathOrder(polys);
		const optimizedDist = computeRapidDistance(optimized);
		expect(optimizedDist).toBeLessThanOrEqual(unoptimizedDist);
	});
});

describe('computeRapidDistance', () => {
	it('should return 0 for empty input', () => {
		expect(computeRapidDistance([])).toBe(0);
	});

	it('should compute distance from origin to first point', () => {
		const polys: Polyline[] = [
			{ points: [{ x: 3, y: 4 }], closed: false }
		];
		expect(computeRapidDistance(polys)).toBe(5);
	});

	it('should sum distances between polylines', () => {
		const polys: Polyline[] = [
			{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false },
			{ points: [{ x: 10, y: 0 }, { x: 20, y: 0 }], closed: false }
		];
		// From origin to (0,0) = 0, from (10,0) to (10,0) = 0
		expect(computeRapidDistance(polys)).toBe(0);
	});
});
