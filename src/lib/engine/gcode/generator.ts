import type { ToolConfig } from '$lib/types/tool.js';
import type { MachineConfig } from '$lib/types/machine.js';
import type { ToolPath } from '$lib/engine/path/toolpath.js';
import { MoveType } from '$lib/engine/path/toolpath.js';
import { generateHeader, generateFooter, formatNum } from './header.js';

/**
 * Generate complete G-code string from a ToolPath.
 */
export function generateGCode(
	toolPath: ToolPath,
	toolConfig: ToolConfig,
	machineConfig: MachineConfig
): string {
	const lines: string[] = [];

	lines.push(generateHeader(toolConfig, machineConfig));

	let lastX: number | null = null;
	let lastY: number | null = null;
	let lastZ: number | null = null;

	for (const segment of toolPath.segments) {
		for (let i = 0; i < segment.points.length; i++) {
			const pt = segment.points[i];
			const x = pt.x + machineConfig.originX;
			const y = pt.y + machineConfig.originY;
			const z = pt.z;

			// Skip if identical to last position
			if (lastX !== null && Math.abs(x - lastX) < 0.0005 &&
				Math.abs(y - lastY!) < 0.0005 &&
				Math.abs(z - lastZ!) < 0.0005) {
				continue;
			}

			const line = formatMove(segment.moveType, x, y, z, toolConfig, lastX, lastY, lastZ);
			if (line) lines.push(line);

			lastX = x;
			lastY = y;
			lastZ = z;
		}
	}

	lines.push(generateFooter(machineConfig));

	return lines.join('\n');
}

function formatMove(
	moveType: MoveType,
	x: number,
	y: number,
	z: number,
	toolConfig: ToolConfig,
	lastX: number | null,
	lastY: number | null,
	lastZ: number | null
): string {
	switch (moveType) {
		case MoveType.Rapid: {
			const parts = ['G0'];
			if (lastX === null || Math.abs(x - lastX) > 0.0005) parts.push(`X${formatNum(x)}`);
			if (lastY === null || Math.abs(y - lastY) > 0.0005) parts.push(`Y${formatNum(y)}`);
			if (lastZ === null || Math.abs(z - lastZ) > 0.0005) parts.push(`Z${formatNum(z)}`);
			return parts.length > 1 ? parts.join(' ') : '';
		}
		case MoveType.Plunge: {
			return `G1 Z${formatNum(z)} F${formatNum(toolConfig.plungeRate, 0)}`;
		}
		case MoveType.Cut: {
			const parts = ['G1'];
			if (lastX === null || Math.abs(x - lastX) > 0.0005) parts.push(`X${formatNum(x)}`);
			if (lastY === null || Math.abs(y - lastY) > 0.0005) parts.push(`Y${formatNum(y)}`);
			if (lastZ === null || Math.abs(z - lastZ) > 0.0005) parts.push(`Z${formatNum(z)}`);
			parts.push(`F${formatNum(toolConfig.feedRate, 0)}`);
			return parts.length > 2 ? parts.join(' ') : '';
		}
		case MoveType.Retract: {
			return `G0 Z${formatNum(z)}`;
		}
		default:
			return '';
	}
}

/**
 * Generate G-code from simple 3D point arrays (for STL pipeline).
 */
export function generateGCodeFromPoints(
	segments: { points: { x: number; y: number; z: number }[]; isRapid: boolean }[],
	toolConfig: ToolConfig,
	machineConfig: MachineConfig
): string {
	const lines: string[] = [];

	lines.push(generateHeader(toolConfig, machineConfig));

	for (const seg of segments) {
		for (const pt of seg.points) {
			const x = pt.x + machineConfig.originX;
			const y = pt.y + machineConfig.originY;
			const z = pt.z;

			if (seg.isRapid) {
				lines.push(`G0 X${formatNum(x)} Y${formatNum(y)} Z${formatNum(z)}`);
			} else {
				lines.push(`G1 X${formatNum(x)} Y${formatNum(y)} Z${formatNum(z)} F${formatNum(toolConfig.feedRate, 0)}`);
			}
		}
	}

	lines.push(generateFooter(machineConfig));

	return lines.join('\n');
}
