import type { Triangle } from '$lib/types/stl.js';
import type { HeightMap, ZMapConfig } from '$lib/types/stl.js';
import type { ToolConfig } from '$lib/types/tool.js';
import { ToolType } from '$lib/types/tool.js';
import { degToRad } from '$lib/utils/math.js';

/**
 * Pure-math drop cutter algorithm.
 * For each grid point, "drops" the tool onto all triangles and finds the highest contact Z.
 * No Three.js dependency - safe for Web Workers.
 */
export function computeHeightMap(
	triangles: Triangle[],
	config: ZMapConfig,
	toolConfig: ToolConfig,
	onProgress?: (percent: number) => void
): HeightMap {
	const data = new Float32Array(config.gridWidth * config.gridHeight);
	data.fill(-Infinity);

	const toolRadius = toolConfig.diameter / 2;
	const totalRows = config.gridHeight;

	for (let gy = 0; gy < config.gridHeight; gy++) {
		for (let gx = 0; gx < config.gridWidth; gx++) {
			const px = (gx / (config.gridWidth - 1)) * config.physicalWidth;
			const py = (gy / (config.gridHeight - 1)) * config.physicalHeight;

			let maxZ = -Infinity;

			for (const tri of triangles) {
				const z = dropCutterOnTriangle(px, py, tri, toolConfig, toolRadius);
				if (z > maxZ) maxZ = z;
			}

			data[gy * config.gridWidth + gx] = maxZ === -Infinity ? 0 : maxZ;
		}

		if (onProgress && gy % 10 === 0) {
			onProgress((gy / totalRows) * 100);
		}
	}

	return { config, data };
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
	switch (toolConfig.type) {
		case ToolType.FlatEnd:
			return dropFlatEndmill(px, py, tri, toolRadius);
		case ToolType.BallNose:
			return dropBallNose(px, py, tri, toolRadius);
		case ToolType.VBit:
			return dropVBit(px, py, tri, toolConfig);
		default:
			return -Infinity;
	}
}

/**
 * Drop a flat endmill onto a triangle.
 * The tool contacts the triangle at the highest point within the tool's circular footprint.
 */
function dropFlatEndmill(px: number, py: number, tri: Triangle, radius: number): number {
	// For a flat endmill, we need the highest Z of the triangle within the circle (px, py, r)
	// Simple approach: check if any vertex is within radius, and sample triangle plane
	const vertices = [tri.v0, tri.v1, tri.v2];

	// First check: is the tool center above the triangle's XY projection?
	// Get triangle plane Z at (px, py)
	const planeZ = trianglePlaneZ(px, py, tri);
	if (planeZ !== null && isPointInTriangleXY(px, py, tri)) {
		return planeZ;
	}

	// Check edges within radius
	let maxZ = -Infinity;
	for (let i = 0; i < 3; i++) {
		const v1 = vertices[i];
		const v2 = vertices[(i + 1) % 3];

		// Find closest point on edge to (px, py) in XY
		const closest = closestPointOnSegmentXY(px, py, v1.x, v1.y, v2.x, v2.y);
		const dx = closest.x - px;
		const dy = closest.y - py;
		const distSq = dx * dx + dy * dy;

		if (distSq <= radius * radius) {
			// Interpolate Z along edge
			const edgeDx = v2.x - v1.x;
			const edgeDy = v2.y - v1.y;
			const edgeLenSq = edgeDx * edgeDx + edgeDy * edgeDy;
			let t = 0;
			if (edgeLenSq > 0) {
				t = ((closest.x - v1.x) * edgeDx + (closest.y - v1.y) * edgeDy) / edgeLenSq;
				t = Math.max(0, Math.min(1, t));
			}
			const z = v1.z + t * (v2.z - v1.z);
			if (z > maxZ) maxZ = z;
		}
	}

	// Check vertices within radius
	for (const v of vertices) {
		const dx = v.x - px;
		const dy = v.y - py;
		if (dx * dx + dy * dy <= radius * radius) {
			if (v.z > maxZ) maxZ = v.z;
		}
	}

	return maxZ;
}

/**
 * Drop a ball nose endmill onto a triangle.
 * The ball surface at distance d from the axis is at tipZ + r - sqrt(r²-d²).
 * When the ball contacts a feature at height featureZ at distance d:
 *   tipZ + r - sqrt(r²-d²) = featureZ
 *   tipZ = featureZ - r + sqrt(r²-d²)
 */
function dropBallNose(px: number, py: number, tri: Triangle, radius: number): number {
	const vertices = [tri.v0, tri.v1, tri.v2];

	let maxZ = -Infinity;

	// Check triangle face
	if (isPointInTriangleXY(px, py, tri)) {
		const planeZ = trianglePlaneZ(px, py, tri);
		if (planeZ !== null) {
			// For a horizontal face, the ball tip sits right on the surface.
			// For tilted faces, compute the actual tip Z using the plane normal.
			const normal = triangleNormal(tri);
			if (normal) {
				const nz = Math.abs(normal.z);
				if (nz > 0.0001) {
					// Tip Z = planeZ - r + r/nz... simplified for horizontal: tipZ = planeZ
					// General: tipZ = planeZ - radius + radius * sqrt(1 - (nx²+ny²))... = planeZ
					// On a plane, the ball tip Z equals the plane Z at the contact XY
					if (planeZ > maxZ) maxZ = planeZ;
				}
			}
		}
	}

	// Check edges: tipZ = edgeZ - r + sqrt(r²-d²)
	for (let i = 0; i < 3; i++) {
		const v1 = vertices[i];
		const v2 = vertices[(i + 1) % 3];

		const closest = closestPointOnSegmentXY(px, py, v1.x, v1.y, v2.x, v2.y);
		const dx = closest.x - px;
		const dy = closest.y - py;
		const distXY = Math.sqrt(dx * dx + dy * dy);

		if (distXY < radius) {
			const edgeDx = v2.x - v1.x;
			const edgeDy = v2.y - v1.y;
			const edgeLenSq = edgeDx * edgeDx + edgeDy * edgeDy;
			let t = 0;
			if (edgeLenSq > 0) {
				t = ((closest.x - v1.x) * edgeDx + (closest.y - v1.y) * edgeDy) / edgeLenSq;
				t = Math.max(0, Math.min(1, t));
			}
			const edgeZ = v1.z + t * (v2.z - v1.z);
			// tipZ = edgeZ - r + sqrt(r² - d²)
			const z = edgeZ - radius + Math.sqrt(radius * radius - distXY * distXY);
			if (z > maxZ) maxZ = z;
		}
	}

	// Check vertices: tipZ = vertexZ - r + sqrt(r² - d²)
	for (const v of vertices) {
		const dx = v.x - px;
		const dy = v.y - py;
		const distXY = Math.sqrt(dx * dx + dy * dy);
		if (distXY < radius) {
			const z = v.z - radius + Math.sqrt(radius * radius - distXY * distXY);
			if (z > maxZ) maxZ = z;
		}
	}

	return maxZ;
}

/**
 * Drop a V-bit onto a triangle.
 * The V-bit cone surface at distance d from the axis is at tipZ + d/tan(halfAngle).
 * When the cone contacts a feature at height featureZ at distance d:
 *   tipZ + d/tan(halfAngle) = featureZ
 *   tipZ = featureZ - d/tan(halfAngle)
 */
function dropVBit(px: number, py: number, tri: Triangle, toolConfig: ToolConfig): number {
	const halfAngle = degToRad(toolConfig.angle / 2);
	const tanHalf = Math.tan(halfAngle);
	const radius = toolConfig.diameter / 2;
	const vertices = [tri.v0, tri.v1, tri.v2];

	let maxZ = -Infinity;

	// Check face: tip sits directly on the surface
	if (isPointInTriangleXY(px, py, tri)) {
		const planeZ = trianglePlaneZ(px, py, tri);
		if (planeZ !== null && planeZ > maxZ) {
			maxZ = planeZ;
		}
	}

	// Check edges: tipZ = edgeZ - d/tan(halfAngle)
	for (let i = 0; i < 3; i++) {
		const v1 = vertices[i];
		const v2 = vertices[(i + 1) % 3];

		const closest = closestPointOnSegmentXY(px, py, v1.x, v1.y, v2.x, v2.y);
		const dx = closest.x - px;
		const dy = closest.y - py;
		const distXY = Math.sqrt(dx * dx + dy * dy);

		if (distXY < radius) {
			const edgeDx = v2.x - v1.x;
			const edgeDy = v2.y - v1.y;
			const edgeLenSq = edgeDx * edgeDx + edgeDy * edgeDy;
			let t = 0;
			if (edgeLenSq > 0) {
				t = ((closest.x - v1.x) * edgeDx + (closest.y - v1.y) * edgeDy) / edgeLenSq;
				t = Math.max(0, Math.min(1, t));
			}
			const edgeZ = v1.z + t * (v2.z - v1.z);
			// tipZ = edgeZ - d / tan(halfAngle)
			const z = edgeZ - distXY / tanHalf;
			if (z > maxZ) maxZ = z;
		}
	}

	// Check vertices: tipZ = vertexZ - d/tan(halfAngle)
	for (const v of vertices) {
		const dx = v.x - px;
		const dy = v.y - py;
		const distXY = Math.sqrt(dx * dx + dy * dy);
		if (distXY < radius) {
			const z = v.z - distXY / tanHalf;
			if (z > maxZ) maxZ = z;
		}
	}

	return maxZ;
}

// --- Geometry helpers (pure math, no Three.js) ---

function trianglePlaneZ(px: number, py: number, tri: Triangle): number | null {
	const { v0, v1, v2 } = tri;
	const e1x = v1.x - v0.x, e1y = v1.y - v0.y, e1z = v1.z - v0.z;
	const e2x = v2.x - v0.x, e2y = v2.y - v0.y, e2z = v2.z - v0.z;

	// Normal = e1 x e2
	const nx = e1y * e2z - e1z * e2y;
	const ny = e1z * e2x - e1x * e2z;
	const nz = e1x * e2y - e1y * e2x;

	if (Math.abs(nz) < 1e-10) return null; // Nearly vertical triangle

	// Plane equation: n.(p - v0) = 0
	// nz * (z - v0.z) = -nx * (px - v0.x) - ny * (py - v0.y)
	return v0.z + (-nx * (px - v0.x) - ny * (py - v0.y)) / nz;
}

function triangleNormal(tri: Triangle): { x: number; y: number; z: number } | null {
	const { v0, v1, v2 } = tri;
	const e1x = v1.x - v0.x, e1y = v1.y - v0.y, e1z = v1.z - v0.z;
	const e2x = v2.x - v0.x, e2y = v2.y - v0.y, e2z = v2.z - v0.z;

	const nx = e1y * e2z - e1z * e2y;
	const ny = e1z * e2x - e1x * e2z;
	const nz = e1x * e2y - e1y * e2x;
	const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

	if (len < 1e-10) return null;
	return { x: nx / len, y: ny / len, z: nz / len };
}

export function isPointInTriangleXY(px: number, py: number, tri: Triangle): boolean {
	const { v0, v1, v2 } = tri;

	const d1 = sign(px, py, v0.x, v0.y, v1.x, v1.y);
	const d2 = sign(px, py, v1.x, v1.y, v2.x, v2.y);
	const d3 = sign(px, py, v2.x, v2.y, v0.x, v0.y);

	const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
	const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

	return !(hasNeg && hasPos);
}

function sign(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
	return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
}

function closestPointOnSegmentXY(
	px: number, py: number,
	x1: number, y1: number,
	x2: number, y2: number
): { x: number; y: number } {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const lenSq = dx * dx + dy * dy;

	if (lenSq === 0) return { x: x1, y: y1 };

	let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
	t = Math.max(0, Math.min(1, t));

	return { x: x1 + t * dx, y: y1 + t * dy };
}
