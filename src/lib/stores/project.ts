import { writable, derived } from 'svelte/store';
import type { ProjectObject } from '$lib/types/project-object.js';

export type WorkflowState = 'idle' | 'file-loaded' | 'processing' | 'done' | 'error';

export interface ProjectState {
	objects: ProjectObject[];
	selectedObjectId: string | null;
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
	objects: [],
	selectedObjectId: null,
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

export const hasObjects = derived(project, ($p) => $p.objects.length > 0);
export const isProcessing = derived(project, ($p) => $p.workflowState === 'processing');
export const hasGCode = derived(project, ($p) => $p.gcode.length > 0);
export const canGenerate = derived(project, ($p) =>
	$p.objects.length > 0 &&
	($p.workflowState === 'file-loaded' || $p.workflowState === 'done' || $p.workflowState === 'error')
);

export const isLocked = derived(project, ($p) => $p.workflowState === 'processing');

export const hasSvgObjects = derived(project, ($p) =>
	$p.objects.some((o) => o.type === 'svg')
);
export const hasStlObjects = derived(project, ($p) =>
	$p.objects.some((o) => o.type === 'stl')
);

export function addObject(obj: ProjectObject) {
	project.update((p) => ({
		...p,
		objects: [...p.objects, obj],
		selectedObjectId: obj.id,
		workflowState: 'file-loaded'
	}));
}

export function removeObject(id: string) {
	project.update((p) => {
		const objects = p.objects.filter((o) => o.id !== id);
		const selectedObjectId =
			p.selectedObjectId === id
				? (objects.length > 0 ? objects[0].id : null)
				: p.selectedObjectId;
		return {
			...p,
			objects,
			selectedObjectId,
			workflowState: objects.length > 0 ? p.workflowState : 'idle'
		};
	});
}

export function selectObject(id: string) {
	project.update((p) => ({ ...p, selectedObjectId: id }));
}

export function resetProject() {
	project.set({ ...initialState });
}

