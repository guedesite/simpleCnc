import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';
import type { Triangle } from '$lib/types/stl.js';
import type { BoundingBox3D } from '$lib/types/geometry.js';

/**
 * Load an STL file from an ArrayBuffer and return the Three.js BufferGeometry.
 */
export function loadStlFromBuffer(buffer: ArrayBuffer): THREE.BufferGeometry {
	const loader = new STLLoader();
	const geometry = loader.parse(buffer);
	geometry.computeVertexNormals();
	return geometry;
}

/**
 * Extract triangles from a BufferGeometry as a flat Float32Array.
 * Returns vertices as [x0,y0,z0, x1,y1,z1, x2,y2,z2, ...] (9 floats per triangle)
 */
export function geometryToVertices(geometry: THREE.BufferGeometry): Float32Array {
	const posAttr = geometry.getAttribute('position');
	const index = geometry.index;

	if (index) {
		const triangleCount = index.count / 3;
		const result = new Float32Array(triangleCount * 9);
		for (let i = 0; i < triangleCount; i++) {
			for (let v = 0; v < 3; v++) {
				const idx = index.getX(i * 3 + v);
				result[i * 9 + v * 3 + 0] = posAttr.getX(idx);
				result[i * 9 + v * 3 + 1] = posAttr.getY(idx);
				result[i * 9 + v * 3 + 2] = posAttr.getZ(idx);
			}
		}
		return result;
	}

	// Non-indexed geometry
	return new Float32Array(posAttr.array);
}

/**
 * Convert flat vertex array to Triangle array (for worker use).
 */
export function verticesToTriangles(vertices: Float32Array): Triangle[] {
	const triangles: Triangle[] = [];
	for (let i = 0; i + 8 < vertices.length; i += 9) {
		triangles.push({
			v0: { x: vertices[i], y: vertices[i + 1], z: vertices[i + 2] },
			v1: { x: vertices[i + 3], y: vertices[i + 4], z: vertices[i + 5] },
			v2: { x: vertices[i + 6], y: vertices[i + 7], z: vertices[i + 8] }
		});
	}
	return triangles;
}

/**
 * Compute 3D bounding box from flat vertex array.
 */
export function computeVerticesBounds(vertices: Float32Array): BoundingBox3D {
	let minX = Infinity, minY = Infinity, minZ = Infinity;
	let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

	for (let i = 0; i < vertices.length; i += 3) {
		const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (z < minZ) minZ = z;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
		if (z > maxZ) maxZ = z;
	}

	return { minX, minY, minZ, maxX, maxY, maxZ };
}
