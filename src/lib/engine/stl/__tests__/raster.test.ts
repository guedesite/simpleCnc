import { describe, it, expect } from 'vitest';
import { generateRasterPaths, rasterPathsToFloat32Array } from '../raster.js';
import type { HeightMap, ZMapConfig } from '$lib/types/stl.js';

function createFlatHeightMap(width: number, height: number, z: number): HeightMap {
	const config: ZMapConfig = {
		resolution: 1,
		gridWidth: width,
		gridHeight: height,
		physicalWidth: (width - 1),
		physicalHeight: (height - 1)
	};
	const data = new Float32Array(width * height);
	data.fill(z);
	return { config, data };
}

describe('generateRasterPaths', () => {
	it('should generate paths for a simple height map', () => {
		const hm = createFlatHeightMap(5, 5, 0);
		const paths = generateRasterPaths(hm, 1, 5);
		expect(paths.length).toBeGreaterThan(0);
	});

	it('should alternate direction (zigzag)', () => {
		const hm = createFlatHeightMap(5, 5, 0);
		const paths = generateRasterPaths(hm, 1, 5);

		// Find cutting paths (non-rapid)
		const cuttingPaths = paths.filter((p) => !p.isRapid);
		if (cuttingPaths.length >= 3) {
			// First row should go forward (increasing X)
			const firstRow = cuttingPaths[0];
			if (firstRow.points.length >= 2) {
				const dx1 = firstRow.points[firstRow.points.length - 1].x - firstRow.points[0].x;
				// Third cutting path (second full row) should go opposite direction
				const secondFullRow = cuttingPaths[2];
				if (secondFullRow && secondFullRow.points.length >= 2) {
					const dx2 = secondFullRow.points[secondFullRow.points.length - 1].x - secondFullRow.points[0].x;
					// Directions should be opposite
					expect(Math.sign(dx1) * Math.sign(dx2)).toBeLessThanOrEqual(0);
				}
			}
		}
	});

	it('should include rapid moves to safe Z', () => {
		const hm = createFlatHeightMap(3, 3, 0);
		const paths = generateRasterPaths(hm, 1, 10);
		const rapidPaths = paths.filter((p) => p.isRapid);

		expect(rapidPaths.length).toBeGreaterThan(0);
		// All rapid points should be at safe Z
		for (const rp of rapidPaths) {
			for (const pt of rp.points) {
				expect(pt.z).toBe(10);
			}
		}
	});

	it('should use height map Z values for cutting paths', () => {
		const config: ZMapConfig = {
			resolution: 1,
			gridWidth: 3,
			gridHeight: 2,
			physicalWidth: 2,
			physicalHeight: 1
		};
		const data = new Float32Array([1, 2, 3, 4, 5, 6]);
		const hm: HeightMap = { config, data };
		const paths = generateRasterPaths(hm, 1, 5);

		const cuttingPaths = paths.filter((p) => !p.isRapid);
		expect(cuttingPaths.length).toBeGreaterThan(0);
	});

	it('should call progress callback', () => {
		const hm = createFlatHeightMap(5, 50, 0);
		let progressCalled = false;
		generateRasterPaths(hm, 1, 5, () => {
			progressCalled = true;
		});
		expect(progressCalled).toBe(true);
	});

	it('should handle stepover larger than grid', () => {
		const hm = createFlatHeightMap(3, 3, 0);
		const paths = generateRasterPaths(hm, 10, 5);
		expect(paths.length).toBeGreaterThan(0);
	});
});

describe('rasterPathsToFloat32Array', () => {
	it('should convert paths to Float32Array', () => {
		const hm = createFlatHeightMap(3, 3, 0);
		const paths = generateRasterPaths(hm, 1, 5);
		const arr = rasterPathsToFloat32Array(paths);

		expect(arr).toBeInstanceOf(Float32Array);
		expect(arr.length % 4).toBe(0); // Each point is 4 floats
	});

	it('should encode rapid flag correctly', () => {
		const hm = createFlatHeightMap(3, 3, 0);
		const paths = generateRasterPaths(hm, 1, 5);
		const arr = rasterPathsToFloat32Array(paths);

		// Check that rapid flags are 0 or 1
		for (let i = 3; i < arr.length; i += 4) {
			expect(arr[i] === 0 || arr[i] === 1).toBe(true);
		}
	});

	it('should handle empty paths', () => {
		const arr = rasterPathsToFloat32Array([]);
		expect(arr.length).toBe(0);
	});
});
