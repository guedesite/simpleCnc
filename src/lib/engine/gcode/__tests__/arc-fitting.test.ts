import { describe, it, expect } from 'vitest';
import { fitCircle, detectArcs, simplifyCollinear } from '../arc-fitting.js';
import type { Point3D } from '$lib/types/geometry.js';

describe('fitCircle', () => {
	it('should fit a circle through three points on a known circle', () => {
		// Points on a circle of radius 5 centered at (5, 0)
		const result = fitCircle(0, 0, 5, 5, 10, 0);
		expect(result).not.toBeNull();
		expect(result!.cx).toBeCloseTo(5, 1);
		expect(result!.cy).toBeCloseTo(0, 1);
		expect(result!.r).toBeCloseTo(5, 1);
	});

	it('should return null for collinear points', () => {
		const result = fitCircle(0, 0, 5, 0, 10, 0);
		expect(result).toBeNull();
	});

	it('should handle unit circle points', () => {
		const result = fitCircle(1, 0, 0, 1, -1, 0);
		expect(result).not.toBeNull();
		expect(result!.cx).toBeCloseTo(0, 5);
		expect(result!.cy).toBeCloseTo(0, 5);
		expect(result!.r).toBeCloseTo(1, 5);
	});
});

describe('detectArcs', () => {
	it('should return linear segments for straight line', () => {
		const points: Point3D[] = [
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 0, z: 0 },
			{ x: 2, y: 0, z: 0 },
			{ x: 3, y: 0, z: 0 },
			{ x: 4, y: 0, z: 0 }
		];
		const result = detectArcs(points);
		// All should be linear (collinear points -> no arc)
		expect(result.every((s) => s.type === 'linear')).toBe(true);
	});

	it('should detect an arc from circular points', () => {
		// Generate points on a quarter circle, R=10, center at origin
		const points: Point3D[] = [];
		const n = 20;
		for (let i = 0; i <= n; i++) {
			const angle = (i / n) * (Math.PI / 2);
			points.push({
				x: 10 * Math.cos(angle),
				y: 10 * Math.sin(angle),
				z: 0
			});
		}
		const result = detectArcs(points, 0.1);
		// Should have at least one arc segment
		const arcs = result.filter((s) => s.type === 'arc');
		expect(arcs.length).toBeGreaterThanOrEqual(1);
	});

	it('should return empty for less than 2 points', () => {
		expect(detectArcs([{ x: 0, y: 0, z: 0 }])).toHaveLength(1);
		expect(detectArcs([])).toHaveLength(0);
	});

	it('should not detect arcs with very different Z values', () => {
		const points: Point3D[] = [];
		const n = 10;
		for (let i = 0; i <= n; i++) {
			const angle = (i / n) * (Math.PI / 2);
			points.push({
				x: 10 * Math.cos(angle),
				y: 10 * Math.sin(angle),
				z: i * 0.5 // varying Z
			});
		}
		const result = detectArcs(points, 0.01);
		// Should NOT detect arcs because Z changes
		const arcs = result.filter((s) => s.type === 'arc');
		expect(arcs.length).toBe(0);
	});

	it('should output fewer segments than input for circular paths', () => {
		const points: Point3D[] = [];
		const n = 30;
		for (let i = 0; i <= n; i++) {
			const angle = (i / n) * Math.PI;
			points.push({
				x: 20 * Math.cos(angle),
				y: 20 * Math.sin(angle),
				z: -1
			});
		}
		const result = detectArcs(points, 0.1);
		// The arc detection should produce fewer segments than original point count
		expect(result.length).toBeLessThan(points.length);
	});
});

describe('simplifyCollinear', () => {
	it('should remove collinear intermediate points', () => {
		const points: Point3D[] = [
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 0, z: 0 },
			{ x: 2, y: 0, z: 0 },
			{ x: 3, y: 0, z: 0 },
			{ x: 4, y: 0, z: 0 }
		];
		const result = simplifyCollinear(points);
		expect(result).toHaveLength(2);
		expect(result[0].x).toBe(0);
		expect(result[1].x).toBe(4);
	});

	it('should keep non-collinear points', () => {
		const points: Point3D[] = [
			{ x: 0, y: 0, z: 0 },
			{ x: 5, y: 5, z: 0 },
			{ x: 10, y: 0, z: 0 }
		];
		const result = simplifyCollinear(points);
		expect(result).toHaveLength(3);
	});

	it('should handle 2-point input unchanged', () => {
		const points: Point3D[] = [
			{ x: 0, y: 0, z: 0 },
			{ x: 10, y: 0, z: 0 }
		];
		const result = simplifyCollinear(points);
		expect(result).toHaveLength(2);
	});

	it('should handle 3D collinearity', () => {
		const points: Point3D[] = [
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 1, z: 1 },
			{ x: 2, y: 2, z: 2 },
			{ x: 3, y: 3, z: 3 }
		];
		const result = simplifyCollinear(points);
		expect(result).toHaveLength(2);
	});

	it('should keep points at Z transitions', () => {
		const points: Point3D[] = [
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 0, z: 0 },
			{ x: 2, y: 0, z: -1 },
			{ x: 3, y: 0, z: -1 },
			{ x: 4, y: 0, z: -1 }
		];
		const result = simplifyCollinear(points);
		// Should keep the Z transition point
		expect(result.length).toBeLessThan(points.length);
		expect(result.length).toBeGreaterThanOrEqual(3);
	});

	it('should handle empty and single point', () => {
		expect(simplifyCollinear([])).toHaveLength(0);
		expect(simplifyCollinear([{ x: 0, y: 0, z: 0 }])).toHaveLength(1);
	});
});
