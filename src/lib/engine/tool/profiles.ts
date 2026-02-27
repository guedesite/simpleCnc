import type { ToolConfig } from '$lib/types/tool.js';
import { ToolType } from '$lib/types/tool.js';
import { degToRad } from '$lib/utils/math.js';

/** Get the effective radius of the tool at the cutting tip */
export function getToolRadius(config: ToolConfig): number {
	return config.diameter / 2;
}

/**
 * For a V-bit, compute the cutting depth to achieve a given effective width.
 * width = 2 * depth * tan(angle/2)
 * depth = width / (2 * tan(angle/2))
 */
export function vBitDepthForWidth(width: number, angleDeg: number): number {
	if (angleDeg <= 0 || angleDeg >= 180) return 0;
	const halfAngle = degToRad(angleDeg / 2);
	return width / (2 * Math.tan(halfAngle));
}

/**
 * For a V-bit, compute the effective cutting width at a given depth.
 * width = 2 * depth * tan(angle/2)
 */
export function vBitWidthAtDepth(depth: number, angleDeg: number): number {
	if (angleDeg <= 0 || angleDeg >= 180) return 0;
	const halfAngle = degToRad(angleDeg / 2);
	return 2 * Math.abs(depth) * Math.tan(halfAngle);
}

/**
 * Get the Z contact point for a given tool type relative to tool center.
 * For flat end: z = 0 (tip is at center level)
 * For ball nose: z = -r + sqrt(r² - offset²)
 * For V-bit: z = -offset / tan(angle/2)
 */
export function getContactZ(config: ToolConfig, offsetFromCenter: number): number {
	const r = config.diameter / 2;
	const offset = Math.abs(offsetFromCenter);

	switch (config.type) {
		case ToolType.FlatEnd:
			return 0;

		case ToolType.BallNose: {
			if (offset >= r) return 0;
			return -r + Math.sqrt(r * r - offset * offset);
		}

		case ToolType.VBit: {
			if (config.angle <= 0 || config.angle >= 180) return 0;
			const halfAngle = degToRad(config.angle / 2);
			const maxOffset = r;
			if (offset >= maxOffset) return 0;
			return -offset / Math.tan(halfAngle);
		}

		default:
			return 0;
	}
}

/**
 * Get the stepover distance for a given tool (typically 40-60% of diameter for roughing).
 */
export function getDefaultStepover(config: ToolConfig, steoverPercent: number = 0.4): number {
	return config.diameter * steoverPercent;
}

/**
 * Compute the drop-cutter Z height for a given tool profile at an XY offset from the tool center.
 * This returns how much the tool tip should be raised based on its geometry.
 */
export function toolProfileZ(config: ToolConfig, distFromCenter: number): number {
	const r = config.diameter / 2;
	const d = Math.abs(distFromCenter);

	switch (config.type) {
		case ToolType.FlatEnd:
			return d <= r ? 0 : -Infinity;

		case ToolType.BallNose: {
			if (d >= r) return -Infinity;
			return r - Math.sqrt(r * r - d * d);
		}

		case ToolType.VBit: {
			if (config.angle <= 0 || config.angle >= 180) return -Infinity;
			const halfAngle = degToRad(config.angle / 2);
			const maxR = r;
			if (d >= maxR) return -Infinity;
			return d / Math.tan(halfAngle);
		}

		default:
			return -Infinity;
	}
}
