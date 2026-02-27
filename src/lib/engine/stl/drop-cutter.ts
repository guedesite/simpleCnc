import type { Triangle } from '$lib/types/stl.js';
import type { HeightMap, ZMapConfig } from '$lib/types/stl.js';
import type { ToolConfig } from '$lib/types/tool.js';
import { ToolType } from '$lib/types/tool.js';
import { degToRad } from '$lib/utils/math.js';

// ─── Public API ───────────────────────────────────────────────

/**
 * Pure-math drop cutter algorithm with spatial bucket grid acceleration.
 * For each grid point, "drops" the tool onto nearby triangles and finds the highest contact Z.
 * No Three.js dependency - safe for Web Workers.
 *
 * Accepts either raw Float32Array (9 floats per triangle: x0,y0,z0,...) or Triangle[].
 * The Float32Array path avoids object allocation overhead.
 */
export function computeHeightMap(
	input: Float32Array | Triangle[],
	config: ZMapConfig,
	toolConfig: ToolConfig,
	onProgress?: (percent: number) => void
): HeightMap {
	const vertices = input instanceof Float32Array ? input : flattenTriangles(input);
	return computeHeightMapOptimized(vertices, config, toolConfig, onProgress);
}

/**
 * Compute the Z height where a tool at position (px, py) contacts a triangle.
 * Returns -Infinity if no contact.
 */
export function dropCutterOnTriangle(
	px: number,
	py: number,
	tri: Triangle,
	toolConfig: ToolConfig,
	toolRadius: number
): number {
	// Pack into temp buffer for the fast path
	_tv[0] = tri.v0.x; _tv[1] = tri.v0.y; _tv[2] = tri.v0.z;
	_tv[3] = tri.v1.x; _tv[4] = tri.v1.y; _tv[5] = tri.v1.z;
	_tv[6] = tri.v2.x; _tv[7] = tri.v2.y; _tv[8] = tri.v2.z;

	const rSq = toolRadius * toolRadius;
	switch (toolConfig.type) {
		case ToolType.FlatEnd:
			return dropFlatFast(px, py, _tv, 0, toolRadius, rSq);
		case ToolType.BallNose:
			return dropBallFast(px, py, _tv, 0, toolRadius, rSq);
		case ToolType.VBit:
			return dropVBitFast(px, py, _tv, 0, toolRadius, rSq,
				Math.tan(degToRad(toolConfig.angle / 2)));
		default:
			return -Infinity;
	}
}

export function isPointInTriangleXY(px: number, py: number, tri: Triangle): boolean {
	return inTriXY(px, py, tri.v0.x, tri.v0.y, tri.v1.x, tri.v1.y, tri.v2.x, tri.v2.y);
}

// ─── Internals ────────────────────────────────────────────────

/** Temp buffer for dropCutterOnTriangle (avoids allocation per call) */
const _tv = new Float32Array(9);

/** Convert Triangle[] to flat Float32Array (9 floats per triangle) */
function flattenTriangles(triangles: Triangle[]): Float32Array {
	const n = triangles.length;
	const a = new Float32Array(n * 9);
	for (let i = 0; i < n; i++) {
		const t = triangles[i], b = i * 9;
		a[b] = t.v0.x; a[b + 1] = t.v0.y; a[b + 2] = t.v0.z;
		a[b + 3] = t.v1.x; a[b + 4] = t.v1.y; a[b + 5] = t.v1.z;
		a[b + 6] = t.v2.x; a[b + 7] = t.v2.y; a[b + 8] = t.v2.z;
	}
	return a;
}

// ─── Optimized main loop with spatial bucket grid ─────────────

function computeHeightMapOptimized(
	vertices: Float32Array,
	config: ZMapConfig,
	toolConfig: ToolConfig,
	onProgress?: (percent: number) => void
): HeightMap {
	const gw = config.gridWidth;
	const gh = config.gridHeight;
	const data = new Float32Array(gw * gh);
	const toolRadius = toolConfig.diameter / 2;
	const triCount = (vertices.length / 9) | 0;

	if (triCount === 0) {
		data.fill(0);
		return { config, data };
	}

	// Tool-specific precomputation
	const toolType = toolConfig.type;
	const rSq = toolRadius * toolRadius;
	let tanHalf = 0;
	if (toolType === ToolType.VBit) {
		tanHalf = Math.tan(degToRad(toolConfig.angle / 2));
	}

	// ── Build spatial bucket grid ──
	// Cell size balances between too many cells (overhead) and too few (no speedup).
	// Triangles are assigned to all cells their expanded bounding box overlaps.
	// Each grid point only checks its own cell - the expansion ensures all
	// relevant triangles are present.
	const cellSize = Math.max(
		toolRadius * 4,
		Math.max(config.physicalWidth, config.physicalHeight) / 32
	);
	const invCell = 1 / cellSize;
	const bCols = Math.max(1, ((config.physicalWidth * invCell) | 0) + 2);
	const bRows = Math.max(1, ((config.physicalHeight * invCell) | 0) + 2);
	const bCount = bCols * bRows;

	// Per-triangle max Z for early exit
	const triMaxZ = new Float32Array(triCount);

	// Build bucket lists
	const bLists: number[][] = new Array(bCount);
	for (let i = 0; i < bCount; i++) bLists[i] = [];

	for (let t = 0; t < triCount; t++) {
		const o = t * 9;
		const x0 = vertices[o], y0 = vertices[o + 1], z0 = vertices[o + 2];
		const x1 = vertices[o + 3], y1 = vertices[o + 4], z1 = vertices[o + 5];
		const x2 = vertices[o + 6], y2 = vertices[o + 7], z2 = vertices[o + 8];

		triMaxZ[t] = Math.max(z0, z1, z2);

		// Bounding box expanded by tool radius
		const minX = Math.min(x0, x1, x2) - toolRadius;
		const minY = Math.min(y0, y1, y2) - toolRadius;
		const maxX = Math.max(x0, x1, x2) + toolRadius;
		const maxY = Math.max(y0, y1, y2) + toolRadius;

		// Skip triangles that don't overlap the grid area
		if (maxX < 0 || minX > config.physicalWidth ||
			maxY < 0 || minY > config.physicalHeight) continue;

		const c0 = Math.max(0, (minX * invCell) | 0);
		const c1 = Math.min(bCols - 1, (maxX * invCell) | 0);
		const r0 = Math.max(0, (minY * invCell) | 0);
		const r1 = Math.min(bRows - 1, (maxY * invCell) | 0);

		for (let r = r0; r <= r1; r++) {
			const rowOff = r * bCols;
			for (let c = c0; c <= c1; c++) {
				bLists[rowOff + c].push(t);
			}
		}
	}

	// Convert to typed arrays for cache-friendly iteration
	const buckets: Int32Array[] = new Array(bCount);
	for (let i = 0; i < bCount; i++) {
		buckets[i] = new Int32Array(bLists[i]);
	}

	// ── Main grid traversal ──
	const xScale = gw > 1 ? config.physicalWidth / (gw - 1) : 0;
	const yScale = gh > 1 ? config.physicalHeight / (gh - 1) : 0;

	data.fill(-Infinity);

	for (let gy = 0; gy < gh; gy++) {
		const py = gy * yScale;
		const bRow = Math.min(bRows - 1, Math.max(0, (py * invCell) | 0));
		const rowOff = bRow * bCols;

		for (let gx = 0; gx < gw; gx++) {
			const px = gx * xScale;
			const bCol = Math.min(bCols - 1, Math.max(0, (px * invCell) | 0));

			const bucket = buckets[rowOff + bCol];
			const bLen = bucket.length;
			let maxZ = -Infinity;

			for (let bi = 0; bi < bLen; bi++) {
				const ti = bucket[bi];
				// Early exit: triangle's max Z can't beat current best
				if (triMaxZ[ti] <= maxZ) continue;

				const base = ti * 9;
				let z: number;

				switch (toolType) {
					case ToolType.FlatEnd:
						z = dropFlatFast(px, py, vertices, base, toolRadius, rSq);
						break;
					case ToolType.BallNose:
						z = dropBallFast(px, py, vertices, base, toolRadius, rSq);
						break;
					case ToolType.VBit:
						z = dropVBitFast(px, py, vertices, base, toolRadius, rSq, tanHalf);
						break;
					default:
						z = -Infinity;
				}

				if (z > maxZ) maxZ = z;
			}

			data[gy * gw + gx] = maxZ === -Infinity ? 0 : maxZ;
		}

		if (onProgress && gy % 10 === 0) {
			onProgress((gy / gh) * 100);
		}
	}

	return { config, data };
}

// ─── Fast per-triangle drop functions (flat array, no allocation) ───

function dropFlatFast(
	px: number, py: number,
	v: Float32Array, o: number,
	radius: number, rSq: number
): number {
	const v0x = v[o], v0y = v[o + 1], v0z = v[o + 2];
	const v1x = v[o + 3], v1y = v[o + 4], v1z = v[o + 5];
	const v2x = v[o + 6], v2y = v[o + 7], v2z = v[o + 8];

	// Face check: early return if tool center is inside triangle XY projection
	if (inTriXY(px, py, v0x, v0y, v1x, v1y, v2x, v2y)) {
		const z = planeZAt(px, py, v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z);
		if (z > -Infinity) return z;
	}

	let maxZ = -Infinity;

	// Edge checks (inline closest-point-on-segment, no allocation)
	maxZ = edgeFlatZ(px, py, v0x, v0y, v0z, v1x, v1y, v1z, rSq, maxZ);
	maxZ = edgeFlatZ(px, py, v1x, v1y, v1z, v2x, v2y, v2z, rSq, maxZ);
	maxZ = edgeFlatZ(px, py, v2x, v2y, v2z, v0x, v0y, v0z, rSq, maxZ);

	// Vertex checks
	let dx = v0x - px, dy = v0y - py;
	if (dx * dx + dy * dy <= rSq && v0z > maxZ) maxZ = v0z;
	dx = v1x - px; dy = v1y - py;
	if (dx * dx + dy * dy <= rSq && v1z > maxZ) maxZ = v1z;
	dx = v2x - px; dy = v2y - py;
	if (dx * dx + dy * dy <= rSq && v2z > maxZ) maxZ = v2z;

	return maxZ;
}

function dropBallFast(
	px: number, py: number,
	v: Float32Array, o: number,
	radius: number, rSq: number
): number {
	const v0x = v[o], v0y = v[o + 1], v0z = v[o + 2];
	const v1x = v[o + 3], v1y = v[o + 4], v1z = v[o + 5];
	const v2x = v[o + 6], v2y = v[o + 7], v2z = v[o + 8];

	let maxZ = -Infinity;

	// Face check with normal validation
	if (inTriXY(px, py, v0x, v0y, v1x, v1y, v2x, v2y)) {
		const e1x = v1x - v0x, e1y = v1y - v0y, e1z = v1z - v0z;
		const e2x = v2x - v0x, e2y = v2y - v0y, e2z = v2z - v0z;
		const nx = e1y * e2z - e1z * e2y;
		const ny = e1z * e2x - e1x * e2z;
		const nz = e1x * e2y - e1y * e2x;
		if (Math.abs(nz) > 1e-10) {
			const nLenSq = nx * nx + ny * ny + nz * nz;
			// Check |nz/nLen| > 0.0001 via squared comparison (avoids sqrt)
			if ((nz * nz) / nLenSq > 1e-8) {
				const pz = v0z + (-nx * (px - v0x) - ny * (py - v0y)) / nz;
				if (pz > maxZ) maxZ = pz;
			}
		}
	}

	// Edge checks: tipZ = edgeZ - r + sqrt(r² - d²)
	maxZ = edgeBallZ(px, py, v0x, v0y, v0z, v1x, v1y, v1z, radius, rSq, maxZ);
	maxZ = edgeBallZ(px, py, v1x, v1y, v1z, v2x, v2y, v2z, radius, rSq, maxZ);
	maxZ = edgeBallZ(px, py, v2x, v2y, v2z, v0x, v0y, v0z, radius, rSq, maxZ);

	// Vertex checks: tipZ = vertexZ - r + sqrt(r² - d²)
	let dx = v0x - px, dy = v0y - py, dSq = dx * dx + dy * dy;
	if (dSq < rSq) { const z = v0z - radius + Math.sqrt(rSq - dSq); if (z > maxZ) maxZ = z; }
	dx = v1x - px; dy = v1y - py; dSq = dx * dx + dy * dy;
	if (dSq < rSq) { const z = v1z - radius + Math.sqrt(rSq - dSq); if (z > maxZ) maxZ = z; }
	dx = v2x - px; dy = v2y - py; dSq = dx * dx + dy * dy;
	if (dSq < rSq) { const z = v2z - radius + Math.sqrt(rSq - dSq); if (z > maxZ) maxZ = z; }

	return maxZ;
}

function dropVBitFast(
	px: number, py: number,
	v: Float32Array, o: number,
	radius: number, rSq: number,
	tanHalf: number
): number {
	const v0x = v[o], v0y = v[o + 1], v0z = v[o + 2];
	const v1x = v[o + 3], v1y = v[o + 4], v1z = v[o + 5];
	const v2x = v[o + 6], v2y = v[o + 7], v2z = v[o + 8];

	let maxZ = -Infinity;

	// Face check: tip sits directly on the surface
	if (inTriXY(px, py, v0x, v0y, v1x, v1y, v2x, v2y)) {
		const pz = planeZAt(px, py, v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z);
		if (pz > -Infinity && pz > maxZ) maxZ = pz;
	}

	// Edge checks: tipZ = edgeZ - d/tan(halfAngle)
	maxZ = edgeVBitZ(px, py, v0x, v0y, v0z, v1x, v1y, v1z, rSq, tanHalf, maxZ);
	maxZ = edgeVBitZ(px, py, v1x, v1y, v1z, v2x, v2y, v2z, rSq, tanHalf, maxZ);
	maxZ = edgeVBitZ(px, py, v2x, v2y, v2z, v0x, v0y, v0z, rSq, tanHalf, maxZ);

	// Vertex checks: tipZ = vertexZ - d/tan(halfAngle)
	let dx = v0x - px, dy = v0y - py, dSq = dx * dx + dy * dy;
	if (dSq < rSq) { const z = v0z - Math.sqrt(dSq) / tanHalf; if (z > maxZ) maxZ = z; }
	dx = v1x - px; dy = v1y - py; dSq = dx * dx + dy * dy;
	if (dSq < rSq) { const z = v1z - Math.sqrt(dSq) / tanHalf; if (z > maxZ) maxZ = z; }
	dx = v2x - px; dy = v2y - py; dSq = dx * dx + dy * dy;
	if (dSq < rSq) { const z = v2z - Math.sqrt(dSq) / tanHalf; if (z > maxZ) maxZ = z; }

	return maxZ;
}

// ─── Shared geometry helpers (allocation-free) ────────────────

/** Point-in-triangle XY test using cross product signs */
function inTriXY(
	px: number, py: number,
	ax: number, ay: number,
	bx: number, by: number,
	cx: number, cy: number
): boolean {
	const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
	const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
	const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
	const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
	const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
	return !(hasNeg && hasPos);
}

/** Compute Z on triangle's plane at (px, py). Returns -Infinity if nearly vertical. */
function planeZAt(
	px: number, py: number,
	v0x: number, v0y: number, v0z: number,
	v1x: number, v1y: number, v1z: number,
	v2x: number, v2y: number, v2z: number
): number {
	const e1x = v1x - v0x, e1y = v1y - v0y, e1z = v1z - v0z;
	const e2x = v2x - v0x, e2y = v2y - v0y, e2z = v2z - v0z;
	// Compute nz first for early exit on near-vertical triangles
	const nz = e1x * e2y - e1y * e2x;
	if (Math.abs(nz) < 1e-10) return -Infinity;
	const nx = e1y * e2z - e1z * e2y;
	const ny = e1z * e2x - e1x * e2z;
	return v0z + (-nx * (px - v0x) - ny * (py - v0y)) / nz;
}

/** Edge contact Z for flat endmill. Returns updated maxZ. */
function edgeFlatZ(
	px: number, py: number,
	ax: number, ay: number, az: number,
	bx: number, by: number, bz: number,
	rSq: number, maxZ: number
): number {
	const edx = bx - ax, edy = by - ay;
	const lenSq = edx * edx + edy * edy;
	let t = 0;
	if (lenSq > 1e-20) {
		t = ((px - ax) * edx + (py - ay) * edy) / lenSq;
		if (t < 0) t = 0; else if (t > 1) t = 1;
	}
	const cx = ax + t * edx, cy = ay + t * edy;
	const dx = cx - px, dy = cy - py;
	if (dx * dx + dy * dy > rSq) return maxZ;
	const z = az + t * (bz - az);
	return z > maxZ ? z : maxZ;
}

/** Edge contact Z for ball nose. Returns updated maxZ. */
function edgeBallZ(
	px: number, py: number,
	ax: number, ay: number, az: number,
	bx: number, by: number, bz: number,
	radius: number, rSq: number, maxZ: number
): number {
	const edx = bx - ax, edy = by - ay;
	const lenSq = edx * edx + edy * edy;
	let t = 0;
	if (lenSq > 1e-20) {
		t = ((px - ax) * edx + (py - ay) * edy) / lenSq;
		if (t < 0) t = 0; else if (t > 1) t = 1;
	}
	const cx = ax + t * edx, cy = ay + t * edy;
	const dx = cx - px, dy = cy - py;
	const dSq = dx * dx + dy * dy;
	if (dSq >= rSq) return maxZ;
	const edgeZ = az + t * (bz - az);
	const z = edgeZ - radius + Math.sqrt(rSq - dSq);
	return z > maxZ ? z : maxZ;
}

/** Edge contact Z for V-bit. Returns updated maxZ. */
function edgeVBitZ(
	px: number, py: number,
	ax: number, ay: number, az: number,
	bx: number, by: number, bz: number,
	rSq: number, tanHalf: number, maxZ: number
): number {
	const edx = bx - ax, edy = by - ay;
	const lenSq = edx * edx + edy * edy;
	let t = 0;
	if (lenSq > 1e-20) {
		t = ((px - ax) * edx + (py - ay) * edy) / lenSq;
		if (t < 0) t = 0; else if (t > 1) t = 1;
	}
	const cx = ax + t * edx, cy = ay + t * edy;
	const dx = cx - px, dy = cy - py;
	const dSq = dx * dx + dy * dy;
	if (dSq >= rSq) return maxZ;
	const edgeZ = az + t * (bz - az);
	const z = edgeZ - Math.sqrt(dSq) / tanHalf;
	return z > maxZ ? z : maxZ;
}
