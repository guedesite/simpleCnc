import { describe, it, expect } from 'vitest';
import { parseSvg, parsePathData } from '../parser.js';

describe('parseSvg', () => {
	it('should throw for non-SVG content', () => {
		expect(() => parseSvg('<div>not svg</div>')).toThrow('No SVG element found');
	});

	it('should parse width and height', () => {
		const result = parseSvg('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200"></svg>');
		expect(result.width).toBe(100);
		expect(result.height).toBe(200);
	});

	it('should parse viewBox', () => {
		const result = parseSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"></svg>');
		expect(result.viewBox).toEqual({ x: 0, y: 0, width: 300, height: 400 });
	});

	it('should parse rect element', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="30" height="40"/></svg>';
		const result = parseSvg(svg);
		expect(result.elements).toHaveLength(1);
		expect(result.elements[0].type).toBe('rect');
		expect(result.elements[0].polylines).toHaveLength(1);
		const pts = result.elements[0].polylines[0].points;
		expect(pts[0].x).toBeCloseTo(10);
		expect(pts[0].y).toBeCloseTo(20);
		expect(pts[1].x).toBeCloseTo(40);
		expect(pts[1].y).toBeCloseTo(20);
		expect(pts[2].x).toBeCloseTo(40);
		expect(pts[2].y).toBeCloseTo(60);
		expect(pts[3].x).toBeCloseTo(10);
		expect(pts[3].y).toBeCloseTo(60);
	});

	it('should parse rect as closed polyline', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="10" height="10"/></svg>';
		const result = parseSvg(svg);
		expect(result.elements[0].polylines[0].closed).toBe(true);
	});

	it('should skip rect with zero width', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="0" height="10"/></svg>';
		const result = parseSvg(svg);
		expect(result.elements).toHaveLength(0);
	});

	it('should parse circle element', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="30"/></svg>';
		const result = parseSvg(svg);
		expect(result.elements).toHaveLength(1);
		expect(result.elements[0].type).toBe('circle');
		expect(result.elements[0].polylines[0].closed).toBe(true);
		const pts = result.elements[0].polylines[0].points;
		expect(pts.length).toBeGreaterThan(16);
		// First point should be at (cx+r, cy)
		expect(pts[0].x).toBeCloseTo(80);
		expect(pts[0].y).toBeCloseTo(50);
	});

	it('should skip circle with zero radius', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="0"/></svg>';
		const result = parseSvg(svg);
		expect(result.elements).toHaveLength(0);
	});

	it('should parse ellipse element', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="50" rx="30" ry="20"/></svg>';
		const result = parseSvg(svg);
		expect(result.elements).toHaveLength(1);
		expect(result.elements[0].type).toBe('ellipse');
		expect(result.elements[0].polylines[0].closed).toBe(true);
	});

	it('should parse line element', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><line x1="10" y1="20" x2="30" y2="40"/></svg>';
		const result = parseSvg(svg);
		expect(result.elements).toHaveLength(1);
		const poly = result.elements[0].polylines[0];
		expect(poly.closed).toBe(false);
		expect(poly.points).toHaveLength(2);
		expect(poly.points[0]).toEqual({ x: 10, y: 20 });
		expect(poly.points[1]).toEqual({ x: 30, y: 40 });
	});

	it('should parse polyline element', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polyline points="10,20 30,40 50,60"/></svg>';
		const result = parseSvg(svg);
		expect(result.elements).toHaveLength(1);
		const poly = result.elements[0].polylines[0];
		expect(poly.closed).toBe(false);
		expect(poly.points).toHaveLength(3);
	});

	it('should parse polygon element', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="10,20 30,40 50,60"/></svg>';
		const result = parseSvg(svg);
		expect(result.elements).toHaveLength(1);
		const poly = result.elements[0].polylines[0];
		expect(poly.closed).toBe(true);
		// polygon auto-closes: 3 points + closing point
		expect(poly.points).toHaveLength(4);
	});

	it('should parse multiple elements', () => {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg">
			<rect x="0" y="0" width="10" height="10"/>
			<circle cx="50" cy="50" r="5"/>
			<line x1="0" y1="0" x2="100" y2="100"/>
		</svg>`;
		const result = parseSvg(svg);
		expect(result.elements).toHaveLength(3);
	});

	it('should handle transform on groups', () => {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg">
			<g transform="translate(100, 100)">
				<rect x="0" y="0" width="10" height="10"/>
			</g>
		</svg>`;
		const result = parseSvg(svg);
		const pts = result.elements[0].polylines[0].points;
		expect(pts[0].x).toBeCloseTo(100);
		expect(pts[0].y).toBeCloseTo(100);
	});

	it('should handle nested groups with transforms', () => {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg">
			<g transform="translate(10, 0)">
				<g transform="translate(0, 20)">
					<line x1="0" y1="0" x2="5" y2="0"/>
				</g>
			</g>
		</svg>`;
		const result = parseSvg(svg);
		const pts = result.elements[0].polylines[0].points;
		expect(pts[0].x).toBeCloseTo(10);
		expect(pts[0].y).toBeCloseTo(20);
		expect(pts[1].x).toBeCloseTo(15);
		expect(pts[1].y).toBeCloseTo(20);
	});

	it('should handle scale transform', () => {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg">
			<g transform="scale(2)">
				<line x1="5" y1="10" x2="15" y2="20"/>
			</g>
		</svg>`;
		const result = parseSvg(svg);
		const pts = result.elements[0].polylines[0].points;
		expect(pts[0].x).toBeCloseTo(10);
		expect(pts[0].y).toBeCloseTo(20);
		expect(pts[1].x).toBeCloseTo(30);
		expect(pts[1].y).toBeCloseTo(40);
	});

	it('should preserve element id', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="myRect" x="0" y="0" width="10" height="10"/></svg>';
		const result = parseSvg(svg);
		expect(result.elements[0].id).toBe('myRect');
	});

	it('should ignore unsupported elements', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>hello</text><rect x="0" y="0" width="10" height="10"/></svg>';
		const result = parseSvg(svg);
		expect(result.elements).toHaveLength(1);
		expect(result.elements[0].type).toBe('rect');
	});
});

describe('parsePathData', () => {
	it('should parse simple M L path', () => {
		const polylines = parsePathData('M 0 0 L 10 0 L 10 10');
		expect(polylines).toHaveLength(1);
		expect(polylines[0].points).toHaveLength(3);
		expect(polylines[0].points[0]).toEqual({ x: 0, y: 0 });
		expect(polylines[0].points[1]).toEqual({ x: 10, y: 0 });
		expect(polylines[0].points[2]).toEqual({ x: 10, y: 10 });
	});

	it('should parse path with Z (close)', () => {
		const polylines = parsePathData('M 0 0 L 10 0 L 10 10 Z');
		expect(polylines).toHaveLength(1);
		expect(polylines[0].closed).toBe(true);
	});

	it('should parse relative commands', () => {
		const polylines = parsePathData('M 10 10 l 5 0 l 0 5');
		expect(polylines).toHaveLength(1);
		expect(polylines[0].points[1].x).toBeCloseTo(15);
		expect(polylines[0].points[1].y).toBeCloseTo(10);
		expect(polylines[0].points[2].x).toBeCloseTo(15);
		expect(polylines[0].points[2].y).toBeCloseTo(15);
	});

	it('should parse H (horizontal lineto)', () => {
		const polylines = parsePathData('M 0 0 H 10');
		expect(polylines[0].points[1].x).toBeCloseTo(10);
		expect(polylines[0].points[1].y).toBeCloseTo(0);
	});

	it('should parse V (vertical lineto)', () => {
		const polylines = parsePathData('M 0 0 V 10');
		expect(polylines[0].points[1].x).toBeCloseTo(0);
		expect(polylines[0].points[1].y).toBeCloseTo(10);
	});

	it('should parse h (relative horizontal)', () => {
		const polylines = parsePathData('M 5 5 h 10');
		expect(polylines[0].points[1].x).toBeCloseTo(15);
		expect(polylines[0].points[1].y).toBeCloseTo(5);
	});

	it('should parse v (relative vertical)', () => {
		const polylines = parsePathData('M 5 5 v 10');
		expect(polylines[0].points[1].x).toBeCloseTo(5);
		expect(polylines[0].points[1].y).toBeCloseTo(15);
	});

	it('should parse cubic bezier C', () => {
		const polylines = parsePathData('M 0 0 C 10 0 10 10 0 10');
		expect(polylines).toHaveLength(1);
		expect(polylines[0].points.length).toBeGreaterThan(2);
		const last = polylines[0].points[polylines[0].points.length - 1];
		expect(last.x).toBeCloseTo(0);
		expect(last.y).toBeCloseTo(10);
	});

	it('should parse quadratic bezier Q', () => {
		const polylines = parsePathData('M 0 0 Q 10 5 10 10');
		expect(polylines).toHaveLength(1);
		expect(polylines[0].points.length).toBeGreaterThan(2);
	});

	it('should parse multiple subpaths', () => {
		const polylines = parsePathData('M 0 0 L 10 10 M 20 20 L 30 30');
		expect(polylines).toHaveLength(2);
	});

	it('should parse path with commas', () => {
		const polylines = parsePathData('M0,0 L10,0 L10,10');
		expect(polylines[0].points).toHaveLength(3);
	});

	it('should parse path without spaces', () => {
		const polylines = parsePathData('M0 0L10 0L10 10');
		expect(polylines[0].points).toHaveLength(3);
	});

	it('should handle implicit lineto after M', () => {
		const polylines = parsePathData('M 0 0 10 10 20 20');
		expect(polylines[0].points).toHaveLength(3);
	});

	it('should apply transform to path', () => {
		const polylines = parsePathData('M 0 0 L 10 0', [2, 0, 0, 2, 5, 5]);
		expect(polylines[0].points[0].x).toBeCloseTo(5);
		expect(polylines[0].points[0].y).toBeCloseTo(5);
		expect(polylines[0].points[1].x).toBeCloseTo(25);
		expect(polylines[0].points[1].y).toBeCloseTo(5);
	});
});
