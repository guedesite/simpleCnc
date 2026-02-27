import type { Point3D } from '$lib/types/geometry.js';

export interface ArcSegment {
	type: 'arc';
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	centerI: number; // relative to start
	centerJ: number; // relative to start
	z: number;
	clockwise: boolean;
}

export interface LinearSegment {
	type: 'linear';
	x: number;
	y: number;
	z: number;
}

export type OptimizedSegment = ArcSegment | LinearSegment;

/**
 * Fit a circle through three 2D points. Returns center and radius,
 * or null if points are collinear.
 */
export function fitCircle(
	x1: number, y1: number,
	x2: number, y2: number,
	x3: number, y3: number
): { cx: number; cy: number; r: number } | null {
	const ax = x1, ay = y1;
	const bx = x2, by = y2;
	const cx = x3, cy = y3;

	const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
	if (Math.abs(d) < 1e-10) return null; // collinear

	const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
	const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

	const r = Math.sqrt((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy));
	return { cx: ux, cy: uy, r };
}

/**
 * Determine if the path from p1→p2→p3 goes clockwise.
 * Uses the cross product of (p2-p1) x (p3-p1).
 * Negative cross = clockwise in standard math coordinates.
 */
function isClockwise(
	x1: number, y1: number,
	x2: number, y2: number,
	x3: number, y3: number
): boolean {
	const cross = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
	return cross < 0;
}

/**
 * Check if a point lies on the arc from start to end going through mid,
 * centered at (cx, cy) with given radius, within tolerance.
 */
function pointOnArc(
	px: number, py: number,
	cx: number, cy: number,
	r: number,
	tolerance: number
): boolean {
	const dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
	return Math.abs(dist - r) <= tolerance;
}

/**
 * Detect arcs in a sequence of cutting points at the same Z depth.
 * Replaces consecutive linear segments forming arcs with G2/G3 arcs.
 *
 * @param points - consecutive cut points (all at same Z is ideal)
 * @param tolerance - max deviation from arc in mm (default 0.01)
 * @param minArcPoints - minimum points to form an arc (default 4)
 * @param maxRadius - maximum arc radius to accept (prevents huge near-linear arcs)
 * @returns optimized segments mixing arcs and lines
 */
export function detectArcs(
	points: Point3D[],
	tolerance: number = 0.01,
	minArcPoints: number = 4,
	maxRadius: number = 1000
): OptimizedSegment[] {
	if (points.length < 2) {
		return points.map((p) => ({ type: 'linear' as const, x: p.x, y: p.y, z: p.z }));
	}

	const result: OptimizedSegment[] = [];
	let i = 0;

	while (i < points.length) {
		if (i + minArcPoints - 1 >= points.length) {
			// Not enough points left for arc detection
			for (; i < points.length; i++) {
				result.push({ type: 'linear', x: points[i].x, y: points[i].y, z: points[i].z });
			}
			break;
		}

		// Try to find an arc starting at i
		// Use points i, i+mid, i+2 to fit initial circle
		const mid = Math.min(i + Math.floor(minArcPoints / 2), points.length - 2);
		const end = Math.min(i + minArcPoints - 1, points.length - 1);

		const circle = fitCircle(
			points[i].x, points[i].y,
			points[mid].x, points[mid].y,
			points[end].x, points[end].y
		);

		if (!circle || circle.r > maxRadius || circle.r < tolerance) {
			// No valid arc - emit as linear and advance
			result.push({ type: 'linear', x: points[i].x, y: points[i].y, z: points[i].z });
			i++;
			continue;
		}

		// Check how far the arc extends - all points must be at same Z
		let arcEnd = end;
		const z0 = points[i].z;

		// Verify initial points are all at same Z
		let sameZ = true;
		for (let j = i; j <= end; j++) {
			if (Math.abs(points[j].z - z0) > tolerance) {
				sameZ = false;
				break;
			}
		}

		if (!sameZ) {
			// Z varies - cannot form an arc
			result.push({ type: 'linear', x: points[i].x, y: points[i].y, z: points[i].z });
			i++;
			continue;
		}

		if (sameZ) {
			// Extend arc as far as possible
			for (let j = end + 1; j < points.length; j++) {
				if (Math.abs(points[j].z - z0) > tolerance) break;
				if (!pointOnArc(points[j].x, points[j].y, circle.cx, circle.cy, circle.r, tolerance)) break;
				arcEnd = j;
			}
		}

		const arcPointCount = arcEnd - i + 1;
		if (arcPointCount < minArcPoints) {
			// Too few points - emit as linear
			result.push({ type: 'linear', x: points[i].x, y: points[i].y, z: points[i].z });
			i++;
			continue;
		}

		// Verify ALL intermediate points are on the arc
		let allOnArc = true;
		for (let j = i + 1; j < arcEnd; j++) {
			if (!pointOnArc(points[j].x, points[j].y, circle.cx, circle.cy, circle.r, tolerance)) {
				allOnArc = false;
				break;
			}
		}

		if (!allOnArc) {
			result.push({ type: 'linear', x: points[i].x, y: points[i].y, z: points[i].z });
			i++;
			continue;
		}

		// Determine direction (CW vs CCW)
		const cw = isClockwise(
			points[i].x, points[i].y,
			points[i + 1].x, points[i + 1].y,
			points[arcEnd].x, points[arcEnd].y
		);

		// Emit arc segment
		const startPt = points[i];
		const endPt = points[arcEnd];

		result.push({
			type: 'arc',
			startX: startPt.x,
			startY: startPt.y,
			endX: endPt.x,
			endY: endPt.y,
			centerI: circle.cx - startPt.x,
			centerJ: circle.cy - startPt.y,
			z: z0,
			clockwise: cw
		});

		i = arcEnd + 1;
	}

	return result;
}

/**
 * Simplify a sequence of 3D points by removing collinear points.
 * Uses the perpendicular distance test.
 */
export function simplifyCollinear(points: Point3D[], tolerance: number = 0.001): Point3D[] {
	if (points.length <= 2) return points;

	const result: Point3D[] = [points[0]];

	for (let i = 1; i < points.length - 1; i++) {
		const prev = result[result.length - 1];
		const curr = points[i];
		const next = points[i + 1];

		// Check if curr is collinear with prev-next
		const dx = next.x - prev.x;
		const dy = next.y - prev.y;
		const dz = next.z - prev.z;
		const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

		if (len < 1e-10) {
			// prev and next are the same point - skip curr
			continue;
		}

		// Vector from prev to curr
		const px = curr.x - prev.x;
		const py = curr.y - prev.y;
		const pz = curr.z - prev.z;

		// Cross product magnitude = perpendicular distance * len
		const cx = py * dz - pz * dy;
		const cy = pz * dx - px * dz;
		const cz = px * dy - py * dx;
		const crossLen = Math.sqrt(cx * cx + cy * cy + cz * cz);
		const perpDist = crossLen / len;

		if (perpDist > tolerance) {
			result.push(curr);
		}
	}

	result.push(points[points.length - 1]);
	return result;
}
