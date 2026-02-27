import { writable, derived } from 'svelte/store';
import type { Polyline } from '$lib/types/geometry.js';

export type FileType = 'svg' | 'stl' | null;
export type WorkflowState = 'idle' | 'file-loaded' | 'processing' | 'done' | 'error';

export interface ProjectState {
	fileType: FileType;
	fileName: string;
	svgPolylines: Polyline[];
	stlVertices: Float32Array | null;
	stlBuffer: ArrayBuffer | null;
	workflowState: WorkflowState;
	gcode: string;
	progressStage: string;
	progressPercent: number;
	errorMessage: string;
	cutDepth: number;
	stepover: number;
	resolution: number;
}

const initialState: ProjectState = {
	fileType: null,
	fileName: '',
	svgPolylines: [],
	stlVertices: null,
	stlBuffer: null,
	workflowState: 'idle',
	gcode: '',
	progressStage: '',
	progressPercent: 0,
	errorMessage: '',
	cutDepth: 1.0,
	stepover: 1.0,
	resolution: 0.5
};

export const project = writable<ProjectState>({ ...initialState });

export const hasFile = derived(project, ($p) => $p.fileType !== null);
export const isProcessing = derived(project, ($p) => $p.workflowState === 'processing');
export const hasGCode = derived(project, ($p) => $p.gcode.length > 0);
export const canGenerate = derived(project, ($p) =>
	$p.workflowState === 'file-loaded' || $p.workflowState === 'done' || $p.workflowState === 'error'
);

export function resetProject() {
	project.set({ ...initialState });
}
