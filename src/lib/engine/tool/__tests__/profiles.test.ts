import { describe, it, expect } from 'vitest';
import {
	getToolRadius,
	vBitDepthForWidth,
	vBitWidthAtDepth,
	getContactZ,
	getDefaultStepover,
	toolProfileZ
} from '../profiles.js';
import { ToolType, type ToolConfig } from '$lib/types/tool.js';

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

describe('getToolRadius', () => {
	it('should return half the diameter', () => {
		expect(getToolRadius(flatTool)).toBe(3);
	});

	it('should work with small diameters', () => {
		expect(getToolRadius({ ...flatTool, diameter: 0.5 })).toBe(0.25);
	});
});

describe('vBitDepthForWidth', () => {
	it('should compute depth for 60-degree V-bit', () => {
		const depth = vBitDepthForWidth(2, 60);
		// width = 2 * depth * tan(30°) → depth = 1 / tan(30°) ≈ 1.732
		expect(depth).toBeCloseTo(1.732, 2);
	});

	it('should return 0 for invalid angle', () => {
		expect(vBitDepthForWidth(2, 0)).toBe(0);
		expect(vBitDepthForWidth(2, 180)).toBe(0);
	});

	it('should compute depth for 90-degree V-bit', () => {
		const depth = vBitDepthForWidth(2, 90);
		// width = 2 * depth * tan(45°) → depth = 1 / 1 = 1
		expect(depth).toBeCloseTo(1);
	});
});

describe('vBitWidthAtDepth', () => {
	it('should compute width for 60-degree V-bit', () => {
		const width = vBitWidthAtDepth(1.732, 60);
		expect(width).toBeCloseTo(2, 1);
	});

	it('should be inverse of vBitDepthForWidth', () => {
		const depth = vBitDepthForWidth(5, 90);
		const width = vBitWidthAtDepth(depth, 90);
		expect(width).toBeCloseTo(5);
	});

	it('should return 0 for invalid angle', () => {
		expect(vBitWidthAtDepth(1, 0)).toBe(0);
	});
});

describe('getContactZ', () => {
	it('should return 0 for flat end at any offset', () => {
		expect(getContactZ(flatTool, 0)).toBe(0);
		expect(getContactZ(flatTool, 2)).toBe(0);
	});

	it('should return 0 for ball nose at center', () => {
		const z = getContactZ(ballTool, 0);
		// At center, offset=0: z = -r + sqrt(r²-0) = -r + r = 0
		expect(z).toBeCloseTo(0);
	});

	it('should compute ball nose contact Z at offset', () => {
		const z = getContactZ(ballTool, 2);
		// z = -r + sqrt(r² - offset²) = -3 + sqrt(9-4) = -3 + 2.236
		expect(z).toBeCloseTo(-0.764, 2);
	});

	it('should return 0 for ball nose beyond radius', () => {
		expect(getContactZ(ballTool, 5)).toBe(0);
	});

	it('should compute V-bit contact Z', () => {
		const z = getContactZ(vbitTool, 1);
		// z = -offset / tan(30°) = -1 / 0.577 ≈ -1.732
		expect(z).toBeCloseTo(-1.732, 2);
	});
});

describe('getDefaultStepover', () => {
	it('should compute 40% stepover by default', () => {
		expect(getDefaultStepover(flatTool)).toBeCloseTo(2.4);
	});

	it('should compute custom percentage', () => {
		expect(getDefaultStepover(flatTool, 0.5)).toBeCloseTo(3);
	});
});

describe('toolProfileZ', () => {
	it('should return 0 for flat end at center', () => {
		expect(toolProfileZ(flatTool, 0)).toBe(0);
	});

	it('should return 0 for flat end within radius', () => {
		expect(toolProfileZ(flatTool, 2)).toBe(0);
	});

	it('should return -Infinity for flat end beyond radius', () => {
		expect(toolProfileZ(flatTool, 5)).toBe(-Infinity);
	});

	it('should return correct Z for ball nose', () => {
		const z = toolProfileZ(ballTool, 0);
		expect(z).toBe(0);
	});

	it('should return curved Z for ball nose at offset', () => {
		const z = toolProfileZ(ballTool, 2);
		// r - sqrt(r²-d²) = 3 - sqrt(9-4) = 3 - 2.236 ≈ 0.764
		expect(z).toBeCloseTo(0.764, 2);
	});

	it('should return V-bit Z at offset', () => {
		const z = toolProfileZ(vbitTool, 1);
		// d / tan(halfAngle) = 1 / tan(30°) ≈ 1.732
		expect(z).toBeCloseTo(1.732, 2);
	});
});
