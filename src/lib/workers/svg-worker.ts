import type { SvgWorkerInput, SvgWorkerOutput } from '$lib/types/worker-messages.js';
import { processPolylines } from '$lib/engine/svg/discretizer.js';
import { offsetForTool } from '$lib/engine/svg/offset.js';
import { optimizePathOrder } from '$lib/engine/path/optimizer.js';
import { polylinesToToolPath, toolPathToFloat32Array } from '$lib/engine/path/toolpath.js';
import { generateGCode } from '$lib/engine/gcode/generator.js';

function postProgress(stage: string, percent: number) {
	const msg: SvgWorkerOutput = { type: 'progress', stage, percent };
	self.postMessage(msg);
}

self.onmessage = (event: MessageEvent<SvgWorkerInput>) => {
	try {
		const { polylines, toolConfig, machineConfig, cutDepth } = event.data;

		// Step 1: Process polylines (subdivide, simplify, deduplicate)
		postProgress('Processing polylines', 10);
		const processed = processPolylines(polylines);

		// Step 2: Tool offset compensation
		postProgress('Applying tool offset', 30);
		const toolRadius = toolConfig.diameter / 2;
		const offset = offsetForTool(processed, toolRadius);

		// Step 3: Optimize path order
		postProgress('Optimizing paths', 50);
		const optimized = optimizePathOrder(offset);

		// Step 4: Generate toolpath
		postProgress('Generating toolpath', 70);
		const toolPath = polylinesToToolPath(
			optimized,
			cutDepth,
			machineConfig.safeZ,
			toolConfig.feedRate,
			toolConfig.plungeRate
		);

		// Step 5: Prepare toolpath data and send preview
		const toolpathData = toolPathToFloat32Array(toolPath);
		self.postMessage({ type: 'toolpath-preview', toolpathData: new Float32Array(toolpathData) });

		// Step 6: Generate G-code
		postProgress('Generating G-code', 90);
		const gcode = generateGCode(toolPath, toolConfig, machineConfig);

		const result: SvgWorkerOutput = {
			type: 'result',
			gcode,
			toolpathData,
			stats: toolPath.stats
		};

		self.postMessage(result, [toolpathData.buffer] as unknown as Transferable[]);
	} catch (error) {
		const errorMsg: SvgWorkerOutput = {
			type: 'error',
			message: error instanceof Error ? error.message : 'Unknown error in SVG worker'
		};
		self.postMessage(errorMsg);
	}
};
