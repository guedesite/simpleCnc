<script lang="ts">
	import * as THREE from 'three';
	import Sidebar from '$lib/components/sidebar/Sidebar.svelte';
	import Viewport3D from '$lib/components/viewport/Viewport3D.svelte';
	import { project, addObject, removeObject, selectObject, resetProject, isLocked } from '$lib/stores/project.js';
	import { toolConfig } from '$lib/stores/tool-config.js';
	import { machineConfig, stockConfig } from '$lib/stores/machine-config.js';
	import { computeOriginOffsets } from '$lib/types/machine.js';
	import { parseSvg } from '$lib/engine/svg/parser.js';
	import { loadStlFromBuffer } from '$lib/engine/stl/loader.js';
	import {
		addStlMesh,
		createTransformControlsManager,
		type ObjectViewer,
		type StlViewer,
		type SvgViewer,
		type TransformMode,
		type TransformControlsManager
	} from '$lib/components/viewport/stl-controls.js';
	import { addSvgMesh } from '$lib/components/viewport/svg-controls.js';
	import type { SceneContext } from '$lib/components/viewport/scene-setup.js';
	import type { SvgWorkerOutput, StlWorkerOutput } from '$lib/types/worker-messages.js';
	import type { ProjectObject } from '$lib/types/project-object.js';

	let viewportRef: Viewport3D;
	let previewShown = false;
	let sceneCtx: SceneContext | null = $state(null);
	let currentWorker: Worker | null = null;
	let transformManager: TransformControlsManager | null = null;
	let viewers: Map<string, ObjectViewer> = new Map();
	let selectedViewer: ObjectViewer | null = $state(null);
	let transformMode: TransformMode = $state('translate');

	// Create transform manager when scene becomes available
	$effect(() => {
		if (sceneCtx && !transformManager) {
			transformManager = createTransformControlsManager(
				sceneCtx.scene,
				sceneCtx.camera,
				sceneCtx.renderer,
				sceneCtx.controls
			);
		}
	});

	// Auto-sync originX/originY from originPosition + stock dimensions
	$effect(() => {
		const mc = $machineConfig;
		const w = $stockConfig.width;
		const h = $stockConfig.height;
		const { originX, originY } = computeOriginOffsets(mc.originPosition, w, h);
		// Guard: only update if values actually changed to avoid infinite loop
		// (reading $machineConfig subscribes to the whole store, so writing back re-triggers this effect)
		if (mc.originX !== originX || mc.originY !== originY) {
			machineConfig.update((c) => ({ ...c, originX, originY }));
		}
	});

	function setTransformMode(mode: TransformMode) {
		transformMode = mode;
		transformManager?.setMode(mode);
	}

	async function handleFiles(files: File[]) {
		for (const file of files) {
			const ext = file.name.split('.').pop()?.toLowerCase();

			if (ext === 'svg') {
				const text = await file.text();
				const parsed = parseSvg(text);
				const allPolylines = parsed.elements.flatMap((el) => el.polylines);

				const obj: ProjectObject = {
					id: crypto.randomUUID(),
					name: file.name,
					type: 'svg',
					svgPolylines: allPolylines,
					visible: true
				};

				if (sceneCtx) {
					const viewer = addSvgMesh(allPolylines, obj.id, sceneCtx.scene);
					viewers.set(obj.id, viewer);
				}

				addObject(obj);
				handleSelectObject(obj.id);
			} else if (ext === 'stl') {
				const buffer = await file.arrayBuffer();
				const geometry = loadStlFromBuffer(buffer);

				const obj: ProjectObject = {
					id: crypto.randomUUID(),
					name: file.name,
					type: 'stl',
					stlBuffer: buffer,
					visible: true
				};

				if (sceneCtx) {
					const viewer = addStlMesh(geometry, obj.id, sceneCtx.scene);
					viewers.set(obj.id, viewer);
				}

				addObject(obj);
				handleSelectObject(obj.id);
			} else {
				project.update((p) => ({
					...p,
					workflowState: 'error',
					errorMessage: `Unsupported file: ${file.name}. Use .svg or .stl files.`
				}));
			}
		}
	}

	function handleSelectObject(id: string) {
		selectObject(id);
		const viewer = viewers.get(id);
		if (viewer && transformManager) {
			transformManager.attachTo(viewer);
			selectedViewer = viewer;
		}
	}

	function handleRemoveObject(id: string) {
		const viewer = viewers.get(id);
		if (viewer) {
			if (selectedViewer === viewer) {
				transformManager?.detach();
				selectedViewer = null;
			}
			viewer.dispose();
			viewers.delete(id);
		}
		removeObject(id);

		// Auto-select next object if we had the removed one selected
		const p = $project;
		if (p.selectedObjectId && viewers.has(p.selectedObjectId)) {
			handleSelectObject(p.selectedObjectId);
		}
	}

	function handleResetAll() {
		transformManager?.detach();
		selectedViewer = null;
		for (const viewer of viewers.values()) {
			viewer.dispose();
		}
		viewers.clear();
		viewportRef?.clearToolpath();
		resetProject();
	}

	/** Resolve machineConfig with origin offsets computed from originPosition + stock dims. */
	function getResolvedMachineConfig() {
		const mc = $machineConfig;
		const { originX, originY } = computeOriginOffsets(mc.originPosition, $stockConfig.width, $stockConfig.height);
		return { ...mc, originX, originY };
	}

	function handleGenerate() {
		const p = $project;
		const hasStl = p.objects.some((o) => o.type === 'stl');
		const hasSvg = p.objects.some((o) => o.type === 'svg');

		if (hasStl) {
			generateStl();
		} else if (hasSvg) {
			generateSvg();
		}
	}

	function generateSvg() {
		if (currentWorker) currentWorker.terminate();
		previewShown = false;

		// Collect transformed polylines from all SVG viewers
		const allPolylines: import('$lib/types/geometry.js').Polyline[] = [];
		for (const obj of $project.objects) {
			if (obj.type !== 'svg') continue;
			const viewer = viewers.get(obj.id) as SvgViewer | undefined;
			if (viewer) {
				allPolylines.push(...viewer.getTransformedPolylines());
			}
		}

		if (allPolylines.length === 0) {
			project.update((p) => ({
				...p,
				workflowState: 'error',
				errorMessage: 'No SVG polylines to process.'
			}));
			return;
		}

		project.update((p) => ({
			...p,
			workflowState: 'processing',
			progressStage: 'Starting...',
			progressPercent: 0,
			gcode: '',
			errorMessage: ''
		}));

		const worker = new Worker(
			new URL('$lib/workers/svg-worker.ts', import.meta.url),
			{ type: 'module' }
		);
		currentWorker = worker;

		worker.onmessage = (event: MessageEvent<SvgWorkerOutput>) => {
			const msg = event.data;
			switch (msg.type) {
				case 'progress':
					project.update((p) => ({
						...p,
						progressStage: msg.stage,
						progressPercent: msg.percent
					}));
					break;
				case 'toolpath-preview':
					viewportRef?.showToolpathPreview(msg.toolpathData);
					previewShown = true;
					break;
				case 'result':
					project.update((p) => ({
						...p,
						workflowState: 'done',
						gcode: msg.gcode,
						progressPercent: 100,
						progressStage: 'Complete'
					}));
					if (!previewShown) {
						viewportRef?.showToolpath(msg.toolpathData);
					}
					worker.terminate();
					currentWorker = null;
					break;
				case 'error':
					project.update((p) => ({
						...p,
						workflowState: 'error',
						errorMessage: msg.message
					}));
					worker.terminate();
					currentWorker = null;
					break;
			}
		};

		worker.onerror = (err) => {
			project.update((p) => ({
				...p,
				workflowState: 'error',
				errorMessage: `Worker error: ${err.message}`
			}));
			currentWorker = null;
		};

		worker.postMessage({
			type: 'process-svg',
			polylines: allPolylines,
			toolConfig: $toolConfig,
			machineConfig: getResolvedMachineConfig(),
			cutDepth: $project.cutDepth
		});
	}

	function generateStl() {
		if (currentWorker) currentWorker.terminate();
		previewShown = false;

		// Collect transformed vertices from all STL viewers
		const vertexArrays: Float32Array[] = [];
		for (const obj of $project.objects) {
			if (obj.type !== 'stl') continue;
			const viewer = viewers.get(obj.id) as StlViewer | undefined;
			if (viewer) {
				vertexArrays.push(viewer.getTransformedVertices());
			}
		}

		if (vertexArrays.length === 0) {
			project.update((p) => ({
				...p,
				workflowState: 'error',
				errorMessage: 'No STL models loaded in viewport.'
			}));
			return;
		}

		// Merge all vertex arrays into one
		const totalLength = vertexArrays.reduce((sum, a) => sum + a.length, 0);
		const mergedVertices = new Float32Array(totalLength);
		let offset = 0;
		for (const arr of vertexArrays) {
			mergedVertices.set(arr, offset);
			offset += arr.length;
		}

		project.update((p) => ({
			...p,
			workflowState: 'processing',
			progressStage: 'Starting...',
			progressPercent: 0,
			gcode: '',
			errorMessage: ''
		}));

		const worker = new Worker(
			new URL('$lib/workers/stl-worker.ts', import.meta.url),
			{ type: 'module' }
		);
		currentWorker = worker;

		worker.onmessage = (event: MessageEvent<StlWorkerOutput>) => {
			const msg = event.data;
			switch (msg.type) {
				case 'progress':
					project.update((p) => ({
						...p,
						progressStage: msg.stage,
						progressPercent: msg.percent
					}));
					break;
				case 'toolpath-preview':
					viewportRef?.showToolpathPreview(msg.toolpathData);
					previewShown = true;
					break;
				case 'result':
					project.update((p) => ({
						...p,
						workflowState: 'done',
						gcode: msg.gcode,
						progressPercent: 100,
						progressStage: 'Complete'
					}));
					if (!previewShown) {
						viewportRef?.showToolpath(msg.toolpathData);
					}
					worker.terminate();
					currentWorker = null;
					break;
				case 'error':
					project.update((p) => ({
						...p,
						workflowState: 'error',
						errorMessage: msg.message
					}));
					worker.terminate();
					currentWorker = null;
					break;
			}
		};

		worker.onerror = (err) => {
			project.update((p) => ({
				...p,
				workflowState: 'error',
				errorMessage: `Worker error: ${err.message}`
			}));
			currentWorker = null;
		};

		worker.postMessage({
			type: 'process-stl',
			vertices: mergedVertices,
			toolConfig: $toolConfig,
			machineConfig: getResolvedMachineConfig(),
			stockConfig: $stockConfig,
			resolution: $project.resolution,
			stepover: $project.stepover,
			invertedMode: $project.invertedMode
		}, [mergedVertices.buffer]);
	}

	function handleViewportClick(event: MouseEvent) {
		if (!sceneCtx) return;

		const canvas = event.target as HTMLCanvasElement;
		const rect = canvas.getBoundingClientRect();
		const mouse = new THREE.Vector2(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		);

		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(mouse, sceneCtx.camera);

		// Collect all meshes belonging to viewers
		const meshes: THREE.Object3D[] = [];
		for (const viewer of viewers.values()) {
			if (viewer.mesh instanceof THREE.Group) {
				viewer.mesh.traverse((child) => {
					if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
						meshes.push(child);
					}
				});
			} else {
				meshes.push(viewer.mesh);
			}
		}

		const intersects = raycaster.intersectObjects(meshes, false);
		if (intersects.length > 0) {
			// Find which viewer owns this mesh
			const hitObj = intersects[0].object;
			for (const [id, viewer] of viewers) {
				if (viewer.mesh === hitObj) {
					handleSelectObject(id);
					return;
				}
				// Check if hit object is a child of viewer's group
				if (viewer.mesh instanceof THREE.Group) {
					let parent = hitObj.parent;
					while (parent) {
						if (parent === viewer.mesh) {
							handleSelectObject(id);
							return;
						}
						parent = parent.parent;
					}
				}
			}
		}
	}
</script>

<Sidebar
	onfiles={handleFiles}
	ongenerate={handleGenerate}
	onreset={handleResetAll}
	onselect={handleSelectObject}
	onremove={handleRemoveObject}
	{selectedViewer}
/>

<div class="main-area">
	{#if selectedViewer && !$isLocked}
		<div class="toolbar">
			<button
				class="tool-btn"
				class:active={transformMode === 'translate'}
				onclick={() => setTransformMode('translate')}
				title="Translate (T)"
			>Move</button>
			<button
				class="tool-btn"
				class:active={transformMode === 'rotate'}
				onclick={() => setTransformMode('rotate')}
				title="Rotate (R)"
			>Rotate</button>
			<button
				class="tool-btn"
				class:active={transformMode === 'scale'}
				onclick={() => setTransformMode('scale')}
				title="Scale (S)"
			>Scale</button>
		</div>
	{/if}
	<Viewport3D bind:this={viewportRef} bind:sceneCtx onviewportclick={handleViewportClick} />
</div>

<style>
	.main-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		position: relative;
		overflow: hidden;
	}
	.toolbar {
		display: flex;
		gap: 4px;
		padding: 8px;
		background: rgba(30, 30, 30, 0.9);
		position: absolute;
		top: 8px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
		border-radius: 6px;
		border: 1px solid #333;
	}
	.tool-btn {
		padding: 6px 14px;
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 4px;
		color: #ccc;
		cursor: pointer;
		font-size: 0.8rem;
		font-family: inherit;
		transition: all 0.15s;
	}
	.tool-btn:hover {
		background: #333;
		border-color: #666;
	}
	.tool-btn.active {
		background: #0af;
		color: #000;
		border-color: #0af;
		font-weight: 600;
	}
</style>
