import type { ToolConfig } from '$lib/types/tool.js';
import type { MachineConfig } from '$lib/types/machine.js';

/**
 * Generate G-code preamble/header.
 */
export function generateHeader(toolConfig: ToolConfig, machineConfig: MachineConfig): string {
	const lines: string[] = [];

	lines.push('; SimpleCNC G-code');
	lines.push(`; Generated: ${new Date().toISOString()}`);
	lines.push(`; Tool: ${toolConfig.type} D${toolConfig.diameter}mm`);
	lines.push('');
	lines.push('G90 ; Absolute positioning');
	lines.push('G21 ; Units: millimeters');
	lines.push('');
	lines.push(`S${toolConfig.spindleSpeed} M3 ; Spindle ON clockwise`);
	lines.push('');
	lines.push(`G0 Z${formatNum(machineConfig.safeZ)} ; Move to safe Z`);
	lines.push('');

	return lines.join('\n');
}

/**
 * Generate G-code footer/ending.
 */
export function generateFooter(machineConfig: MachineConfig): string {
	const lines: string[] = [];

	lines.push('');
	lines.push(`G0 Z${formatNum(machineConfig.safeZ)} ; Retract to safe Z`);
	lines.push('G0 X0 Y0 ; Return to origin');
	lines.push('M5 ; Spindle OFF');
	lines.push('M2 ; Program end');
	lines.push('');

	return lines.join('\n');
}

export function formatNum(n: number, decimals: number = 3): string {
	return n.toFixed(decimals);
}
