import { describe, it, expect } from 'vitest';
import { polylinesToToolPath, toolPathToFloat32Array, MoveType } from '../toolpath.js';

describe('polylinesToToolPath', () => {
	it('should create empty toolpath for empty input', () => {
		const result = polylinesToToolPath([], 1, 5, 800, 300);
		expect(result.segments).toHaveLength(0);
		expect(result.stats.totalDistance).toBe(0);
	});

	it('should create rapid+plunge+cut+retract for single polyline', () => {
		const polylines = [
			{ points: [{ x: 10, y: 10 }, { x: 20, y: 10 }] }
		];
		const result = polylinesToToolPath(polylines, 1, 5, 800, 300);

		const moveTypes = result.segments.map((s) => s.moveType);
		expect(moveTypes).toContain(MoveType.Rapid);
		expect(moveTypes).toContain(MoveType.Plunge);
		expect(moveTypes).toContain(MoveType.Cut);
		expect(moveTypes).toContain(MoveType.Retract);
	});

	it('should use correct Z values', () => {
		const polylines = [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }];
		const result = polylinesToToolPath(polylines, 2, 5, 800, 300);

		// Find plunge segment
		const plunge = result.segments.find((s) => s.moveType === MoveType.Plunge);
		expect(plunge).toBeDefined();
		expect(plunge!.points[1].z).toBe(-2); // -cutDepth

		// Find retract segment
		const retract = result.segments.find((s) => s.moveType === MoveType.Retract);
		expect(retract).toBeDefined();
		expect(retract!.points[1].z).toBe(5); // safeZ
	});

	it('should calculate cutting distance', () => {
		const polylines = [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }];
		const result = polylinesToToolPath(polylines, 1, 5, 800, 300);
		expect(result.stats.cuttingDistance).toBe(10);
	});

	it('should handle multiple polylines', () => {
		const polylines = [
			{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
			{ points: [{ x: 20, y: 0 }, { x: 30, y: 0 }] }
		];
		const result = polylinesToToolPath(polylines, 1, 5, 800, 300);
		// 2 polylines generate segments: rapid/plunge/cut/retract each, but some rapids may be merged
		expect(result.segments.length).toBeGreaterThanOrEqual(7);
	});

	it('should compute estimated time', () => {
		const polylines = [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }];
		const result = polylinesToToolPath(polylines, 1, 5, 1000, 500);
		expect(result.stats.estimatedTime).toBeGreaterThan(0);
		// Cutting time = 100mm / 1000mm/min = 0.1 min
		expect(result.stats.estimatedTime).toBeGreaterThanOrEqual(0.1);
	});

	it('should skip empty polylines', () => {
		const polylines = [{ points: [] }, { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }];
		const result = polylinesToToolPath(polylines, 1, 5, 800, 300);
		expect(result.stats.cuttingDistance).toBe(10);
	});
});

describe('toolPathToFloat32Array', () => {
	it('should convert toolpath to flat array', () => {
		const polylines = [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }];
		const toolPath = polylinesToToolPath(polylines, 1, 5, 800, 300);
		const arr = toolPathToFloat32Array(toolPath);

		expect(arr).toBeInstanceOf(Float32Array);
		expect(arr.length).toBeGreaterThan(0);
		// Each point is 4 floats: x, y, z, moveType
		expect(arr.length % 4).toBe(0);
	});

	it('should encode move types correctly', () => {
		const polylines = [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }];
		const toolPath = polylinesToToolPath(polylines, 1, 5, 800, 300);
		const arr = toolPathToFloat32Array(toolPath);

		// Check that move types are 0-3
		for (let i = 3; i < arr.length; i += 4) {
			expect(arr[i]).toBeGreaterThanOrEqual(0);
			expect(arr[i]).toBeLessThanOrEqual(3);
		}
	});
});
