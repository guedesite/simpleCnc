import { describe, it, expect } from 'vitest';
import { verticesToTriangles, computeVerticesBounds } from '../loader.js';

describe('verticesToTriangles', () => {
	it('should convert flat array to triangles', () => {
		const vertices = new Float32Array([
			0, 0, 0, 1, 0, 0, 0, 1, 0,  // Triangle 1
			1, 0, 0, 1, 1, 0, 0, 1, 0   // Triangle 2
		]);
		const triangles = verticesToTriangles(vertices);
		expect(triangles).toHaveLength(2);
		expect(triangles[0].v0).toEqual({ x: 0, y: 0, z: 0 });
		expect(triangles[0].v1).toEqual({ x: 1, y: 0, z: 0 });
		expect(triangles[0].v2).toEqual({ x: 0, y: 1, z: 0 });
	});

	it('should handle empty array', () => {
		const triangles = verticesToTriangles(new Float32Array([]));
		expect(triangles).toHaveLength(0);
	});

	it('should handle partial data (ignore incomplete triangles)', () => {
		const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]); // 8 values, need 9
		const triangles = verticesToTriangles(vertices);
		expect(triangles).toHaveLength(0);
	});
});

describe('computeVerticesBounds', () => {
	it('should compute bounds for simple geometry', () => {
		const vertices = new Float32Array([
			0, 0, 0,
			10, 5, 3,
			-2, 8, -1
		]);
		const bounds = computeVerticesBounds(vertices);
		expect(bounds.minX).toBe(-2);
		expect(bounds.maxX).toBe(10);
		expect(bounds.minY).toBe(0);
		expect(bounds.maxY).toBe(8);
		expect(bounds.minZ).toBe(-1);
		expect(bounds.maxZ).toBe(3);
	});

	it('should handle single vertex', () => {
		const vertices = new Float32Array([5, 10, 15]);
		const bounds = computeVerticesBounds(vertices);
		expect(bounds.minX).toBe(5);
		expect(bounds.maxX).toBe(5);
	});

	it('should handle all negative coordinates', () => {
		const vertices = new Float32Array([
			-5, -10, -15,
			-1, -2, -3
		]);
		const bounds = computeVerticesBounds(vertices);
		expect(bounds.minX).toBe(-5);
		expect(bounds.maxX).toBe(-1);
	});
});
