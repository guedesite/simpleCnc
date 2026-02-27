import type { ToolConfig } from '$lib/types/tool.js';
import type { MachineConfig } from '$lib/types/machine.js';
import type { ToolPath } from '$lib/engine/path/toolpath.js';
import { MoveType } from '$lib/engine/path/toolpath.js';
import { generateHeader, generateFooter, formatNum } from './header.js';
import { detectArcs, simplifyCollinear, type OptimizedSegment } from './arc-fitting.js';
import type { Point3D } from '$lib/types/geometry.js';

const COORD_TOLERANCE = 0.0005;

/**
 * Generate complete G-code string from a ToolPath (SVG pipeline).
 * Applies arc fitting on cut segments to replace G1 sequences with G2/G3.
 * Uses modal feed rate (only emits F when it changes).
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
	let lastF: number | null = null;

	for (const segment of toolPath.segments) {
		if (segment.moveType === MoveType.Cut && segment.points.length >= 4) {
			// Try arc fitting on cutting segments
			const arcs = detectArcs(segment.points);
			for (const arc of arcs) {
				if (arc.type === 'arc') {
					const x = arc.endX + machineConfig.originX;
					const y = arc.endY + machineConfig.originY;
					const z = arc.z;
					const cmd = arc.clockwise ? 'G2' : 'G3';
					const parts = [cmd];

					if (lastX === null || Math.abs(x - lastX) > COORD_TOLERANCE) parts.push(`X${formatNum(x)}`);
					if (lastY === null || Math.abs(y - lastY) > COORD_TOLERANCE) parts.push(`Y${formatNum(y)}`);
					if (lastZ === null || Math.abs(z - lastZ) > COORD_TOLERANCE) parts.push(`Z${formatNum(z)}`);
					parts.push(`I${formatNum(arc.centerI)}`);
					parts.push(`J${formatNum(arc.centerJ)}`);

					if (lastF !== toolConfig.feedRate) {
						parts.push(`F${formatNum(toolConfig.feedRate, 0)}`);
						lastF = toolConfig.feedRate;
					}

					lines.push(parts.join(' '));
					lastX = x;
					lastY = y;
					lastZ = z;
				} else {
					// Linear segment within an arc-fitted sequence
					const x = arc.x + machineConfig.originX;
					const y = arc.y + machineConfig.originY;
					const z = arc.z;

					if (lastX !== null &&
						Math.abs(x - lastX) < COORD_TOLERANCE &&
						Math.abs(y - lastY!) < COORD_TOLERANCE &&
						Math.abs(z - lastZ!) < COORD_TOLERANCE) {
						continue;
					}

					const line = formatCutMove(x, y, z, toolConfig.feedRate, lastX, lastY, lastZ, lastF);
					if (line.text) {
						lines.push(line.text);
						lastF = line.newF;
					}
					lastX = x;
					lastY = y;
					lastZ = z;
				}
			}
		} else {
			// Standard processing for non-cut or short cut segments
			for (let i = 0; i < segment.points.length; i++) {
				const pt = segment.points[i];
				const x = pt.x + machineConfig.originX;
				const y = pt.y + machineConfig.originY;
				const z = pt.z;

				if (lastX !== null &&
					Math.abs(x - lastX) < COORD_TOLERANCE &&
					Math.abs(y - lastY!) < COORD_TOLERANCE &&
					Math.abs(z - lastZ!) < COORD_TOLERANCE) {
					continue;
				}

				const line = formatMove(segment.moveType, x, y, z, toolConfig, lastX, lastY, lastZ, lastF);
				if (line.text) {
					lines.push(line.text);
					lastF = line.newF;
				}

				lastX = x;
				lastY = y;
				lastZ = z;
			}
		}
	}

	lines.push(generateFooter(machineConfig));

	return lines.join('\n');
}

interface FormattedLine {
	text: string;
	newF: number | null;
}

function formatCutMove(
	x: number, y: number, z: number,
	feedRate: number,
	lastX: number | null, lastY: number | null, lastZ: number | null,
	lastF: number | null
): FormattedLine {
	const parts = ['G1'];
	if (lastX === null || Math.abs(x - lastX) > COORD_TOLERANCE) parts.push(`X${formatNum(x)}`);
	if (lastY === null || Math.abs(y - lastY) > COORD_TOLERANCE) parts.push(`Y${formatNum(y)}`);
	if (lastZ === null || Math.abs(z - lastZ) > COORD_TOLERANCE) parts.push(`Z${formatNum(z)}`);

	let newF = lastF;
	if (lastF !== feedRate) {
		parts.push(`F${formatNum(feedRate, 0)}`);
		newF = feedRate;
	}

	return { text: parts.length > 1 ? parts.join(' ') : '', newF };
}

function formatMove(
	moveType: MoveType,
	x: number, y: number, z: number,
	toolConfig: ToolConfig,
	lastX: number | null, lastY: number | null, lastZ: number | null,
	lastF: number | null
): FormattedLine {
	switch (moveType) {
		case MoveType.Rapid: {
			const parts = ['G0'];
			if (lastX === null || Math.abs(x - lastX) > COORD_TOLERANCE) parts.push(`X${formatNum(x)}`);
			if (lastY === null || Math.abs(y - lastY) > COORD_TOLERANCE) parts.push(`Y${formatNum(y)}`);
			if (lastZ === null || Math.abs(z - lastZ) > COORD_TOLERANCE) parts.push(`Z${formatNum(z)}`);
			return { text: parts.length > 1 ? parts.join(' ') : '', newF: lastF };
		}
		case MoveType.Plunge: {
			const parts = ['G1', `Z${formatNum(z)}`];
			// Plunge may also have XY movement (ramp entry)
			if (lastX !== null && Math.abs(x - lastX) > COORD_TOLERANCE) parts.splice(1, 0, `X${formatNum(x)}`);
			if (lastY !== null && Math.abs(y - lastY) > COORD_TOLERANCE) parts.splice(parts.length - 1, 0, `Y${formatNum(y)}`);

			let newF = lastF;
			if (lastF !== toolConfig.plungeRate) {
				parts.push(`F${formatNum(toolConfig.plungeRate, 0)}`);
				newF = toolConfig.plungeRate;
			}
			return { text: parts.join(' '), newF };
		}
		case MoveType.Cut: {
			return formatCutMove(x, y, z, toolConfig.feedRate, lastX, lastY, lastZ, lastF);
		}
		case MoveType.Retract: {
			return { text: `G0 Z${formatNum(z)}`, newF: lastF };
		}
		default:
			return { text: '', newF: lastF };
	}
}

/**
 * Generate G-code from simple 3D point arrays (STL pipeline).
 * Now with coordinate deduplication, collinear point simplification,
 * modal feed rate tracking, and changed-axis-only output.
 */
export function generateGCodeFromPoints(
	segments: { points: { x: number; y: number; z: number }[]; isRapid: boolean }[],
	toolConfig: ToolConfig,
	machineConfig: MachineConfig
): string {
	const lines: string[] = [];

	lines.push(generateHeader(toolConfig, machineConfig));

	let lastX: number | null = null;
	let lastY: number | null = null;
	let lastZ: number | null = null;
	let lastF: number | null = null;

	for (const seg of segments) {
		// Simplify collinear points in cutting segments
		const points = !seg.isRapid && seg.points.length > 2
			? simplifyCollinear(seg.points as Point3D[], 0.005)
			: seg.points;

		for (const pt of points) {
			const x = pt.x + machineConfig.originX;
			const y = pt.y + machineConfig.originY;
			const z = pt.z;

			// Skip duplicate positions
			if (lastX !== null &&
				Math.abs(x - lastX) < COORD_TOLERANCE &&
				Math.abs(y - lastY!) < COORD_TOLERANCE &&
				Math.abs(z - lastZ!) < COORD_TOLERANCE) {
				continue;
			}

			if (seg.isRapid) {
				const parts = ['G0'];
				if (lastX === null || Math.abs(x - lastX) > COORD_TOLERANCE) parts.push(`X${formatNum(x)}`);
				if (lastY === null || Math.abs(y - lastY) > COORD_TOLERANCE) parts.push(`Y${formatNum(y)}`);
				if (lastZ === null || Math.abs(z - lastZ) > COORD_TOLERANCE) parts.push(`Z${formatNum(z)}`);
				if (parts.length > 1) lines.push(parts.join(' '));
			} else {
				const parts = ['G1'];
				if (lastX === null || Math.abs(x - lastX) > COORD_TOLERANCE) parts.push(`X${formatNum(x)}`);
				if (lastY === null || Math.abs(y - lastY) > COORD_TOLERANCE) parts.push(`Y${formatNum(y)}`);
				if (lastZ === null || Math.abs(z - lastZ) > COORD_TOLERANCE) parts.push(`Z${formatNum(z)}`);

				if (lastF !== toolConfig.feedRate) {
					parts.push(`F${formatNum(toolConfig.feedRate, 0)}`);
					lastF = toolConfig.feedRate;
				}

				if (parts.length > 1) lines.push(parts.join(' '));
			}

			lastX = x;
			lastY = y;
			lastZ = z;
		}
	}

	lines.push(generateFooter(machineConfig));

	return lines.join('\n');
}
