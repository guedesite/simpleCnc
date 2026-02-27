import { describe, it, expect } from 'vitest';
import { computeOriginOffsets, type OriginPosition, type MachineConfig } from '$lib/types/machine.js';
import { generateGCode, generateGCodeFromPoints } from '../generator.js';
import { polylinesToToolPath } from '$lib/engine/path/toolpath.js';
import { computeHeightMap } from '$lib/engine/stl/drop-cutter.js';
import { generateRasterPaths } from '$lib/engine/stl/raster.js';
import { ToolType, type ToolConfig } from '$lib/types/tool.js';
import type { ZMapConfig, Triangle } from '$lib/types/stl.js';

// ─── Shared fixtures ───────────────────────────────────────────

const toolConfig: ToolConfig = {
	type: ToolType.FlatEnd,
	diameter: 6,
	angle: 60,
	spindleSpeed: 12000,
	feedRate: 800,
	plungeRate: 300
};

function makeMachineConfig(originPosition: OriginPosition, stockW = 200, stockH = 200): MachineConfig {
	const { originX, originY } = computeOriginOffsets(originPosition, stockW, stockH);
	return { safeZ: 5, originX, originY, originPosition };
}

/** Extract all G-code coordinate lines (G0/G1/G2/G3) as parsed objects */
function parseGCodeMoves(gcode: string): Array<{ cmd: string; x?: number; y?: number; z?: number }> {
	const moves: Array<{ cmd: string; x?: number; y?: number; z?: number }> = [];
	let lastX = 0, lastY = 0, lastZ = 0;

	for (const line of gcode.split('\n')) {
		const trimmed = line.split(';')[0].trim();
		const cmdMatch = trimmed.match(/^(G[0-3])\b/);
		if (!cmdMatch) continue;
		const cmd = cmdMatch[1];

		const xm = trimmed.match(/X(-?[\d.]+)/);
		const ym = trimmed.match(/Y(-?[\d.]+)/);
		const zm = trimmed.match(/Z(-?[\d.]+)/);

		const x = xm ? parseFloat(xm[1]) : lastX;
		const y = ym ? parseFloat(ym[1]) : lastY;
		const z = zm ? parseFloat(zm[1]) : lastZ;

		moves.push({ cmd, x, y, z });
		lastX = x; lastY = y; lastZ = z;
	}
	return moves;
}

/** Get only cut moves (G1) from parsed moves */
function getCutMoves(moves: ReturnType<typeof parseGCodeMoves>) {
	return moves.filter(m => m.cmd === 'G1');
}

/** Get only rapid moves (G0) from parsed moves */
function getRapidMoves(moves: ReturnType<typeof parseGCodeMoves>) {
	return moves.filter(m => m.cmd === 'G0');
}

// ─── computeOriginOffsets tests ────────────────────────────────

describe('computeOriginOffsets', () => {
	const W = 200;
	const H = 150;

	it('front-left: origin at (0, 0)', () => {
		const { originX, originY } = computeOriginOffsets('front-left', W, H);
		expect(originX).toBe(0);
		expect(originY).toBe(0);
	});

	it('front-center: origin X offset by -W/2', () => {
		const { originX, originY } = computeOriginOffsets('front-center', W, H);
		expect(originX).toBe(-100);
		expect(originY).toBe(0);
	});

	it('front-right: origin X offset by -W', () => {
		const { originX, originY } = computeOriginOffsets('front-right', W, H);
		expect(originX).toBe(-200);
		expect(originY).toBe(0);
	});

	it('left (center-left): origin Y offset by -H/2', () => {
		const { originX, originY } = computeOriginOffsets('left', W, H);
		expect(originX).toBe(0);
		expect(originY).toBe(-75);
	});

	it('center: origin at (-W/2, -H/2)', () => {
		const { originX, originY } = computeOriginOffsets('center', W, H);
		expect(originX).toBe(-100);
		expect(originY).toBe(-75);
	});

	it('right (center-right): origin at (-W, -H/2)', () => {
		const { originX, originY } = computeOriginOffsets('right', W, H);
		expect(originX).toBe(-200);
		expect(originY).toBe(-75);
	});

	it('back-left: origin Y offset by -H', () => {
		const { originX, originY } = computeOriginOffsets('back-left', W, H);
		expect(originX).toBe(0);
		expect(originY).toBe(-150);
	});

	it('back-center: origin at (-W/2, -H)', () => {
		const { originX, originY } = computeOriginOffsets('back-center', W, H);
		expect(originX).toBe(-100);
		expect(originY).toBe(-150);
	});

	it('back-right: origin at (-W, -H)', () => {
		const { originX, originY } = computeOriginOffsets('back-right', W, H);
		expect(originX).toBe(-200);
		expect(originY).toBe(-150);
	});

	it('works with non-square stock', () => {
		const { originX, originY } = computeOriginOffsets('center', 100, 50);
		expect(originX).toBe(-50);
		expect(originY).toBe(-25);
	});
});

// ─── SVG G-code origin offset tests ───────────────────────────

describe('generateGCode (SVG) with origin offsets', () => {
	const simplePolyline = [{ points: [{ x: 10, y: 20 }, { x: 30, y: 40 }] }];

	it('front-left (0,0): coordinates unchanged', () => {
		const mc = makeMachineConfig('front-left');
		const toolPath = polylinesToToolPath(simplePolyline, 1, 5, 800, 300);
		const gcode = generateGCode(toolPath, toolConfig, mc);
		const moves = parseGCodeMoves(gcode);

		// Should find X10 and X30 and Y20 and Y40 (±0 offset)
		const cutMoves = getCutMoves(moves);
		expect(cutMoves.some(m => Math.abs(m.x! - 30) < 0.01)).toBe(true);
		expect(cutMoves.some(m => Math.abs(m.y! - 40) < 0.01)).toBe(true);
	});

	it('center: coordinates shifted by (-W/2, -H/2)', () => {
		const mc = makeMachineConfig('center');
		const toolPath = polylinesToToolPath(simplePolyline, 1, 5, 800, 300);
		const gcode = generateGCode(toolPath, toolConfig, mc);
		const moves = parseGCodeMoves(gcode);

		// X = 30 + (-100) = -70, Y = 40 + (-100) = -60
		const cutMoves = getCutMoves(moves);
		expect(cutMoves.some(m => Math.abs(m.x! - (-70)) < 0.01)).toBe(true);
		expect(cutMoves.some(m => Math.abs(m.y! - (-60)) < 0.01)).toBe(true);
	});

	it('back-right: coordinates shifted by (-W, -H)', () => {
		const mc = makeMachineConfig('back-right');
		const toolPath = polylinesToToolPath(simplePolyline, 1, 5, 800, 300);
		const gcode = generateGCode(toolPath, toolConfig, mc);
		const moves = parseGCodeMoves(gcode);

		// X = 30 + (-200) = -170, Y = 40 + (-200) = -160
		const cutMoves = getCutMoves(moves);
		expect(cutMoves.some(m => Math.abs(m.x! - (-170)) < 0.01)).toBe(true);
		expect(cutMoves.some(m => Math.abs(m.y! - (-160)) < 0.01)).toBe(true);
	});

	it('all 9 origins produce correctly offset coordinates', () => {
		const positions: OriginPosition[] = [
			'front-left', 'front-center', 'front-right',
			'left', 'center', 'right',
			'back-left', 'back-center', 'back-right'
		];

		const inputPt = { x: 50, y: 50 };
		const polyline = [{ points: [inputPt, { x: 60, y: 60 }] }];
		const W = 200, H = 200;

		for (const pos of positions) {
			const mc = makeMachineConfig(pos, W, H);
			const toolPath = polylinesToToolPath(polyline, 1, 5, 800, 300);
			const gcode = generateGCode(toolPath, toolConfig, mc);
			const moves = parseGCodeMoves(gcode);

			// The endpoint (60,60) should be offset
			const expectedX = 60 + mc.originX;
			const expectedY = 60 + mc.originY;

			const cutMoves = getCutMoves(moves);
			const hasExpected = cutMoves.some(
				m => Math.abs(m.x! - expectedX) < 0.01 && Math.abs(m.y! - expectedY) < 0.01
			);
			expect(hasExpected, `Origin ${pos}: expected (${expectedX}, ${expectedY}) in G-code`).toBe(true);
		}
	});
});

// ─── STL G-code origin offset tests ──────────────────────────

describe('generateGCodeFromPoints (STL) with origin offsets', () => {
	const simpleSegments = [
		{ points: [{ x: 0, y: 0, z: 5 }], isRapid: true },
		{
			points: [
				{ x: 0, y: 0, z: 0 },
				{ x: 10, y: 0, z: 0 },
				{ x: 10, y: 10, z: 0 }
			],
			isRapid: false
		}
	];

	it('front-left: coordinates unchanged', () => {
		const mc = makeMachineConfig('front-left');
		const gcode = generateGCodeFromPoints(simpleSegments, toolConfig, mc);
		const moves = parseGCodeMoves(gcode);

		expect(moves.some(m => m.x === 10 && m.y === 0)).toBe(true);
		expect(moves.some(m => m.x === 10 && m.y === 10)).toBe(true);
	});

	it('center: X shifted by -100, Y shifted by -100', () => {
		const mc = makeMachineConfig('center');
		const gcode = generateGCodeFromPoints(simpleSegments, toolConfig, mc);
		const moves = parseGCodeMoves(gcode);

		// (10, 0) + (-100, -100) = (-90, -100)
		expect(moves.some(m => Math.abs(m.x! - (-90)) < 0.01 && Math.abs(m.y! - (-100)) < 0.01)).toBe(true);
		// (10, 10) + (-100, -100) = (-90, -90)
		expect(moves.some(m => Math.abs(m.x! - (-90)) < 0.01 && Math.abs(m.y! - (-90)) < 0.01)).toBe(true);
	});

	it('back-left: only Y shifted by -200', () => {
		const mc = makeMachineConfig('back-left');
		const gcode = generateGCodeFromPoints(simpleSegments, toolConfig, mc);
		const moves = parseGCodeMoves(gcode);

		// (10, 10) + (0, -200) = (10, -190)
		expect(moves.some(m => Math.abs(m.x! - 10) < 0.01 && Math.abs(m.y! - (-190)) < 0.01)).toBe(true);
	});

	it('front-right: only X shifted by -200', () => {
		const mc = makeMachineConfig('front-right');
		const gcode = generateGCodeFromPoints(simpleSegments, toolConfig, mc);
		const moves = parseGCodeMoves(gcode);

		// (10, 10) + (-200, 0) = (-190, 10)
		expect(moves.some(m => Math.abs(m.x! - (-190)) < 0.01 && Math.abs(m.y! - 10) < 0.01)).toBe(true);
	});

	it('all 9 origins produce correctly offset coordinates', () => {
		const positions: OriginPosition[] = [
			'front-left', 'front-center', 'front-right',
			'left', 'center', 'right',
			'back-left', 'back-center', 'back-right'
		];

		const testPt = { x: 50, y: 75, z: 2 };
		const segs = [{ points: [testPt], isRapid: false }];

		for (const pos of positions) {
			const mc = makeMachineConfig(pos);
			const gcode = generateGCodeFromPoints(segs, toolConfig, mc);
			const moves = parseGCodeMoves(gcode);

			const expectedX = testPt.x + mc.originX;
			const expectedY = testPt.y + mc.originY;

			const found = moves.some(
				m => Math.abs(m.x! - expectedX) < 0.01 && Math.abs(m.y! - expectedY) < 0.01
			);
			expect(found, `Origin ${pos}: expected (${expectedX}, ${expectedY})`).toBe(true);
		}
	});

	it('Z coordinates are NOT affected by origin offsets', () => {
		const mc = makeMachineConfig('center');
		const segs = [
			{ points: [{ x: 0, y: 0, z: 5 }], isRapid: true },
			{ points: [{ x: 0, y: 0, z: -2 }], isRapid: false }
		];
		const gcode = generateGCodeFromPoints(segs, toolConfig, mc);

		// Z should still be 5 and -2, not shifted
		expect(gcode).toContain('Z5.000');
		expect(gcode).toContain('Z-2.000');
	});
});

// ─── End-to-end: HeightMap → Raster → G-code with origins ────

describe('End-to-end STL pipeline with origin offsets', () => {
	// A small flat triangle sitting on stock surface at (5,5)-(15,5)-(10,15), Z=3
	const triangle: Triangle = {
		v0: { x: 5, y: 5, z: 3 },
		v1: { x: 15, y: 5, z: 3 },
		v2: { x: 10, y: 15, z: 3 }
	};

	const smallStock = { width: 20, height: 20, thickness: 10 };
	const zmapConfig: ZMapConfig = {
		resolution: 5,
		gridWidth: 5,
		gridHeight: 5,
		physicalWidth: 20,
		physicalHeight: 20
	};

	function generateForOrigin(origin: OriginPosition) {
		const mc = makeMachineConfig(origin, smallStock.width, smallStock.height);
		const heightMap = computeHeightMap([triangle], zmapConfig, toolConfig);
		const rasterPaths = generateRasterPaths(heightMap, 5, mc.safeZ);
		return generateGCodeFromPoints(rasterPaths, toolConfig, mc);
	}

	it('front-left: all XY coords are >= 0', () => {
		const gcode = generateForOrigin('front-left');
		const moves = parseGCodeMoves(gcode);

		for (const m of moves) {
			if (m.x !== undefined) expect(m.x).toBeGreaterThanOrEqual(-0.01);
			if (m.y !== undefined) expect(m.y).toBeGreaterThanOrEqual(-0.01);
		}
	});

	it('back-right: all XY coords are <= 0', () => {
		const gcode = generateForOrigin('back-right');
		const moves = parseGCodeMoves(gcode);

		for (const m of moves) {
			if (m.cmd === 'G0' || m.cmd === 'G1') {
				expect(m.x!).toBeLessThanOrEqual(0.01);
				expect(m.y!).toBeLessThanOrEqual(0.01);
			}
		}
	});

	it('center: coords span [-W/2, W/2] and [-H/2, H/2]', () => {
		const gcode = generateForOrigin('center');
		const moves = parseGCodeMoves(gcode);

		let minX = Infinity, maxX = -Infinity;
		let minY = Infinity, maxY = -Infinity;
		for (const m of moves) {
			if (m.cmd === 'G0' || m.cmd === 'G1') {
				if (m.x! < minX) minX = m.x!;
				if (m.x! > maxX) maxX = m.x!;
				if (m.y! < minY) minY = m.y!;
				if (m.y! > maxY) maxY = m.y!;
			}
		}

		// With 20x20 stock and center origin: offset is (-10, -10)
		// Raster coords range 0→20, so G-code should range -10→10
		expect(minX).toBeCloseTo(-10, 0);
		expect(maxX).toBeCloseTo(10, 0);
		expect(minY).toBeCloseTo(-10, 0);
		expect(maxY).toBeCloseTo(10, 0);
	});

	it('different origins shift the XY bounding range by the offset difference', () => {
		const gcodeFrontLeft = generateForOrigin('front-left');
		const gcodeCenter = generateForOrigin('center');

		const movesFl = parseGCodeMoves(gcodeFrontLeft);
		const movesCt = parseGCodeMoves(gcodeCenter);

		// Compute min/max X/Y for non-header/footer moves (skip first and last)
		function getBounds(moves: ReturnType<typeof parseGCodeMoves>) {
			let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
			// Skip first move (header Z) and last 2 moves (footer retract + return)
			for (let i = 1; i < moves.length - 2; i++) {
				const m = moves[i];
				if (m.x! < minX) minX = m.x!;
				if (m.x! > maxX) maxX = m.x!;
				if (m.y! < minY) minY = m.y!;
				if (m.y! > maxY) maxY = m.y!;
			}
			return { minX, maxX, minY, maxY };
		}

		const flBounds = getBounds(movesFl);
		const ctBounds = getBounds(movesCt);

		const dx = -10; // center offset for 20x20 stock
		const dy = -10;

		// Min/Max should differ by exactly the origin offset
		expect(ctBounds.minX).toBeCloseTo(flBounds.minX + dx, 1);
		expect(ctBounds.maxX).toBeCloseTo(flBounds.maxX + dx, 1);
		expect(ctBounds.minY).toBeCloseTo(flBounds.minY + dy, 1);
		expect(ctBounds.maxY).toBeCloseTo(flBounds.maxY + dy, 1);
	});
});

// ─── Toolpath preview data tests ─────────────────────────────

describe('Toolpath preview data (stock-local, no origin offset)', () => {
	it('raster toolpath data is in stock-local coordinates', () => {
		const zmapConfig: ZMapConfig = {
			resolution: 10,
			gridWidth: 3,
			gridHeight: 3,
			physicalWidth: 20,
			physicalHeight: 20
		};

		const triangle: Triangle = {
			v0: { x: 5, y: 5, z: 3 },
			v1: { x: 15, y: 5, z: 3 },
			v2: { x: 10, y: 15, z: 3 }
		};

		const heightMap = computeHeightMap([triangle], zmapConfig, toolConfig);
		const rasterPaths = generateRasterPaths(heightMap, 10, 5);

		// Check all points are in [0, physicalWidth] × [0, physicalHeight]
		for (const path of rasterPaths) {
			for (const pt of path.points) {
				expect(pt.x).toBeGreaterThanOrEqual(0);
				expect(pt.x).toBeLessThanOrEqual(20);
				expect(pt.y).toBeGreaterThanOrEqual(0);
				expect(pt.y).toBeLessThanOrEqual(20);
			}
		}
	});
});

// ─── Regression: origin with explicit values vs computed ─────

describe('Origin offset regression', () => {
	it('manual originX/originY matches computeOriginOffsets', () => {
		const positions: OriginPosition[] = [
			'front-left', 'front-center', 'front-right',
			'left', 'center', 'right',
			'back-left', 'back-center', 'back-right'
		];

		for (const pos of positions) {
			const computed = computeOriginOffsets(pos, 200, 200);
			const mc: MachineConfig = {
				safeZ: 5,
				originX: computed.originX,
				originY: computed.originY,
				originPosition: pos
			};

			const segs = [{ points: [{ x: 100, y: 100, z: 0 }], isRapid: false }];
			const gcode = generateGCodeFromPoints(segs, toolConfig, mc);
			const moves = parseGCodeMoves(gcode);

			const expectedX = 100 + computed.originX;
			const expectedY = 100 + computed.originY;

			const found = moves.some(
				m => Math.abs(m.x! - expectedX) < 0.01 && Math.abs(m.y! - expectedY) < 0.01
			);
			expect(found, `${pos}: (100+${computed.originX}, 100+${computed.originY}) = (${expectedX}, ${expectedY})`).toBe(true);
		}
	});

	it('center origin: stock center point maps to G-code (0,0)', () => {
		const mc = makeMachineConfig('center');
		// Stock is 200x200, center is at (100, 100)
		const segs = [{ points: [{ x: 100, y: 100, z: 0 }], isRapid: false }];
		const gcode = generateGCodeFromPoints(segs, toolConfig, mc);
		const moves = parseGCodeMoves(gcode);

		// (100, 100) + (-100, -100) = (0, 0)
		const found = moves.some(m => Math.abs(m.x!) < 0.01 && Math.abs(m.y!) < 0.01);
		expect(found).toBe(true);
	});

	it('back-right origin: back-right corner maps to G-code (0,0)', () => {
		const mc = makeMachineConfig('back-right');
		// Stock is 200x200, back-right is at (200, 200)
		const segs = [{ points: [{ x: 200, y: 200, z: 0 }], isRapid: false }];
		const gcode = generateGCodeFromPoints(segs, toolConfig, mc);
		const moves = parseGCodeMoves(gcode);

		// (200, 200) + (-200, -200) = (0, 0)
		const found = moves.some(m => Math.abs(m.x!) < 0.01 && Math.abs(m.y!) < 0.01);
		expect(found).toBe(true);
	});

	it('front-left corner is always at G-code (originX, originY)', () => {
		const positions: OriginPosition[] = [
			'front-left', 'front-center', 'front-right',
			'left', 'center', 'right',
			'back-left', 'back-center', 'back-right'
		];

		for (const pos of positions) {
			const mc = makeMachineConfig(pos);
			// Front-left corner of stock is at (0, 0) in stock space
			const segs = [{ points: [{ x: 0, y: 0, z: 0 }], isRapid: false }];
			const gcode = generateGCodeFromPoints(segs, toolConfig, mc);
			const moves = parseGCodeMoves(gcode);

			// (0, 0) + (originX, originY) = (originX, originY)
			const found = moves.some(
				m => Math.abs(m.x! - mc.originX) < 0.01 && Math.abs(m.y! - mc.originY) < 0.01
			);
			expect(found, `${pos}: front-left corner at (${mc.originX}, ${mc.originY})`).toBe(true);
		}
	});
});
