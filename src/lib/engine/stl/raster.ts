import type { HeightMap } from '$lib/types/stl.js';
import type { Point3D } from '$lib/types/geometry.js';

export interface RasterPath {
	points: Point3D[];
	isRapid: boolean;
}

/**
 * Generate zigzag raster paths from a height map.
 * Traverses the height map in alternating X-direction rows (along Y axis).
 *
 * Optimizations:
 * - Connected rows: consecutive rows are linked directly without retract/rapid
 *   when the stepover distance is small. The tool moves at cutting feed rate
 *   along the stepover connecting segment.
 * - First row still uses rapid approach + plunge; last row still retracts.
 */
export function generateRasterPaths(
	heightMap: HeightMap,
	stepover: number,
	safeZ: number,
	onProgress?: (percent: number) => void
): RasterPath[] {
	const { config, data } = heightMap;
	const paths: RasterPath[] = [];

	// Calculate row spacing in grid units
	const rowSpacingGrid = Math.max(1, Math.round(stepover / (config.physicalWidth / (config.gridWidth - 1))));

	// Collect all row Y indices
	const rowIndices: number[] = [];
	for (let gy = 0; gy < config.gridHeight; gy += rowSpacingGrid) {
		rowIndices.push(gy);
	}

	const totalRows = rowIndices.length;
	let forward = true;

	for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
		const gy = rowIndices[rowIdx];
		const rowPoints: Point3D[] = [];

		if (forward) {
			for (let gx = 0; gx < config.gridWidth; gx++) {
				const px = (gx / (config.gridWidth - 1)) * config.physicalWidth;
				const py = (gy / (config.gridHeight - 1)) * config.physicalHeight;
				const z = data[gy * config.gridWidth + gx];
				rowPoints.push({ x: px, y: py, z });
			}
		} else {
			for (let gx = config.gridWidth - 1; gx >= 0; gx--) {
				const px = (gx / (config.gridWidth - 1)) * config.physicalWidth;
				const py = (gy / (config.gridHeight - 1)) * config.physicalHeight;
				const z = data[gy * config.gridWidth + gx];
				rowPoints.push({ x: px, y: py, z });
			}
		}

		if (rowPoints.length === 0) {
			forward = !forward;
			continue;
		}

		if (rowIdx === 0) {
			// First row: rapid approach + plunge
			const start = rowPoints[0];
			paths.push({
				points: [{ x: start.x, y: start.y, z: safeZ }],
				isRapid: true
			});

			// Plunge to first point
			paths.push({
				points: [start],
				isRapid: false
			});

			// Cut row
			if (rowPoints.length > 1) {
				paths.push({
					points: rowPoints.slice(1),
					isRapid: false
				});
			}
		} else {
			// Subsequent rows: connect directly from previous row end
			// The stepover connecting segment is a cutting move
			const start = rowPoints[0];
			paths.push({
				points: [start],
				isRapid: false
			});

			// Cut row
			if (rowPoints.length > 1) {
				paths.push({
					points: rowPoints.slice(1),
					isRapid: false
				});
			}
		}

		// Only retract after the last row
		if (rowIdx === totalRows - 1) {
			const end = rowPoints[rowPoints.length - 1];
			paths.push({
				points: [{ x: end.x, y: end.y, z: safeZ }],
				isRapid: true
			});
		}

		forward = !forward;

		if (onProgress && (rowIdx + 1) % 5 === 0) {
			onProgress(((rowIdx + 1) / totalRows) * 100);
		}
	}

	return paths;
}

/**
 * Convert raster paths to a flat Float32Array for transfer.
 * Format: [x, y, z, isRapid (0 or 1), ...]
 */
export function rasterPathsToFloat32Array(paths: RasterPath[]): Float32Array {
	let totalPoints = 0;
	for (const path of paths) {
		totalPoints += path.points.length;
	}

	const arr = new Float32Array(totalPoints * 4);
	let idx = 0;

	for (const path of paths) {
		const rapid = path.isRapid ? 1 : 0;
		for (const pt of path.points) {
			arr[idx++] = pt.x;
			arr[idx++] = pt.y;
			arr[idx++] = pt.z;
			arr[idx++] = rapid;
		}
	}

	return arr;
}
