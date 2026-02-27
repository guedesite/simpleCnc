import type { StlWorkerInput, StlWorkerOutput } from '$lib/types/worker-messages.js';
import { verticesToTriangles } from '$lib/engine/stl/loader.js';
import { computeHeightMap } from '$lib/engine/stl/drop-cutter.js';
import { generateRasterPaths, rasterPathsToFloat32Array } from '$lib/engine/stl/raster.js';
import { generateGCodeFromPoints } from '$lib/engine/gcode/generator.js';
import type { ZMapConfig } from '$lib/types/stl.js';

function postProgress(stage: string, percent: number) {
	const msg: StlWorkerOutput = { type: 'progress', stage, percent };
	self.postMessage(msg);
}

self.onmessage = (event: MessageEvent<StlWorkerInput>) => {
	try {
		const { vertices, toolConfig, machineConfig, stockConfig, resolution, stepover } = event.data;

		// Step 1: Convert vertices to triangles
		postProgress('Parsing mesh', 5);
		const triangles = verticesToTriangles(vertices);

		// Step 2: Compute height map
		const gridWidth = Math.max(2, Math.ceil(stockConfig.width / resolution));
		const gridHeight = Math.max(2, Math.ceil(stockConfig.height / resolution));

		const zmapConfig: ZMapConfig = {
			resolution,
			gridWidth,
			gridHeight,
			physicalWidth: stockConfig.width,
			physicalHeight: stockConfig.height
		};

		postProgress('Computing height map', 10);
		const heightMap = computeHeightMap(
			triangles,
			zmapConfig,
			toolConfig,
			(pct) => postProgress('Computing height map', 10 + pct * 0.6)
		);

		// Step 3: Generate raster paths
		postProgress('Generating raster paths', 75);
		const rasterPaths = generateRasterPaths(
			heightMap,
			stepover,
			machineConfig.safeZ,
			(pct) => postProgress('Generating raster paths', 75 + pct * 0.1)
		);

		// Step 4: Generate G-code
		postProgress('Generating G-code', 90);
		const gcode = generateGCodeFromPoints(rasterPaths, toolConfig, machineConfig);

		// Step 5: Prepare transfer data
		const toolpathData = rasterPathsToFloat32Array(rasterPaths);

		// Calculate stats
		let totalDistance = 0;
		let cuttingDistance = 0;
		let rapidDistance = 0;
		for (const path of rasterPaths) {
			for (let i = 1; i < path.points.length; i++) {
				const a = path.points[i - 1];
				const b = path.points[i];
				const d = Math.sqrt(
					(b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2
				);
				totalDistance += d;
				if (path.isRapid) rapidDistance += d;
				else cuttingDistance += d;
			}
		}

		const estimatedTime = cuttingDistance / toolConfig.feedRate + rapidDistance / 5000;

		const result: StlWorkerOutput = {
			type: 'result',
			gcode,
			toolpathData,
			stats: {
				totalDistance,
				cuttingDistance,
				rapidDistance,
				estimatedTime,
				gridSize: { width: gridWidth, height: gridHeight }
			}
		};

		self.postMessage(result, [toolpathData.buffer] as unknown as Transferable[]);
	} catch (error) {
		const errorMsg: StlWorkerOutput = {
			type: 'error',
			message: error instanceof Error ? error.message : 'Unknown error in STL worker'
		};
		self.postMessage(errorMsg);
	}
};
