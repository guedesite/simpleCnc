import type { Point2D, Polyline } from '$lib/types/geometry.js';
import type { ParsedSvg, ParsedSvgElement } from '$lib/types/svg.js';
import { applyTransform, parseTransform, multiplyTransforms, IDENTITY_MATRIX } from '$lib/utils/math.js';

export function parseSvg(svgString: string): ParsedSvg {
	const parser = new DOMParser();
	const doc = parser.parseFromString(svgString, 'image/svg+xml');
	const svgEl = doc.querySelector('svg');

	if (!svgEl) {
		throw new Error('No SVG element found');
	}

	const width = parseFloat(svgEl.getAttribute('width') || '0');
	const height = parseFloat(svgEl.getAttribute('height') || '0');

	let viewBox: ParsedSvg['viewBox'] = null;
	const vbAttr = svgEl.getAttribute('viewBox');
	if (vbAttr) {
		const parts = vbAttr.split(/[\s,]+/).map(Number);
		if (parts.length === 4) {
			viewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
		}
	}

	const elements: ParsedSvgElement[] = [];
	extractElements(svgEl, IDENTITY_MATRIX, elements);

	return { width, height, viewBox, elements };
}

function extractElements(parent: Element, parentMatrix: number[], elements: ParsedSvgElement[]): void {
	for (const child of Array.from(parent.children)) {
		const tag = child.tagName.toLowerCase();
		const transformAttr = child.getAttribute('transform');
		const currentMatrix = transformAttr
			? multiplyTransforms(parentMatrix, parseTransform(transformAttr))
			: [...parentMatrix];

		if (tag === 'g') {
			extractElements(child, currentMatrix, elements);
			continue;
		}

		const polylines = elementToPolylines(child, tag, currentMatrix);
		if (polylines.length > 0) {
			elements.push({
				type: tag,
				polylines,
				id: child.getAttribute('id') || undefined
			});
		}
	}
}

function elementToPolylines(el: Element, tag: string, matrix: number[]): Polyline[] {
	switch (tag) {
		case 'rect':
			return parseRect(el, matrix);
		case 'circle':
			return parseCircle(el, matrix);
		case 'ellipse':
			return parseEllipse(el, matrix);
		case 'line':
			return parseLine(el, matrix);
		case 'polyline':
			return parsePolyline(el, matrix, false);
		case 'polygon':
			return parsePolyline(el, matrix, true);
		case 'path':
			return parsePath(el, matrix);
		default:
			return [];
	}
}

function parseRect(el: Element, matrix: number[]): Polyline[] {
	const x = parseFloat(el.getAttribute('x') || '0');
	const y = parseFloat(el.getAttribute('y') || '0');
	const w = parseFloat(el.getAttribute('width') || '0');
	const h = parseFloat(el.getAttribute('height') || '0');

	if (w <= 0 || h <= 0) return [];

	const corners: Point2D[] = [
		{ x, y },
		{ x: x + w, y },
		{ x: x + w, y: y + h },
		{ x, y: y + h },
		{ x, y } // close
	];

	return [{ points: corners.map((p) => applyTransform(p, matrix)), closed: true }];
}

function parseCircle(el: Element, matrix: number[]): Polyline[] {
	const cx = parseFloat(el.getAttribute('cx') || '0');
	const cy = parseFloat(el.getAttribute('cy') || '0');
	const r = parseFloat(el.getAttribute('r') || '0');

	if (r <= 0) return [];

	return [ellipseToPolyline(cx, cy, r, r, matrix)];
}

function parseEllipse(el: Element, matrix: number[]): Polyline[] {
	const cx = parseFloat(el.getAttribute('cx') || '0');
	const cy = parseFloat(el.getAttribute('cy') || '0');
	const rx = parseFloat(el.getAttribute('rx') || '0');
	const ry = parseFloat(el.getAttribute('ry') || '0');

	if (rx <= 0 || ry <= 0) return [];

	return [ellipseToPolyline(cx, cy, rx, ry, matrix)];
}

function ellipseToPolyline(cx: number, cy: number, rx: number, ry: number, matrix: number[]): Polyline {
	const segments = Math.max(32, Math.ceil(Math.max(rx, ry) * 4));
	const points: Point2D[] = [];

	for (let i = 0; i <= segments; i++) {
		const angle = (2 * Math.PI * i) / segments;
		const p: Point2D = {
			x: cx + rx * Math.cos(angle),
			y: cy + ry * Math.sin(angle)
		};
		points.push(applyTransform(p, matrix));
	}

	return { points, closed: true };
}

function parseLine(el: Element, matrix: number[]): Polyline[] {
	const x1 = parseFloat(el.getAttribute('x1') || '0');
	const y1 = parseFloat(el.getAttribute('y1') || '0');
	const x2 = parseFloat(el.getAttribute('x2') || '0');
	const y2 = parseFloat(el.getAttribute('y2') || '0');

	return [{
		points: [
			applyTransform({ x: x1, y: y1 }, matrix),
			applyTransform({ x: x2, y: y2 }, matrix)
		],
		closed: false
	}];
}

function parsePolyline(el: Element, matrix: number[], closed: boolean): Polyline[] {
	const pointsAttr = el.getAttribute('points') || '';
	const numbers = pointsAttr.trim().split(/[\s,]+/).map(Number);
	const points: Point2D[] = [];

	for (let i = 0; i + 1 < numbers.length; i += 2) {
		points.push(applyTransform({ x: numbers[i], y: numbers[i + 1] }, matrix));
	}

	if (closed && points.length > 0) {
		points.push({ ...points[0] });
	}

	return points.length >= 2 ? [{ points, closed }] : [];
}

function parsePath(el: Element, matrix: number[]): Polyline[] {
	const d = el.getAttribute('d') || '';
	return parsePathData(d, matrix);
}

export function parsePathData(d: string, matrix: number[] = IDENTITY_MATRIX): Polyline[] {
	const polylines: Polyline[] = [];
	let currentPoints: Point2D[] = [];
	let currentX = 0;
	let currentY = 0;
	let startX = 0;
	let startY = 0;
	let lastControlX = 0;
	let lastControlY = 0;
	let lastCommand = '';

	const tokens = tokenizePathData(d);
	let i = 0;

	function consumeNumber(): number {
		if (i >= tokens.length) return 0;
		return parseFloat(tokens[i++]);
	}

	function addPoint(x: number, y: number) {
		currentPoints.push(applyTransform({ x, y }, matrix));
		currentX = x;
		currentY = y;
	}

	function finishPolyline(closed: boolean) {
		if (currentPoints.length >= 2) {
			polylines.push({ points: currentPoints, closed });
		}
		currentPoints = [];
	}

	while (i < tokens.length) {
		const token = tokens[i];

		if (/^[A-Za-z]$/.test(token)) {
			i++;
			const cmd = token;

			switch (cmd) {
				case 'M': {
					if (currentPoints.length > 0) finishPolyline(false);
					const x = consumeNumber();
					const y = consumeNumber();
					startX = x;
					startY = y;
					addPoint(x, y);
					lastCommand = 'M';
					// Implicit lineto after M
					while (i < tokens.length && !isCommand(tokens[i])) {
						const lx = consumeNumber();
						const ly = consumeNumber();
						addPoint(lx, ly);
						lastCommand = 'L';
					}
					break;
				}
				case 'm': {
					if (currentPoints.length > 0) finishPolyline(false);
					const dx = consumeNumber();
					const dy = consumeNumber();
					startX = currentX + dx;
					startY = currentY + dy;
					addPoint(startX, startY);
					lastCommand = 'm';
					while (i < tokens.length && !isCommand(tokens[i])) {
						const ldx = consumeNumber();
						const ldy = consumeNumber();
						addPoint(currentX + ldx, currentY + ldy);
						lastCommand = 'l';
					}
					break;
				}
				case 'L': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						addPoint(consumeNumber(), consumeNumber());
					}
					lastCommand = 'L';
					break;
				}
				case 'l': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						const dx = consumeNumber();
						const dy = consumeNumber();
						addPoint(currentX + dx, currentY + dy);
					}
					lastCommand = 'l';
					break;
				}
				case 'H': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						addPoint(consumeNumber(), currentY);
					}
					lastCommand = 'H';
					break;
				}
				case 'h': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						addPoint(currentX + consumeNumber(), currentY);
					}
					lastCommand = 'h';
					break;
				}
				case 'V': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						addPoint(currentX, consumeNumber());
					}
					lastCommand = 'V';
					break;
				}
				case 'v': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						addPoint(currentX, currentY + consumeNumber());
					}
					lastCommand = 'v';
					break;
				}
				case 'C': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						const x1 = consumeNumber(), y1 = consumeNumber();
						const x2 = consumeNumber(), y2 = consumeNumber();
						const x = consumeNumber(), y = consumeNumber();
						cubicBezierPoints(currentX, currentY, x1, y1, x2, y2, x, y, matrix, currentPoints);
						lastControlX = x2;
						lastControlY = y2;
						currentX = x;
						currentY = y;
					}
					lastCommand = 'C';
					break;
				}
				case 'c': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						const dx1 = consumeNumber(), dy1 = consumeNumber();
						const dx2 = consumeNumber(), dy2 = consumeNumber();
						const dx = consumeNumber(), dy = consumeNumber();
						const x1 = currentX + dx1, y1 = currentY + dy1;
						const x2 = currentX + dx2, y2 = currentY + dy2;
						const x = currentX + dx, y = currentY + dy;
						cubicBezierPoints(currentX, currentY, x1, y1, x2, y2, x, y, matrix, currentPoints);
						lastControlX = x2;
						lastControlY = y2;
						currentX = x;
						currentY = y;
					}
					lastCommand = 'c';
					break;
				}
				case 'S': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						let x1: number, y1: number;
						if (lastCommand === 'C' || lastCommand === 'c' || lastCommand === 'S' || lastCommand === 's') {
							x1 = 2 * currentX - lastControlX;
							y1 = 2 * currentY - lastControlY;
						} else {
							x1 = currentX;
							y1 = currentY;
						}
						const x2 = consumeNumber(), y2 = consumeNumber();
						const x = consumeNumber(), y = consumeNumber();
						cubicBezierPoints(currentX, currentY, x1, y1, x2, y2, x, y, matrix, currentPoints);
						lastControlX = x2;
						lastControlY = y2;
						currentX = x;
						currentY = y;
						lastCommand = 'S';
					}
					break;
				}
				case 's': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						let x1: number, y1: number;
						if (lastCommand === 'C' || lastCommand === 'c' || lastCommand === 'S' || lastCommand === 's') {
							x1 = 2 * currentX - lastControlX;
							y1 = 2 * currentY - lastControlY;
						} else {
							x1 = currentX;
							y1 = currentY;
						}
						const dx2 = consumeNumber(), dy2 = consumeNumber();
						const dx = consumeNumber(), dy = consumeNumber();
						const x2 = currentX + dx2, y2 = currentY + dy2;
						const x = currentX + dx, y = currentY + dy;
						cubicBezierPoints(currentX, currentY, x1, y1, x2, y2, x, y, matrix, currentPoints);
						lastControlX = x2;
						lastControlY = y2;
						currentX = x;
						currentY = y;
						lastCommand = 's';
					}
					break;
				}
				case 'Q': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						const qx1 = consumeNumber(), qy1 = consumeNumber();
						const qx = consumeNumber(), qy = consumeNumber();
						quadBezierPoints(currentX, currentY, qx1, qy1, qx, qy, matrix, currentPoints);
						lastControlX = qx1;
						lastControlY = qy1;
						currentX = qx;
						currentY = qy;
					}
					lastCommand = 'Q';
					break;
				}
				case 'q': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						const dqx1 = consumeNumber(), dqy1 = consumeNumber();
						const dqx = consumeNumber(), dqy = consumeNumber();
						const qx1 = currentX + dqx1, qy1 = currentY + dqy1;
						const qx = currentX + dqx, qy = currentY + dqy;
						quadBezierPoints(currentX, currentY, qx1, qy1, qx, qy, matrix, currentPoints);
						lastControlX = qx1;
						lastControlY = qy1;
						currentX = qx;
						currentY = qy;
					}
					lastCommand = 'q';
					break;
				}
				case 'T': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						let qx1: number, qy1: number;
						if (lastCommand === 'Q' || lastCommand === 'q' || lastCommand === 'T' || lastCommand === 't') {
							qx1 = 2 * currentX - lastControlX;
							qy1 = 2 * currentY - lastControlY;
						} else {
							qx1 = currentX;
							qy1 = currentY;
						}
						const qx = consumeNumber(), qy = consumeNumber();
						quadBezierPoints(currentX, currentY, qx1, qy1, qx, qy, matrix, currentPoints);
						lastControlX = qx1;
						lastControlY = qy1;
						currentX = qx;
						currentY = qy;
						lastCommand = 'T';
					}
					break;
				}
				case 't': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						let qx1: number, qy1: number;
						if (lastCommand === 'Q' || lastCommand === 'q' || lastCommand === 'T' || lastCommand === 't') {
							qx1 = 2 * currentX - lastControlX;
							qy1 = 2 * currentY - lastControlY;
						} else {
							qx1 = currentX;
							qy1 = currentY;
						}
						const dqx = consumeNumber(), dqy = consumeNumber();
						const qx = currentX + dqx, qy = currentY + dqy;
						quadBezierPoints(currentX, currentY, qx1, qy1, qx, qy, matrix, currentPoints);
						lastControlX = qx1;
						lastControlY = qy1;
						currentX = qx;
						currentY = qy;
						lastCommand = 't';
					}
					break;
				}
				case 'A': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						const rx = consumeNumber(), ry = consumeNumber();
						const rotation = consumeNumber();
						const largeArc = consumeNumber();
						const sweep = consumeNumber();
						const x = consumeNumber(), y = consumeNumber();
						arcToPoints(currentX, currentY, rx, ry, rotation, !!largeArc, !!sweep, x, y, matrix, currentPoints);
						currentX = x;
						currentY = y;
					}
					lastCommand = 'A';
					break;
				}
				case 'a': {
					while (i < tokens.length && !isCommand(tokens[i])) {
						const rx = consumeNumber(), ry = consumeNumber();
						const rotation = consumeNumber();
						const largeArc = consumeNumber();
						const sweep = consumeNumber();
						const dx = consumeNumber(), dy = consumeNumber();
						const x = currentX + dx, y = currentY + dy;
						arcToPoints(currentX, currentY, rx, ry, rotation, !!largeArc, !!sweep, x, y, matrix, currentPoints);
						currentX = x;
						currentY = y;
					}
					lastCommand = 'a';
					break;
				}
				case 'Z':
				case 'z': {
					if (currentPoints.length > 0) {
						addPoint(startX, startY);
						finishPolyline(true);
					}
					currentX = startX;
					currentY = startY;
					lastCommand = 'Z';
					break;
				}
			}
		} else {
			// Implicit command repetition (number after a command without new command letter)
			i++;
		}
	}

	if (currentPoints.length >= 2) {
		finishPolyline(false);
	}

	return polylines;
}

function isCommand(token: string): boolean {
	return /^[A-Za-z]$/.test(token);
}

function tokenizePathData(d: string): string[] {
	const tokens: string[] = [];
	const re = /([A-Za-z])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(d)) !== null) {
		tokens.push(match[0]);
	}
	return tokens;
}

function cubicBezierPoints(
	x0: number, y0: number,
	x1: number, y1: number,
	x2: number, y2: number,
	x3: number, y3: number,
	matrix: number[],
	output: Point2D[],
	tolerance: number = 0.5
): void {
	flattenCubicBezier(x0, y0, x1, y1, x2, y2, x3, y3, matrix, output, tolerance, 0);
}

function flattenCubicBezier(
	x0: number, y0: number,
	x1: number, y1: number,
	x2: number, y2: number,
	x3: number, y3: number,
	matrix: number[],
	output: Point2D[],
	tolerance: number,
	depth: number
): void {
	if (depth > 12) {
		output.push(applyTransform({ x: x3, y: y3 }, matrix));
		return;
	}

	// Flatness test: distance of control points from the line p0->p3
	const dx = x3 - x0;
	const dy = y3 - y0;
	const d2 = Math.abs((x1 - x3) * dy - (y1 - y3) * dx);
	const d3 = Math.abs((x2 - x3) * dy - (y2 - y3) * dx);
	const lenSq = dx * dx + dy * dy;

	if ((d2 + d3) * (d2 + d3) <= tolerance * tolerance * lenSq) {
		output.push(applyTransform({ x: x3, y: y3 }, matrix));
		return;
	}

	// De Casteljau subdivision at t=0.5
	const mx01 = (x0 + x1) / 2, my01 = (y0 + y1) / 2;
	const mx12 = (x1 + x2) / 2, my12 = (y1 + y2) / 2;
	const mx23 = (x2 + x3) / 2, my23 = (y2 + y3) / 2;
	const mx012 = (mx01 + mx12) / 2, my012 = (my01 + my12) / 2;
	const mx123 = (mx12 + mx23) / 2, my123 = (my12 + my23) / 2;
	const mx0123 = (mx012 + mx123) / 2, my0123 = (my012 + my123) / 2;

	flattenCubicBezier(x0, y0, mx01, my01, mx012, my012, mx0123, my0123, matrix, output, tolerance, depth + 1);
	flattenCubicBezier(mx0123, my0123, mx123, my123, mx23, my23, x3, y3, matrix, output, tolerance, depth + 1);
}

function quadBezierPoints(
	x0: number, y0: number,
	x1: number, y1: number,
	x2: number, y2: number,
	matrix: number[],
	output: Point2D[],
	tolerance: number = 0.5
): void {
	// Elevate to cubic
	const cx1 = x0 + (2 / 3) * (x1 - x0);
	const cy1 = y0 + (2 / 3) * (y1 - y0);
	const cx2 = x2 + (2 / 3) * (x1 - x2);
	const cy2 = y2 + (2 / 3) * (y1 - y2);
	cubicBezierPoints(x0, y0, cx1, cy1, cx2, cy2, x2, y2, matrix, output, tolerance);
}

function arcToPoints(
	x1: number, y1: number,
	rx: number, ry: number,
	rotation: number,
	largeArc: boolean,
	sweep: boolean,
	x2: number, y2: number,
	matrix: number[],
	output: Point2D[]
): void {
	if (rx === 0 || ry === 0) {
		output.push(applyTransform({ x: x2, y: y2 }, matrix));
		return;
	}

	rx = Math.abs(rx);
	ry = Math.abs(ry);
	const phi = (rotation * Math.PI) / 180;
	const cosPhi = Math.cos(phi);
	const sinPhi = Math.sin(phi);

	const dx2 = (x1 - x2) / 2;
	const dy2 = (y1 - y2) / 2;
	const x1p = cosPhi * dx2 + sinPhi * dy2;
	const y1p = -sinPhi * dx2 + cosPhi * dy2;

	let rxSq = rx * rx;
	let rySq = ry * ry;
	const x1pSq = x1p * x1p;
	const y1pSq = y1p * y1p;

	// Correct radii
	const lambda = x1pSq / rxSq + y1pSq / rySq;
	if (lambda > 1) {
		const s = Math.sqrt(lambda);
		rx *= s;
		ry *= s;
		rxSq = rx * rx;
		rySq = ry * ry;
	}

	let sq = Math.max(0, (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq));
	sq = Math.sqrt(sq);
	if (largeArc === sweep) sq = -sq;

	const cxp = sq * (rx * y1p) / ry;
	const cyp = sq * (-(ry * x1p) / rx);

	const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
	const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

	const theta1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
	let dtheta = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx) - theta1;

	if (sweep && dtheta < 0) dtheta += 2 * Math.PI;
	if (!sweep && dtheta > 0) dtheta -= 2 * Math.PI;

	const segments = Math.max(4, Math.ceil(Math.abs(dtheta) / (Math.PI / 16)));
	for (let i = 1; i <= segments; i++) {
		const t = theta1 + (dtheta * i) / segments;
		const xr = rx * Math.cos(t);
		const yr = ry * Math.sin(t);
		const x = cosPhi * xr - sinPhi * yr + cx;
		const y = sinPhi * xr + cosPhi * yr + cy;
		output.push(applyTransform({ x, y }, matrix));
	}
}
