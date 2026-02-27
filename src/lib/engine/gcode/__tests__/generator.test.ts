import { describe, it, expect } from 'vitest';
import { generateGCode, generateGCodeFromPoints } from '../generator.js';
import { polylinesToToolPath, MoveType } from '$lib/engine/path/toolpath.js';
import { ToolType, type ToolConfig } from '$lib/types/tool.js';
import type { MachineConfig } from '$lib/types/machine.js';

const toolConfig: ToolConfig = {
	type: ToolType.FlatEnd,
	diameter: 3.175,
	angle: 60,
	spindleSpeed: 12000,
	feedRate: 800,
	plungeRate: 300
};

const machineConfig: MachineConfig = {
	safeZ: 5,
	originX: 0,
	originY: 0,
	originPosition: 'front-left'
};

describe('generateGCode', () => {
	it('should generate valid G-code from a simple toolpath', () => {
		const polylines = [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }];
		const toolPath = polylinesToToolPath(polylines, 1, 5, 800, 300);
		const gcode = generateGCode(toolPath, toolConfig, machineConfig);

		expect(gcode).toContain('G90');
		expect(gcode).toContain('G21');
		expect(gcode).toContain('M3');
		expect(gcode).toContain('G0');
		expect(gcode).toContain('G1');
		expect(gcode).toContain('M5');
		expect(gcode).toContain('M2');
	});

	it('should include plunge move with plunge rate', () => {
		const polylines = [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }];
		const toolPath = polylinesToToolPath(polylines, 1, 5, 800, 300);
		const gcode = generateGCode(toolPath, toolConfig, machineConfig);

		expect(gcode).toContain('F300');
	});

	it('should include feed rate for cutting moves', () => {
		const polylines = [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }];
		const toolPath = polylinesToToolPath(polylines, 1, 5, 800, 300);
		const gcode = generateGCode(toolPath, toolConfig, machineConfig);

		expect(gcode).toContain('F800');
	});

	it('should apply origin offset', () => {
		const polylines = [{ points: [{ x: 10, y: 20 }, { x: 20, y: 30 }] }];
		const toolPath = polylinesToToolPath(polylines, 1, 5, 800, 300);
		const gcode = generateGCode(toolPath, toolConfig, { ...machineConfig, originX: 5, originY: 10 });

		expect(gcode).toContain('X15.000');
		expect(gcode).toContain('Y30.000');
	});

	it('should include negative Z for cutting depth', () => {
		const polylines = [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }];
		const toolPath = polylinesToToolPath(polylines, 2, 5, 800, 300);
		const gcode = generateGCode(toolPath, toolConfig, machineConfig);

		expect(gcode).toContain('Z-2.000');
	});

	it('should handle multiple polylines', () => {
		const polylines = [
			{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
			{ points: [{ x: 20, y: 0 }, { x: 30, y: 0 }] }
		];
		const toolPath = polylinesToToolPath(polylines, 1, 5, 800, 300);
		const gcode = generateGCode(toolPath, toolConfig, machineConfig);

		// Should have multiple retract/rapid/plunge sequences
		const g0Count = (gcode.match(/^G0 /gm) || []).length;
		expect(g0Count).toBeGreaterThanOrEqual(4);
	});

	it('should generate valid G-code for empty toolpath', () => {
		const toolPath = polylinesToToolPath([], 1, 5, 800, 300);
		const gcode = generateGCode(toolPath, toolConfig, machineConfig);

		expect(gcode).toContain('G90');
		expect(gcode).toContain('M2');
	});

	it('should produce non-empty output', () => {
		const polylines = [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }];
		const toolPath = polylinesToToolPath(polylines, 1, 5, 800, 300);
		const gcode = generateGCode(toolPath, toolConfig, machineConfig);

		expect(gcode.length).toBeGreaterThan(100);
	});

	it('should include safe Z in rapid moves', () => {
		const polylines = [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }];
		const toolPath = polylinesToToolPath(polylines, 1, 5, 800, 300);
		const gcode = generateGCode(toolPath, toolConfig, machineConfig);

		expect(gcode).toContain('Z5.000');
	});

	it('should not produce duplicate coordinates', () => {
		const polylines = [{ points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }] }];
		const toolPath = polylinesToToolPath(polylines, 1, 5, 800, 300);
		const gcode = generateGCode(toolPath, toolConfig, machineConfig);
		const lines = gcode.split('\n').filter((l) => l.startsWith('G1') && l.includes('X'));
		expect(lines.length).toBeGreaterThanOrEqual(1);
	});
});

describe('generateGCodeFromPoints', () => {
	it('should generate G-code from point segments', () => {
		const segments = [
			{
				points: [{ x: 0, y: 0, z: 5 }],
				isRapid: true
			},
			{
				points: [
					{ x: 0, y: 0, z: 0 },
					{ x: 10, y: 0, z: 0 },
					{ x: 10, y: 10, z: -0.5 }
				],
				isRapid: false
			}
		];
		const gcode = generateGCodeFromPoints(segments, toolConfig, machineConfig);

		expect(gcode).toContain('G0');
		expect(gcode).toContain('G1');
		expect(gcode).toContain('F800');
	});

	it('should include header and footer', () => {
		const segments = [
			{ points: [{ x: 0, y: 0, z: 0 }], isRapid: true }
		];
		const gcode = generateGCodeFromPoints(segments, toolConfig, machineConfig);

		expect(gcode).toContain('G90');
		expect(gcode).toContain('M2');
	});

	it('should apply origin offset', () => {
		const segments = [
			{ points: [{ x: 10, y: 20, z: 0 }], isRapid: false }
		];
		const gcode = generateGCodeFromPoints(segments, toolConfig, { ...machineConfig, originX: 5, originY: 10 });

		expect(gcode).toContain('X15.000');
		expect(gcode).toContain('Y30.000');
	});
});
