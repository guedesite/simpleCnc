import { describe, it, expect } from 'vitest';
import {
	distance2D,
	distance3D,
	lerp,
	lerp2D,
	lerp3D,
	clamp,
	degToRad,
	radToDeg,
	polylineLength,
	polyline3DLength,
	applyTransform,
	multiplyTransforms,
	parseTransform,
	IDENTITY_MATRIX
} from '$lib/utils/math.js';

describe('distance2D', () => {
	it('should return 0 for same point', () => {
		expect(distance2D({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
	});

	it('should compute horizontal distance', () => {
		expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
	});

	it('should compute diagonal distance', () => {
		expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
	});

	it('should handle negative coordinates', () => {
		expect(distance2D({ x: -1, y: -1 }, { x: 2, y: 3 })).toBe(5);
	});
});

describe('distance3D', () => {
	it('should return 0 for same point', () => {
		expect(distance3D({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(0);
	});

	it('should compute 3D distance', () => {
		expect(distance3D({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 2 })).toBe(3);
	});
});

describe('lerp', () => {
	it('should return start at t=0', () => {
		expect(lerp(10, 20, 0)).toBe(10);
	});

	it('should return end at t=1', () => {
		expect(lerp(10, 20, 1)).toBe(20);
	});

	it('should interpolate at t=0.5', () => {
		expect(lerp(0, 10, 0.5)).toBe(5);
	});
});

describe('lerp2D', () => {
	it('should interpolate 2D points', () => {
		const result = lerp2D({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5);
		expect(result.x).toBe(5);
		expect(result.y).toBe(10);
	});
});

describe('lerp3D', () => {
	it('should interpolate 3D points', () => {
		const result = lerp3D({ x: 0, y: 0, z: 0 }, { x: 10, y: 20, z: 30 }, 0.5);
		expect(result.x).toBe(5);
		expect(result.y).toBe(10);
		expect(result.z).toBe(15);
	});
});

describe('clamp', () => {
	it('should clamp below min', () => {
		expect(clamp(-5, 0, 10)).toBe(0);
	});

	it('should clamp above max', () => {
		expect(clamp(15, 0, 10)).toBe(10);
	});

	it('should not change value within range', () => {
		expect(clamp(5, 0, 10)).toBe(5);
	});
});

describe('degToRad / radToDeg', () => {
	it('should convert 180 degrees to PI', () => {
		expect(degToRad(180)).toBeCloseTo(Math.PI);
	});

	it('should convert PI to 180 degrees', () => {
		expect(radToDeg(Math.PI)).toBeCloseTo(180);
	});

	it('should round-trip', () => {
		expect(radToDeg(degToRad(45))).toBeCloseTo(45);
	});
});

describe('polylineLength', () => {
	it('should return 0 for empty', () => {
		expect(polylineLength([])).toBe(0);
	});

	it('should return 0 for single point', () => {
		expect(polylineLength([{ x: 0, y: 0 }])).toBe(0);
	});

	it('should compute length of a line', () => {
		expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5);
	});

	it('should compute total length of multiple segments', () => {
		const points = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }];
		expect(polylineLength(points)).toBe(7);
	});
});

describe('polyline3DLength', () => {
	it('should compute 3D polyline length', () => {
		const points = [
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 2, z: 2 }
		];
		expect(polyline3DLength(points)).toBe(3);
	});
});

describe('applyTransform', () => {
	it('should return same point with identity matrix', () => {
		const pt = applyTransform({ x: 5, y: 10 }, IDENTITY_MATRIX);
		expect(pt.x).toBe(5);
		expect(pt.y).toBe(10);
	});

	it('should translate', () => {
		const pt = applyTransform({ x: 0, y: 0 }, [1, 0, 0, 1, 10, 20]);
		expect(pt.x).toBe(10);
		expect(pt.y).toBe(20);
	});

	it('should scale', () => {
		const pt = applyTransform({ x: 5, y: 10 }, [2, 0, 0, 3, 0, 0]);
		expect(pt.x).toBe(10);
		expect(pt.y).toBe(30);
	});
});

describe('multiplyTransforms', () => {
	it('should return identity for two identities', () => {
		const result = multiplyTransforms(IDENTITY_MATRIX, IDENTITY_MATRIX);
		expect(result).toEqual(IDENTITY_MATRIX);
	});

	it('should compose translate + scale', () => {
		const translate = [1, 0, 0, 1, 10, 20];
		const scale = [2, 0, 0, 2, 0, 0];
		const combined = multiplyTransforms(translate, scale);
		const pt = applyTransform({ x: 5, y: 5 }, combined);
		expect(pt.x).toBe(20); // 5*2 + 10
		expect(pt.y).toBe(30); // 5*2 + 20
	});
});

describe('parseTransform', () => {
	it('should parse translate', () => {
		const m = parseTransform('translate(10, 20)');
		const pt = applyTransform({ x: 0, y: 0 }, m);
		expect(pt.x).toBeCloseTo(10);
		expect(pt.y).toBeCloseTo(20);
	});

	it('should parse scale', () => {
		const m = parseTransform('scale(2)');
		const pt = applyTransform({ x: 5, y: 10 }, m);
		expect(pt.x).toBeCloseTo(10);
		expect(pt.y).toBeCloseTo(20);
	});

	it('should parse rotate', () => {
		const m = parseTransform('rotate(90)');
		const pt = applyTransform({ x: 1, y: 0 }, m);
		expect(pt.x).toBeCloseTo(0);
		expect(pt.y).toBeCloseTo(1);
	});

	it('should parse multiple transforms', () => {
		const m = parseTransform('translate(10, 0) scale(2)');
		const pt = applyTransform({ x: 5, y: 0 }, m);
		expect(pt.x).toBeCloseTo(20); // 5*2 + 10
	});

	it('should return identity for empty string', () => {
		const m = parseTransform('');
		expect(m).toEqual(IDENTITY_MATRIX);
	});
});
