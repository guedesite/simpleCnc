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
 * Uses ramp entry: the tool descends gradually along the first cutting
 * edge instead of plunging straight down, which is gentler on tools.
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
			totalTime += rapidDist / 5000;
		}

		// Ramp entry: if the polyline has enough length, descend along
		// the first segment(s) instead of plunging straight down.
		const rampResult = createRampEntry(
			polyline.points,
			cutDepth,
			safeZ,
			plungeRate
		);

		// Plunge/ramp segment
		segments.push({
			points: rampResult.plungePoints,
			moveType: MoveType.Plunge
		});
		const plungeDist = polyline3DLength(rampResult.plungePoints);
		totalDistance += plungeDist;
		totalTime += plungeDist / plungeRate;

		// Cut path (remaining points after ramp)
		const cutPoints: Point3D[] = [];
		const startIdx = rampResult.resumeIndex;

		// Add the last ramp point as first cut point for continuity
		const lastRampPt = rampResult.plungePoints[rampResult.plungePoints.length - 1];
		cutPoints.push(lastRampPt);

		for (let i = startIdx; i < polyline.points.length; i++) {
			const pt = polyline.points[i];
			const p3d: Point3D = { x: pt.x, y: pt.y, z: -cutDepth };
			const segDist = dist3D(cutPoints[cutPoints.length - 1], p3d);
			cuttingDistance += segDist;
			totalDistance += segDist;
			totalTime += segDist / feedRate;
			cutPoints.push(p3d);
		}

		if (cutPoints.length > 1) {
			segments.push({
				points: cutPoints,
				moveType: MoveType.Cut
			});
		}

		// Retract
		const lastCutPt = cutPoints[cutPoints.length - 1];
		const retractTarget: Point3D = { x: lastCutPt.x, y: lastCutPt.y, z: safeZ };
		const retractDist = Math.abs(safeZ - lastCutPt.z);
		segments.push({
			points: [lastCutPt, retractTarget],
			moveType: MoveType.Retract
		});
		rapidDistance += retractDist;
		totalDistance += retractDist;
		totalTime += retractDist / 5000;

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

interface RampResult {
	/** Points for the plunge/ramp segment (from safeZ down to -cutDepth) */
	plungePoints: Point3D[];
	/** Index in the original polyline to resume cutting from */
	resumeIndex: number;
}

/**
 * Create a ramp entry along the first edge(s) of a polyline.
 * The tool descends gradually at a max ramp angle of ~3° (configurable).
 * Falls back to straight plunge for very short polylines.
 */
function createRampEntry(
	points: { x: number; y: number }[],
	cutDepth: number,
	safeZ: number,
	plungeRate: number
): RampResult {
	const totalDrop = safeZ + cutDepth;
	const maxRampAngleDeg = 3; // degrees - gentle ramp angle
	const maxRampAngle = (maxRampAngleDeg * Math.PI) / 180;
	const minRampXY = totalDrop / Math.tan(maxRampAngle); // horizontal distance needed

	// Calculate available horizontal distance along the polyline
	let availableXY = 0;
	let rampEndIdx = 0;

	for (let i = 1; i < points.length; i++) {
		const dx = points[i].x - points[i - 1].x;
		const dy = points[i].y - points[i - 1].y;
		availableXY += Math.sqrt(dx * dx + dy * dy);
		rampEndIdx = i;

		if (availableXY >= minRampXY) break;
	}

	// Fall back to straight plunge when:
	// - polyline too short (< 2 points)
	// - available XY too short (less than 3x the drop = steep ramp not worth it)
	// - ramp would consume all polyline points (need at least 1 left for cutting)
	const needsStraightPlunge =
		points.length < 3 ||
		availableXY < totalDrop * 3 ||
		rampEndIdx >= points.length - 1;

	if (needsStraightPlunge) {
		const fp = points[0];
		return {
			plungePoints: [
				{ x: fp.x, y: fp.y, z: safeZ },
				{ x: fp.x, y: fp.y, z: -cutDepth }
			],
			resumeIndex: 1
		};
	}

	// Build ramp points: interpolate Z from safeZ to -cutDepth
	// proportional to XY distance traveled
	const rampXY = Math.min(availableXY, minRampXY);
	const plungePoints: Point3D[] = [];

	plungePoints.push({ x: points[0].x, y: points[0].y, z: safeZ });

	let distSoFar = 0;
	for (let i = 1; i <= rampEndIdx; i++) {
		const dx = points[i].x - points[i - 1].x;
		const dy = points[i].y - points[i - 1].y;
		const segLen = Math.sqrt(dx * dx + dy * dy);
		distSoFar += segLen;

		const t = Math.min(distSoFar / rampXY, 1.0);
		const z = safeZ - t * totalDrop;

		plungePoints.push({ x: points[i].x, y: points[i].y, z });

		if (t >= 1.0) break;
	}

	// Ensure we reach full depth
	const lastPt = plungePoints[plungePoints.length - 1];
	if (Math.abs(lastPt.z - (-cutDepth)) > 0.001) {
		lastPt.z = -cutDepth;
	}

	return {
		plungePoints,
		resumeIndex: rampEndIdx + 1
	};
}

function dist3D(a: Point3D, b: Point3D): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const dz = b.z - a.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function polyline3DLength(points: Point3D[]): number {
	let len = 0;
	for (let i = 1; i < points.length; i++) {
		len += dist3D(points[i - 1], points[i]);
	}
	return len;
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
