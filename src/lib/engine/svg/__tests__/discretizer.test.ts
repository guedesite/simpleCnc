import { describe, it, expect } from 'vitest';
import {
	subdividePolyline,
	deduplicatePoints,
	simplifyPolyline,
	reversePolyline,
	processPolylines
} from '../discretizer.js';
import type { Polyline } from '$lib/types/geometry.js';

describe('subdividePolyline', () => {
	it('should not change polyline with short segments', () => {
		const poly: Polyline = {
			points: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }],
			closed: false
		};
		const result = subdividePolyline(poly, 1.0);
		expect(result.points).toHaveLength(2);
	});

	it('should subdivide a long segment', () => {
		const poly: Polyline = {
			points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
			closed: false
		};
		const result = subdividePolyline(poly, 2.0);
		expect(result.points.length).toBeGreaterThan(2);
		// First and last points should remain the same
		expect(result.points[0].x).toBeCloseTo(0);
		expect(result.points[result.points.length - 1].x).toBeCloseTo(10);
	});

	it('should preserve closed flag', () => {
		const poly: Polyline = {
			points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
			closed: true
		};
		const result = subdividePolyline(poly, 2.0);
		expect(result.closed).toBe(true);
	});

	it('should handle empty polyline', () => {
		const result = subdividePolyline({ points: [], closed: false }, 1.0);
		expect(result.points).toHaveLength(0);
	});

	it('should handle maxSegmentLength <= 0', () => {
		const poly: Polyline = {
			points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
			closed: false
		};
		const result = subdividePolyline(poly, 0);
		expect(result.points).toEqual(poly.points);
	});

	it('should create evenly spaced intermediate points', () => {
		const poly: Polyline = {
			points: [{ x: 0, y: 0 }, { x: 6, y: 0 }],
			closed: false
		};
		const result = subdividePolyline(poly, 2.0);
		expect(result.points).toHaveLength(4); // 0, 2, 4, 6
		expect(result.points[1].x).toBeCloseTo(2);
		expect(result.points[2].x).toBeCloseTo(4);
	});
});

describe('deduplicatePoints', () => {
	it('should remove consecutive duplicates', () => {
		const poly: Polyline = {
			points: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 },
				{ x: 1, y: 0 },
				{ x: 1, y: 0 },
				{ x: 2, y: 0 }
			],
			closed: false
		};
		const result = deduplicatePoints(poly);
		expect(result.points).toHaveLength(3);
	});

	it('should keep points that differ by more than tolerance', () => {
		const poly: Polyline = {
			points: [
				{ x: 0, y: 0 },
				{ x: 0.01, y: 0 },
				{ x: 1, y: 0 }
			],
			closed: false
		};
		const result = deduplicatePoints(poly, 0.001);
		expect(result.points).toHaveLength(3);
	});

	it('should handle single point', () => {
		const poly: Polyline = { points: [{ x: 0, y: 0 }], closed: false };
		const result = deduplicatePoints(poly);
		expect(result.points).toHaveLength(1);
	});

	it('should handle empty polyline', () => {
		const result = deduplicatePoints({ points: [], closed: false });
		expect(result.points).toHaveLength(0);
	});
});

describe('simplifyPolyline', () => {
	it('should not simplify 2-point polyline', () => {
		const poly: Polyline = {
			points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
			closed: false
		};
		const result = simplifyPolyline(poly, 1.0);
		expect(result.points).toHaveLength(2);
	});

	it('should keep points that deviate significantly', () => {
		const poly: Polyline = {
			points: [
				{ x: 0, y: 0 },
				{ x: 5, y: 10 }, // Big deviation
				{ x: 10, y: 0 }
			],
			closed: false
		};
		const result = simplifyPolyline(poly, 1.0);
		expect(result.points).toHaveLength(3);
	});

	it('should remove collinear points', () => {
		const poly: Polyline = {
			points: [
				{ x: 0, y: 0 },
				{ x: 5, y: 0 },
				{ x: 10, y: 0 }
			],
			closed: false
		};
		const result = simplifyPolyline(poly, 0.1);
		expect(result.points).toHaveLength(2);
	});

	it('should preserve start and end points', () => {
		const poly: Polyline = {
			points: [
				{ x: 0, y: 0 },
				{ x: 1, y: 0.001 },
				{ x: 2, y: 0.001 },
				{ x: 3, y: 0 },
				{ x: 10, y: 0 }
			],
			closed: false
		};
		const result = simplifyPolyline(poly, 0.5);
		expect(result.points[0]).toEqual({ x: 0, y: 0 });
		expect(result.points[result.points.length - 1]).toEqual({ x: 10, y: 0 });
	});
});

describe('reversePolyline', () => {
	it('should reverse point order', () => {
		const poly: Polyline = {
			points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }],
			closed: false
		};
		const result = reversePolyline(poly);
		expect(result.points[0].x).toBe(10);
		expect(result.points[2].x).toBe(0);
	});

	it('should preserve closed flag', () => {
		const poly: Polyline = {
			points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }],
			closed: true
		};
		expect(reversePolyline(poly).closed).toBe(true);
	});

	it('should not modify original', () => {
		const poly: Polyline = {
			points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
			closed: false
		};
		reversePolyline(poly);
		expect(poly.points[0].x).toBe(0);
	});
});

describe('processPolylines', () => {
	it('should process a batch of polylines', () => {
		const polylines: Polyline[] = [
			{
				points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
				closed: false
			}
		];
		const result = processPolylines(polylines);
		expect(result).toHaveLength(1);
		// Should have removed duplicate and possibly simplified
		expect(result[0].points.length).toBeGreaterThanOrEqual(2);
	});

	it('should filter out polylines with < 2 points after dedup', () => {
		const polylines: Polyline[] = [
			{ points: [{ x: 0, y: 0 }, { x: 0, y: 0 }], closed: false }
		];
		const result = processPolylines(polylines);
		expect(result).toHaveLength(0);
	});

	it('should handle empty input', () => {
		expect(processPolylines([])).toEqual([]);
	});
});
