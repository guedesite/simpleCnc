import { describe, it, expect } from 'vitest';
import { dropCutterOnTriangle, isPointInTriangleXY, computeHeightMap } from '../drop-cutter.js';
import { ToolType, type ToolConfig } from '$lib/types/tool.js';
import type { Triangle, ZMapConfig } from '$lib/types/stl.js';

const flatTool: ToolConfig = {
	type: ToolType.FlatEnd,
	diameter: 6,
	angle: 0,
	spindleSpeed: 12000,
	feedRate: 800,
	plungeRate: 300
};

const ballTool: ToolConfig = {
	type: ToolType.BallNose,
	diameter: 6,
	angle: 0,
	spindleSpeed: 12000,
	feedRate: 800,
	plungeRate: 300
};

const vbitTool: ToolConfig = {
	type: ToolType.VBit,
	diameter: 6,
	angle: 60,
	spindleSpeed: 12000,
	feedRate: 800,
	plungeRate: 300
};

// Flat horizontal triangle at z=5
const flatTriangle: Triangle = {
	v0: { x: 0, y: 0, z: 5 },
	v1: { x: 10, y: 0, z: 5 },
	v2: { x: 5, y: 10, z: 5 }
};

// Tilted triangle
const tiltedTriangle: Triangle = {
	v0: { x: 0, y: 0, z: 0 },
	v1: { x: 10, y: 0, z: 0 },
	v2: { x: 5, y: 10, z: 10 }
};

describe('isPointInTriangleXY', () => {
	it('should detect point inside triangle', () => {
		expect(isPointInTriangleXY(5, 3, flatTriangle)).toBe(true);
	});

	it('should detect point outside triangle', () => {
		expect(isPointInTriangleXY(20, 20, flatTriangle)).toBe(false);
	});

	it('should detect point on vertex', () => {
		expect(isPointInTriangleXY(0, 0, flatTriangle)).toBe(true);
	});

	it('should detect point on edge', () => {
		expect(isPointInTriangleXY(5, 0, flatTriangle)).toBe(true);
	});

	it('should reject point clearly outside', () => {
		expect(isPointInTriangleXY(-5, -5, flatTriangle)).toBe(false);
	});
});

describe('dropCutterOnTriangle - FlatEnd', () => {
	it('should return triangle Z when directly above', () => {
		const z = dropCutterOnTriangle(5, 3, flatTriangle, flatTool, 3);
		expect(z).toBeCloseTo(5);
	});

	it('should detect contact near edge', () => {
		const z = dropCutterOnTriangle(0, 5, flatTriangle, flatTool, 3);
		expect(z).toBeGreaterThan(-Infinity);
	});

	it('should return -Infinity when far away', () => {
		const z = dropCutterOnTriangle(50, 50, flatTriangle, flatTool, 3);
		expect(z).toBe(-Infinity);
	});

	it('should return vertex Z when near vertex', () => {
		const z = dropCutterOnTriangle(0, 0, flatTriangle, flatTool, 3);
		expect(z).toBeCloseTo(5);
	});

	it('should handle tilted triangle', () => {
		const z = dropCutterOnTriangle(5, 5, tiltedTriangle, flatTool, 3);
		expect(z).toBeGreaterThan(-Infinity);
	});
});

describe('dropCutterOnTriangle - BallNose', () => {
	it('should return face Z when directly above flat triangle', () => {
		const z = dropCutterOnTriangle(5, 3, flatTriangle, ballTool, 3);
		expect(z).toBeCloseTo(5);
	});

	it('should handle edge contact', () => {
		const z = dropCutterOnTriangle(0, 1, flatTriangle, ballTool, 3);
		expect(z).toBeGreaterThan(-Infinity);
	});

	it('should handle vertex contact', () => {
		const z = dropCutterOnTriangle(0.5, 0.5, flatTriangle, ballTool, 3);
		expect(z).toBeGreaterThan(-Infinity);
	});

	it('should return -Infinity when far away', () => {
		const z = dropCutterOnTriangle(50, 50, flatTriangle, ballTool, 3);
		expect(z).toBe(-Infinity);
	});

	it('should not produce artifacts on flat surface', () => {
		// On a flat surface, all points inside the triangle should return the same Z
		const z1 = dropCutterOnTriangle(3, 2, flatTriangle, ballTool, 3);
		const z2 = dropCutterOnTriangle(5, 3, flatTriangle, ballTool, 3);
		const z3 = dropCutterOnTriangle(4, 4, flatTriangle, ballTool, 3);
		expect(z1).toBeCloseTo(5);
		expect(z2).toBeCloseTo(5);
		expect(z3).toBeCloseTo(5);
	});

	it('edge contact should give tipZ = edgeZ - r + sqrt(r²-d²)', () => {
		// Point outside triangle but within ball radius of vertex (0,0,5)
		// Distance from (-1, 0) to vertex (0,0) = 1, radius = 3
		// tipZ = 5 - 3 + sqrt(9 - 1) = 5 - 3 + 2.828 = 4.828
		const z = dropCutterOnTriangle(-1, 0, flatTriangle, ballTool, 3);
		expect(z).toBeCloseTo(4.828, 1);
	});
});

describe('dropCutterOnTriangle - VBit', () => {
	it('should return face Z when directly above flat triangle', () => {
		const z = dropCutterOnTriangle(5, 3, flatTriangle, vbitTool, 3);
		expect(z).toBeCloseTo(5);
	});

	it('should not produce artifacts on flat surface', () => {
		// On a flat surface, all points inside the triangle should return the same Z
		const z1 = dropCutterOnTriangle(3, 2, flatTriangle, vbitTool, 3);
		const z2 = dropCutterOnTriangle(5, 3, flatTriangle, vbitTool, 3);
		const z3 = dropCutterOnTriangle(4, 4, flatTriangle, vbitTool, 3);
		expect(z1).toBeCloseTo(5);
		expect(z2).toBeCloseTo(5);
		expect(z3).toBeCloseTo(5);
	});

	it('should handle edge contact with Z offset', () => {
		const z = dropCutterOnTriangle(0, 1, flatTriangle, vbitTool, 3);
		expect(z).toBeGreaterThan(-Infinity);
	});

	it('edge contact gives tipZ = edgeZ - d/tan(halfAngle)', () => {
		// Point outside triangle near vertex (0,0,5)
		// Distance from (-1, 0) to vertex (0,0) = 1
		// 60° V-bit: halfAngle = 30°, tan(30°) ≈ 0.577
		// tipZ = 5 - 1/0.577 ≈ 5 - 1.732 = 3.268
		const z = dropCutterOnTriangle(-1, 0, flatTriangle, vbitTool, 3);
		expect(z).toBeCloseTo(3.268, 1);
	});

	it('should return -Infinity when far away', () => {
		const z = dropCutterOnTriangle(50, 50, flatTriangle, vbitTool, 3);
		expect(z).toBe(-Infinity);
	});
});

describe('computeHeightMap', () => {
	it('should compute height map for simple triangle', () => {
		const config: ZMapConfig = {
			resolution: 5,
			gridWidth: 3,
			gridHeight: 3,
			physicalWidth: 10,
			physicalHeight: 10
		};

		const heightMap = computeHeightMap([flatTriangle], config, flatTool);
		expect(heightMap.data).toBeInstanceOf(Float32Array);
		expect(heightMap.data.length).toBe(9);
	});

	it('should have non-zero values where triangle exists', () => {
		const config: ZMapConfig = {
			resolution: 2,
			gridWidth: 6,
			gridHeight: 6,
			physicalWidth: 10,
			physicalHeight: 10
		};

		const heightMap = computeHeightMap([flatTriangle], config, flatTool);
		// At least some values should be non-zero (where triangle covers)
		let hasNonZero = false;
		for (let i = 0; i < heightMap.data.length; i++) {
			if (heightMap.data[i] > 0) {
				hasNonZero = true;
				break;
			}
		}
		expect(hasNonZero).toBe(true);
	});

	it('should call progress callback', () => {
		const config: ZMapConfig = {
			resolution: 1,
			gridWidth: 20,
			gridHeight: 20,
			physicalWidth: 10,
			physicalHeight: 10
		};

		let progressCalled = false;
		computeHeightMap([flatTriangle], config, flatTool, () => {
			progressCalled = true;
		});
		expect(progressCalled).toBe(true);
	});

	it('should handle empty triangle list', () => {
		const config: ZMapConfig = {
			resolution: 5,
			gridWidth: 3,
			gridHeight: 3,
			physicalWidth: 10,
			physicalHeight: 10
		};

		const heightMap = computeHeightMap([], config, flatTool);
		expect(heightMap.data.length).toBe(9);
		// All values should be 0 (default for no triangles)
		for (let i = 0; i < heightMap.data.length; i++) {
			expect(heightMap.data[i]).toBe(0);
		}
	});
});
