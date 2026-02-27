import type { Polyline } from './geometry.js';
import type { ToolConfig } from './tool.js';
import type { MachineConfig, StockConfig } from './machine.js';

// SVG Worker Messages
export interface SvgWorkerInput {
	type: 'process-svg';
	polylines: Polyline[];
	toolConfig: ToolConfig;
	machineConfig: MachineConfig;
	cutDepth: number;
}

export interface SvgWorkerProgress {
	type: 'progress';
	stage: string;
	percent: number;
}

export interface SvgWorkerResult {
	type: 'result';
	gcode: string;
	toolpathData: Float32Array;
	stats: {
		totalDistance: number;
		cuttingDistance: number;
		rapidDistance: number;
		estimatedTime: number;
	};
}

export interface SvgWorkerError {
	type: 'error';
	message: string;
}

export interface SvgToolpathPreview {
	type: 'toolpath-preview';
	toolpathData: Float32Array;
}

export type SvgWorkerOutput = SvgWorkerProgress | SvgWorkerResult | SvgWorkerError | SvgToolpathPreview;

// STL Worker Messages
export interface StlWorkerInput {
	type: 'process-stl';
	/** Flat array of triangle vertices [x0,y0,z0, x1,y1,z1, ...] */
	vertices: Float32Array;
	toolConfig: ToolConfig;
	machineConfig: MachineConfig;
	stockConfig: StockConfig;
	resolution: number;
	stepover: number;
	invertedMode?: boolean;
}

export interface StlWorkerProgress {
	type: 'progress';
	stage: string;
	percent: number;
}

export interface StlWorkerResult {
	type: 'result';
	gcode: string;
	toolpathData: Float32Array;
	stats: {
		totalDistance: number;
		cuttingDistance: number;
		rapidDistance: number;
		estimatedTime: number;
		gridSize: { width: number; height: number };
	};
}

export interface StlWorkerError {
	type: 'error';
	message: string;
}

export interface StlToolpathPreview {
	type: 'toolpath-preview';
	toolpathData: Float32Array;
}

export type StlWorkerOutput = StlWorkerProgress | StlWorkerResult | StlWorkerError | StlToolpathPreview;
