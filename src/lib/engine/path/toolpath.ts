import type { Point3D } from '$lib/types/geometry.js';

export enum MoveType {
	Rapid = 'rapid',
	Cut = 'cut',
	Plunge = 'plunge',
	Retract = 'retract'
}

export interface ToolPathSegment {
	points: Point3D[];
	moveType: MoveType;
}

export interface ToolPath {
	segments: ToolPathSegment[];
	stats: ToolPathStats;
}

export interface ToolPathStats {
	totalDistance: number;
	cuttingDistance: number;
	rapidDistance: number;
	estimatedTime: number;
}

/**
 * Convert 2D polylines to a 3D toolpath with safe Z movements.
 */
export function polylinesToToolPath(
	polylines: { points: { x: number; y: number }[] }[],
	cutDepth: number,
	safeZ: number,
	feedRate: number,
	plungeRate: number
): ToolPath {
	const segments: ToolPathSegment[] = [];
	let totalDistance = 0;
	let cuttingDistance = 0;
	let rapidDistance = 0;
	let totalTime = 0;

	let lastPos: Point3D = { x: 0, y: 0, z: safeZ };

	for (const polyline of polylines) {
		if (polyline.points.length === 0) continue;

		const firstPt = polyline.points[0];

		// Rapid to above first point
		const aboveFirst: Point3D = { x: firstPt.x, y: firstPt.y, z: safeZ };
		const rapidDist = dist3D(lastPos, aboveFirst);
		if (rapidDist > 0.001) {
			segments.push({
				points: [lastPos, aboveFirst],
				moveType: MoveType.Rapid
			});
			rapidDistance += rapidDist;
			totalDistance += rapidDist;
			// Approximate rapid at 5000 mm/min
			totalTime += rapidDist / 5000;
		}

		// Plunge
		const plungeTarget: Point3D = { x: firstPt.x, y: firstPt.y, z: -cutDepth };
		const plungeDist = Math.abs(safeZ + cutDepth);
		segments.push({
			points: [aboveFirst, plungeTarget],
			moveType: MoveType.Plunge
		});
		totalDistance += plungeDist;
		totalTime += plungeDist / plungeRate;

		// Cut path
		const cutPoints: Point3D[] = [plungeTarget];
		for (let i = 1; i < polyline.points.length; i++) {
			const pt = polyline.points[i];
			const p3d: Point3D = { x: pt.x, y: pt.y, z: -cutDepth };
			const segDist = dist3D(cutPoints[cutPoints.length - 1], p3d);
			cuttingDistance += segDist;
			totalDistance += segDist;
			totalTime += segDist / feedRate;
			cutPoints.push(p3d);
		}
		segments.push({
			points: cutPoints,
			moveType: MoveType.Cut
		});

		// Retract
		const lastCutPt = cutPoints[cutPoints.length - 1];
		const retractTarget: Point3D = { x: lastCutPt.x, y: lastCutPt.y, z: safeZ };
		segments.push({
			points: [lastCutPt, retractTarget],
			moveType: MoveType.Retract
		});
		rapidDistance += plungeDist;
		totalDistance += plungeDist;
		totalTime += plungeDist / 5000;

		lastPos = retractTarget;
	}

	return {
		segments,
		stats: {
			totalDistance,
			cuttingDistance,
			rapidDistance,
			estimatedTime: totalTime
		}
	};
}

function dist3D(a: Point3D, b: Point3D): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const dz = b.z - a.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Flatten a ToolPath to a single Float32Array for worker transfer.
 * Format: [x, y, z, moveType (0=rapid, 1=cut, 2=plunge, 3=retract), ...]
 */
export function toolPathToFloat32Array(toolPath: ToolPath): Float32Array {
	let totalPoints = 0;
	for (const seg of toolPath.segments) {
		totalPoints += seg.points.length;
	}

	const arr = new Float32Array(totalPoints * 4);
	let idx = 0;

	const moveTypeMap: Record<MoveType, number> = {
		[MoveType.Rapid]: 0,
		[MoveType.Cut]: 1,
		[MoveType.Plunge]: 2,
		[MoveType.Retract]: 3
	};

	for (const seg of toolPath.segments) {
		const mt = moveTypeMap[seg.moveType];
		for (const pt of seg.points) {
			arr[idx++] = pt.x;
			arr[idx++] = pt.y;
			arr[idx++] = pt.z;
			arr[idx++] = mt;
		}
	}

	return arr;
}
