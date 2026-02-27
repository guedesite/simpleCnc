import { saveAs } from 'file-saver';

/**
 * Export G-code string as a downloadable file.
 */
export function exportGCode(gcode: string, filename: string = 'output.nc'): void {
	const blob = new Blob([gcode], { type: 'text/plain;charset=utf-8' });
	saveAs(blob, filename);
}

/**
 * Create a Blob from G-code string (for preview or other uses).
 */
export function gcodeToBlob(gcode: string): Blob {
	return new Blob([gcode], { type: 'text/plain;charset=utf-8' });
}

/**
 * Parse G-code stats from a G-code string.
 */
export function parseGCodeStats(gcode: string): {
	lineCount: number;
	rapidMoves: number;
	linearMoves: number;
	hasSpindleOn: boolean;
	hasSpindleOff: boolean;
} {
	const lines = gcode.split('\n').filter((l) => l.trim() && !l.trim().startsWith(';'));
	let rapidMoves = 0;
	let linearMoves = 0;
	let hasSpindleOn = false;
	let hasSpindleOff = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith('G0')) rapidMoves++;
		if (trimmed.startsWith('G1')) linearMoves++;
		if (trimmed.includes('M3')) hasSpindleOn = true;
		if (trimmed.includes('M5')) hasSpindleOff = true;
	}

	return { lineCount: lines.length, rapidMoves, linearMoves, hasSpindleOn, hasSpindleOff };
}
