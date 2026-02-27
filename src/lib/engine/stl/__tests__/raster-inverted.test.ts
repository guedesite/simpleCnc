import { describe, it, expect } from 'vitest';
import { invertHeightMap, generateRasterPaths } from '../raster.js';
import { computeHeightMap } from '../drop-cutter.js';
import { ToolType, type ToolConfig } from '$lib/types/tool.js';
import type { ZMapConfig, HeightMap, Triangle } from '$lib/types/stl.js';

// ─── Shared fixtures ───────────────────────────────────────────

const flatTool: ToolConfig = {
	type: ToolType.FlatEnd,
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

// Triangle at Z=5 centered on a 20x20 stock
const testTriangle: Triangle = {
	v0: { x: 5, y: 5, z: 5 },
	v1: { x: 15, y: 5, z: 5 },
	v2: { x: 10, y: 15, z: 5 }
};

const zmapConfig: ZMapConfig = {
	resolution: 2,
	gridWidth: 11,
	gridHeight: 11,
	physicalWidth: 20,
	physicalHeight: 20
};

// ─── invertHeightMap tests ─────────────────────────────────────

describe('invertHeightMap', () => {
	it('inverts all Z values (positive → negative)', () => {
		const data = new Float32Array([0, 1, 2, 3, 4, 5]);
		const heightMap: HeightMap = {
			config: { ...zmapConfig, gridWidth: 3, gridHeight: 2 },
			data
		};

		const inverted = invertHeightMap(heightMap);
		expect(inverted.data[0]).toBeCloseTo(0);   // 0 stays 0
		expect(inverted.data[1]).toBe(-1);
		expect(inverted.data[2]).toBe(-2);
		expect(inverted.data[3]).toBe(-3);
		expect(inverted.data[4]).toBe(-4);
		expect(inverted.data[5]).toBe(-5);
	});

	it('zero values stay zero (no model → no cut)', () => {
		const data = new Float32Array([0, 0, 0, 0]);
		const heightMap: HeightMap = {
			config: { ...zmapConfig, gridWidth: 2, gridHeight: 2 },
			data
		};

		const inverted = invertHeightMap(heightMap);
		for (let i = 0; i < inverted.data.length; i++) {
			expect(inverted.data[i]).toBeCloseTo(0);
		}
	});

	it('preserves config unchanged', () => {
		const data = new Float32Array([1, 2, 3, 4]);
		const heightMap: HeightMap = {
			config: { ...zmapConfig, gridWidth: 2, gridHeight: 2 },
			data
		};

		const inverted = invertHeightMap(heightMap);
		expect(inverted.config).toBe(heightMap.config);
	});

	it('does not modify original height map', () => {
		const data = new Float32Array([1, 2, 3, 4]);
		const heightMap: HeightMap = {
			config: { ...zmapConfig, gridWidth: 2, gridHeight: 2 },
			data
		};

		invertHeightMap(heightMap);
		expect(heightMap.data[0]).toBe(1);
		expect(heightMap.data[3]).toBe(4);
	});

	it('tallest point becomes deepest cut', () => {
		const data = new Float32Array([0, 2, 5, 1]);
		const heightMap: HeightMap = {
			config: { ...zmapConfig, gridWidth: 2, gridHeight: 2 },
			data
		};

		const inverted = invertHeightMap(heightMap);
		// Max original Z = 5, so deepest inverted Z = -5
		expect(Math.min(...inverted.data)).toBe(-5);
		// No-model area stays at 0
		expect(inverted.data[0]).toBeCloseTo(0);
	});
});

// ─── End-to-end inverted mode tests ──────────────────────────

describe('Inverted mode end-to-end', () => {
	it('normal mode: raster paths have Z >= 0', () => {
		const heightMap = computeHeightMap([testTriangle], zmapConfig, flatTool);
		const paths = generateRasterPaths(heightMap, 2, 5);

		for (const path of paths) {
			if (path.isRapid) continue;
			for (const pt of path.points) {
				expect(pt.z).toBeGreaterThanOrEqual(0);
			}
		}
	});

	it('inverted mode: raster paths have Z <= 0', () => {
		const heightMap = computeHeightMap([testTriangle], zmapConfig, flatTool);
		const inverted = invertHeightMap(heightMap);
		const paths = generateRasterPaths(inverted, 2, 5);

		for (const path of paths) {
			if (path.isRapid) continue;
			for (const pt of path.points) {
				expect(pt.z).toBeLessThanOrEqual(0);
			}
		}
	});

	it('inverted mode: deepest cut corresponds to tallest model point', () => {
		const heightMap = computeHeightMap([testTriangle], zmapConfig, flatTool);
		const inverted = invertHeightMap(heightMap);
		const paths = generateRasterPaths(inverted, 2, 5);

		let minZ = 0;
		for (const path of paths) {
			if (path.isRapid) continue;
			for (const pt of path.points) {
				if (pt.z < minZ) minZ = pt.z;
			}
		}

		// Original triangle is at Z=5, inverted should cut to around Z=-5
		expect(minZ).toBeLessThanOrEqual(-4);
		expect(minZ).toBeGreaterThanOrEqual(-6); // Allow some tolerance for flat tool radius
	});

	it('inverted mode: areas without model stay at Z=0', () => {
		const heightMap = computeHeightMap([testTriangle], zmapConfig, flatTool);
		const inverted = invertHeightMap(heightMap);
		const paths = generateRasterPaths(inverted, 2, 5);

		// Check that the first row (y=0) at corners far from triangle are at Z=0
		const firstPath = paths.find(p => !p.isRapid);
		if (firstPath) {
			// First point at (0, 0) should be at Z=0 (no model there for flat tool)
			const farPt = firstPath.points[0];
			expect(farPt.z).toBeCloseTo(0, 1);
		}
	});
});

// ─── V-bit depth clamping tests ──────────────────────────────

describe('V-bit height map clamping', () => {
	it('V-bit never produces Z < 0 in height map', () => {
		// Triangle at Z=3 on a 20x20 stock
		const triangle: Triangle = {
			v0: { x: 5, y: 5, z: 3 },
			v1: { x: 15, y: 5, z: 3 },
			v2: { x: 10, y: 15, z: 3 }
		};

		const config: ZMapConfig = {
			resolution: 0.5,
			gridWidth: 41,
			gridHeight: 41,
			physicalWidth: 20,
			physicalHeight: 20
		};

		const heightMap = computeHeightMap([triangle], config, vbitTool);
		for (let i = 0; i < heightMap.data.length; i++) {
			expect(heightMap.data[i]).toBeGreaterThanOrEqual(0);
		}
	});

	it('V-bit on tall thin model: no below-stock cutting', () => {
		// Very tall, thin triangle - V-bit would normally dip deeply near edges
		const tallTriangle: Triangle = {
			v0: { x: 9, y: 5, z: 10 },
			v1: { x: 11, y: 5, z: 10 },
			v2: { x: 10, y: 7, z: 10 }
		};

		const config: ZMapConfig = {
			resolution: 0.5,
			gridWidth: 41,
			gridHeight: 41,
			physicalWidth: 20,
			physicalHeight: 20
		};

		const heightMap = computeHeightMap([tallTriangle], config, vbitTool);
		for (let i = 0; i < heightMap.data.length; i++) {
			expect(heightMap.data[i]).toBeGreaterThanOrEqual(0);
		}
	});

	it('V-bit inverted mode: cuts are below zero', () => {
		const triangle: Triangle = {
			v0: { x: 5, y: 5, z: 5 },
			v1: { x: 15, y: 5, z: 5 },
			v2: { x: 10, y: 15, z: 5 }
		};

		const config: ZMapConfig = {
			resolution: 2,
			gridWidth: 11,
			gridHeight: 11,
			physicalWidth: 20,
			physicalHeight: 20
		};

		const heightMap = computeHeightMap([triangle], config, vbitTool);
		const inverted = invertHeightMap(heightMap);

		// Check that there are negative Z values where the model was
		let hasNegative = false;
		for (let i = 0; i < inverted.data.length; i++) {
			if (inverted.data[i] < -0.1) {
				hasNegative = true;
				break;
			}
		}
		expect(hasNegative).toBe(true);

		// No positive Z values (inverted can only be 0 or negative)
		for (let i = 0; i < inverted.data.length; i++) {
			expect(inverted.data[i]).toBeLessThanOrEqual(0);
		}
	});
});

// ─── Raster path Z consistency tests ─────────────────────────

describe('Raster path Z consistency', () => {
	it('G-code Z values in normal mode never go below 0', () => {
		const heightMap = computeHeightMap([testTriangle], zmapConfig, flatTool);
		const paths = generateRasterPaths(heightMap, 2, 5);

		for (const path of paths) {
			for (const pt of path.points) {
				if (!path.isRapid) {
					expect(pt.z).toBeGreaterThanOrEqual(0);
				}
			}
		}
	});

	it('safe Z is used for rapid moves', () => {
		const safeZ = 5;
		const heightMap = computeHeightMap([testTriangle], zmapConfig, flatTool);
		const paths = generateRasterPaths(heightMap, 2, safeZ);

		for (const path of paths) {
			if (path.isRapid) {
				for (const pt of path.points) {
					expect(pt.z).toBe(safeZ);
				}
			}
		}
	});
});
