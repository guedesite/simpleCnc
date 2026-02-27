import { describe, it, expect, vi } from 'vitest';
import { gcodeToBlob, parseGCodeStats } from '../exporter.js';

describe('gcodeToBlob', () => {
	it('should create a Blob from G-code string', () => {
		const gcode = 'G90\nG21\nG0 X0 Y0 Z5\n';
		const blob = gcodeToBlob(gcode);
		expect(blob).toBeInstanceOf(Blob);
		expect(blob.size).toBeGreaterThan(0);
	});

	it('should create blob with correct type', () => {
		const blob = gcodeToBlob('G90');
		expect(blob.type).toBe('text/plain;charset=utf-8');
	});
});

describe('parseGCodeStats', () => {
	it('should count lines excluding comments', () => {
		const gcode = '; comment\nG90\nG21\n; another comment\nG0 X0 Y0';
		const stats = parseGCodeStats(gcode);
		expect(stats.lineCount).toBe(3);
	});

	it('should count rapid moves', () => {
		const gcode = 'G0 X0 Y0\nG0 X10 Y10\nG1 X20 Y20 F800';
		const stats = parseGCodeStats(gcode);
		expect(stats.rapidMoves).toBe(2);
	});

	it('should count linear moves', () => {
		const gcode = 'G1 X0 Y0 F800\nG1 X10 Y10 F800\nG0 X20 Y20';
		const stats = parseGCodeStats(gcode);
		expect(stats.linearMoves).toBe(2);
	});

	it('should detect spindle on', () => {
		const gcode = 'S12000 M3\nG0 X0 Y0';
		const stats = parseGCodeStats(gcode);
		expect(stats.hasSpindleOn).toBe(true);
	});

	it('should detect spindle off', () => {
		const gcode = 'M5\nM2';
		const stats = parseGCodeStats(gcode);
		expect(stats.hasSpindleOff).toBe(true);
	});

	it('should handle empty G-code', () => {
		const stats = parseGCodeStats('');
		expect(stats.lineCount).toBe(0);
		expect(stats.rapidMoves).toBe(0);
		expect(stats.linearMoves).toBe(0);
		expect(stats.hasSpindleOn).toBe(false);
		expect(stats.hasSpindleOff).toBe(false);
	});

	it('should skip empty lines', () => {
		const gcode = '\n\nG90\n\nG21\n\n';
		const stats = parseGCodeStats(gcode);
		expect(stats.lineCount).toBe(2);
	});

	it('should handle complete G-code file', () => {
		const gcode = [
			'; SimpleCNC G-code',
			'G90',
			'G21',
			'S12000 M3',
			'G0 Z5.000',
			'G0 X0.000 Y0.000',
			'G1 Z-1.000 F300',
			'G1 X10.000 Y0.000 F800',
			'G1 X10.000 Y10.000 F800',
			'G0 Z5.000',
			'M5',
			'M2'
		].join('\n');
		const stats = parseGCodeStats(gcode);
		expect(stats.lineCount).toBe(11);
		expect(stats.rapidMoves).toBe(3);
		expect(stats.linearMoves).toBe(3);
		expect(stats.hasSpindleOn).toBe(true);
		expect(stats.hasSpindleOff).toBe(true);
	});
});
