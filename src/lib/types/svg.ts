import type { Polyline } from './geometry.js';

export interface ParsedSvgElement {
	type: string;
	polylines: Polyline[];
	id?: string;
}

export interface ParsedSvg {
	width: number;
	height: number;
	viewBox: { x: number; y: number; width: number; height: number } | null;
	elements: ParsedSvgElement[];
}
