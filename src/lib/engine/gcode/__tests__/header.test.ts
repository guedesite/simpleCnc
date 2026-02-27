import { describe, it, expect } from 'vitest';
import { generateHeader, generateFooter, formatNum } from '../header.js';
import { ToolType } from '$lib/types/tool.js';

const toolConfig = {
	type: ToolType.FlatEnd,
	diameter: 3.175,
	angle: 60,
	spindleSpeed: 12000,
	feedRate: 800,
	plungeRate: 300
};

const machineConfig = {
	safeZ: 5,
	originX: 0,
	originY: 0
};

describe('generateHeader', () => {
	it('should include G90 absolute positioning', () => {
		const header = generateHeader(toolConfig, machineConfig);
		expect(header).toContain('G90');
	});

	it('should include G21 metric units', () => {
		const header = generateHeader(toolConfig, machineConfig);
		expect(header).toContain('G21');
	});

	it('should include spindle speed and M3', () => {
		const header = generateHeader(toolConfig, machineConfig);
		expect(header).toContain('S12000 M3');
	});

	it('should include safe Z', () => {
		const header = generateHeader(toolConfig, machineConfig);
		expect(header).toContain('Z5.000');
	});

	it('should include tool info in comments', () => {
		const header = generateHeader(toolConfig, machineConfig);
		expect(header).toContain('flat_end');
		expect(header).toContain('D3.175');
	});

	it('should use custom spindle speed', () => {
		const header = generateHeader({ ...toolConfig, spindleSpeed: 24000 }, machineConfig);
		expect(header).toContain('S24000');
	});
});

describe('generateFooter', () => {
	it('should include M5 spindle off', () => {
		const footer = generateFooter(machineConfig);
		expect(footer).toContain('M5');
	});

	it('should include M2 program end', () => {
		const footer = generateFooter(machineConfig);
		expect(footer).toContain('M2');
	});

	it('should include return to origin', () => {
		const footer = generateFooter(machineConfig);
		expect(footer).toContain('G0 X0 Y0');
	});

	it('should retract to safe Z', () => {
		const footer = generateFooter(machineConfig);
		expect(footer).toContain('Z5.000');
	});
});

describe('formatNum', () => {
	it('should format with 3 decimal places by default', () => {
		expect(formatNum(1.23456)).toBe('1.235');
	});

	it('should format with custom decimal places', () => {
		expect(formatNum(1.5, 0)).toBe('2');
		expect(formatNum(1.5, 1)).toBe('1.5');
	});

	it('should handle integers', () => {
		expect(formatNum(5)).toBe('5.000');
	});

	it('should handle negative numbers', () => {
		expect(formatNum(-2.5)).toBe('-2.500');
	});

	it('should handle zero', () => {
		expect(formatNum(0)).toBe('0.000');
	});
});
