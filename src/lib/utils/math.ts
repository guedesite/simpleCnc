import type { Point2D, Point3D } from '$lib/types/geometry.js';

export function distance2D(a: Point2D, b: Point2D): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	return Math.sqrt(dx * dx + dy * dy);
}

export function distance3D(a: Point3D, b: Point3D): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const dz = b.z - a.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export function lerp2D(a: Point2D, b: Point2D, t: number): Point2D {
	return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function lerp3D(a: Point3D, b: Point3D, t: number): Point3D {
	return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function degToRad(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number): number {
	return (radians * 180) / Math.PI;
}

/** Total polyline length */
export function polylineLength(points: Point2D[]): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		total += distance2D(points[i - 1], points[i]);
	}
	return total;
}

/** Total 3D polyline length */
export function polyline3DLength(points: Point3D[]): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		total += distance3D(points[i - 1], points[i]);
	}
	return total;
}

/** Apply a 2D affine transform matrix [a,b,c,d,e,f] to a point */
export function applyTransform(point: Point2D, matrix: number[]): Point2D {
	const [a, b, c, d, e, f] = matrix;
	return {
		x: a * point.x + c * point.y + e,
		y: b * point.x + d * point.y + f
	};
}

/** Multiply two 2D affine transform matrices */
export function multiplyTransforms(m1: number[], m2: number[]): number[] {
	const [a1, b1, c1, d1, e1, f1] = m1;
	const [a2, b2, c2, d2, e2, f2] = m2;
	return [
		a1 * a2 + c1 * b2,
		b1 * a2 + d1 * b2,
		a1 * c2 + c1 * d2,
		b1 * c2 + d1 * d2,
		a1 * e2 + c1 * f2 + e1,
		b1 * e2 + d1 * f2 + f1
	];
}

/** Identity transform matrix */
export const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

/** Parse an SVG transform attribute into a matrix [a,b,c,d,e,f] */
export function parseTransform(transform: string): number[] {
	let result = [...IDENTITY_MATRIX];
	const regex = /(translate|scale|rotate|matrix|skewX|skewY)\s*\(([^)]+)\)/g;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(transform)) !== null) {
		const type = match[1];
		const values = match[2].split(/[\s,]+/).map(Number);
		let m: number[];

		switch (type) {
			case 'translate': {
				const tx = values[0] || 0;
				const ty = values[1] || 0;
				m = [1, 0, 0, 1, tx, ty];
				break;
			}
			case 'scale': {
				const sx = values[0] || 1;
				const sy = values[1] ?? sx;
				m = [sx, 0, 0, sy, 0, 0];
				break;
			}
			case 'rotate': {
				const angle = degToRad(values[0] || 0);
				const cx = values[1] || 0;
				const cy = values[2] || 0;
				const cos = Math.cos(angle);
				const sin = Math.sin(angle);
				if (cx !== 0 || cy !== 0) {
					m = multiplyTransforms(
						[1, 0, 0, 1, cx, cy],
						multiplyTransforms([cos, sin, -sin, cos, 0, 0], [1, 0, 0, 1, -cx, -cy])
					);
				} else {
					m = [cos, sin, -sin, cos, 0, 0];
				}
				break;
			}
			case 'matrix': {
				m = values.slice(0, 6);
				break;
			}
			case 'skewX': {
				const angle = degToRad(values[0] || 0);
				m = [1, 0, Math.tan(angle), 1, 0, 0];
				break;
			}
			case 'skewY': {
				const angle = degToRad(values[0] || 0);
				m = [1, Math.tan(angle), 0, 1, 0, 0];
				break;
			}
			default:
				m = [...IDENTITY_MATRIX];
		}
		result = multiplyTransforms(result, m);
	}

	return result;
}
