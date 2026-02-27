import { describe, it, expect } from 'vitest';
import { offsetPolyline, offsetForTool } from '../offset.js';
import type { Polyline } from '$lib/types/geometry.js';

describe('offsetPolyline', () => {
	it('should return same polyline for zero offset', () => {
		const poly: Polyline = {
			points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
			closed: false
		};
		const result = offsetPolyline(poly, 0);
		expect(result).toHaveLength(1);
		expect(result[0].points).toEqual(poly.points);
	});

	it('should offset an open line', () => {
		const poly: Polyline = {
			points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
			closed: false
		};
		const result = offsetPolyline(poly, 1);
		expect(result).toHaveLength(1);
		// Offset should move points perpendicular (upward for positive offset with left-hand normal)
		expect(result[0].points[0].y).toBeCloseTo(1);
		expect(result[0].points[1].y).toBeCloseTo(1);
	});

	it('should handle negative offset on open line', () => {
		const poly: Polyline = {
			points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
			closed: false
		};
		const result = offsetPolyline(poly, -1);
		expect(result[0].points[0].y).toBeCloseTo(-1);
	});

	it('should offset a closed square outward (left-hand normals)', () => {
		// CW winding: left-hand normal points outward for negative offset
		const poly: Polyline = {
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 10, y: 10 },
				{ x: 0, y: 10 },
				{ x: 0, y: 0 }
			],
			closed: true
		};
		const result = offsetPolyline(poly, -1);
		expect(result).toHaveLength(1);
		expect(result[0].closed).toBe(true);
		// With CW winding, negative offset pushes outward
		const pts = result[0].points;
		expect(pts[0].x).toBeLessThan(0);
		expect(pts[0].y).toBeLessThan(0);
	});

	it('should offset a closed square inward (left-hand normals)', () => {
		const poly: Polyline = {
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 10, y: 10 },
				{ x: 0, y: 10 },
				{ x: 0, y: 0 }
			],
			closed: true
		};
		const result = offsetPolyline(poly, 1);
		expect(result).toHaveLength(1);
		const pts = result[0].points;
		expect(pts[0].x).toBeGreaterThan(0);
		expect(pts[0].y).toBeGreaterThan(0);
	});

	it('should handle single segment polyline', () => {
		const poly: Polyline = {
			points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
			closed: false
		};
		const result = offsetPolyline(poly, 2);
		expect(result).toHaveLength(1);
		expect(result[0].points).toHaveLength(2);
	});

	it('should handle polyline with < 2 points', () => {
		const poly: Polyline = { points: [{ x: 0, y: 0 }], closed: false };
		const result = offsetPolyline(poly, 1);
		expect(result[0].points).toHaveLength(1);
	});

	it('should preserve point count for closed polygon', () => {
		const poly: Polyline = {
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 10, y: 10 },
				{ x: 0, y: 10 },
				{ x: 0, y: 0 }
			],
			closed: true
		};
		const result = offsetPolyline(poly, 1);
		// Should have 4 unique points + closing point
		expect(result[0].points).toHaveLength(5);
	});

	it('should handle vertical line offset', () => {
		const poly: Polyline = {
			points: [{ x: 5, y: 0 }, { x: 5, y: 10 }],
			closed: false
		};
		const result = offsetPolyline(poly, 1);
		// Left-hand normal of vertical up line is (-1, 0) * offset
		expect(result[0].points[0].x).toBeCloseTo(4);
		expect(result[0].points[1].x).toBeCloseTo(4);
	});
});

describe('offsetForTool', () => {
	it('should return same polylines for zero radius', () => {
		const polys: Polyline[] = [
			{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false }
		];
		const result = offsetForTool(polys, 0);
		expect(result).toEqual(polys);
	});

	it('should offset multiple polylines', () => {
		const polys: Polyline[] = [
			{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false },
			{ points: [{ x: 20, y: 0 }, { x: 30, y: 0 }], closed: false }
		];
		const result = offsetForTool(polys, 1);
		expect(result).toHaveLength(2);
	});

	it('should apply positive offset for tool compensation', () => {
		const polys: Polyline[] = [
			{
				points: [
					{ x: 0, y: 0 },
					{ x: 10, y: 0 },
					{ x: 10, y: 10 },
					{ x: 0, y: 10 },
					{ x: 0, y: 0 }
				],
				closed: true
			}
		];
		const result = offsetForTool(polys, 1.5);
		// Offset should make the shape larger
		expect(result).toHaveLength(1);
	});
});
