import type { Polyline } from './geometry.js';

export interface ProjectObject {
	id: string;
	name: string;
	type: 'svg' | 'stl';
	svgPolylines?: Polyline[];
	stlBuffer?: ArrayBuffer;
	visible: boolean;
}
