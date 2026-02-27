<script lang="ts">
	import Sidebar from '$lib/components/sidebar/Sidebar.svelte';
	import Viewport3D from '$lib/components/viewport/Viewport3D.svelte';
	import { project } from '$lib/stores/project.js';
	import { toolConfig } from '$lib/stores/tool-config.js';
	import { machineConfig, stockConfig } from '$lib/stores/machine-config.js';
	import { parseSvg } from '$lib/engine/svg/parser.js';
	import { loadStlFromBuffer } from '$lib/engine/stl/loader.js';
	import { addStlMesh, removeStlModel, type StlViewer, type TransformMode } from '$lib/components/viewport/stl-controls.js';
	import type { SceneContext } from '$lib/components/viewport/scene-setup.js';
	import type { SvgWorkerOutput } from '$lib/types/worker-messages.js';
	import type { StlWorkerOutput } from '$lib/types/worker-messages.js';

	let viewportRef: Viewport3D;
	let sceneCtx: SceneContext | null = $state(null);
	let currentWorker: Worker | null = null;
	let stlViewer: StlViewer | null = $state(null);
	let transformMode: TransformMode = $state('translate');

	function setTransformMode(mode: TransformMode) {
		transformMode = mode;
		stlViewer?.setMode(mode);
	}

	async function handleFile(file: File) {
		const ext = file.name.split('.').pop()?.toLowerCase();

		if (ext === 'svg') {
			// Clean up previous STL viewer
			if (stlViewer) {
				stlViewer.dispose();
				stlViewer = null;
			}

			const text = await file.text();
			const parsed = parseSvg(text);
			const allPolylines = parsed.elements.flatMap((el) => el.polylines);

			project.update((p) => ({
				...p,
				fileType: 'svg',
				fileName: file.name,
				svgPolylines: allPolylines,
				stlVertices: null,
				stlBuffer: null,
				workflowState: 'file-loaded'
			}));
		} else if (ext === 'stl') {
			// Clean up previous STL viewer
			if (stlViewer) {
				stlViewer.dispose();
				stlViewer = null;
			}

			const buffer = await file.arrayBuffer();
			const geometry = loadStlFromBuffer(buffer);

			// Add to 3D viewport and keep reference
			if (sceneCtx) {
				removeStlModel(sceneCtx.scene);
				stlViewer = addStlMesh(geometry, sceneCtx.scene, sceneCtx.camera, sceneCtx.renderer, sceneCtx.controls);
			}

			project.update((p) => ({
				...p,
				fileType: 'stl',
				fileName: file.name,
				stlVertices: null,
				stlBuffer: buffer,
				workflowState: 'file-loaded'
			}));
		} else {
			project.update((p) => ({
				...p,
				workflowState: 'error',
				errorMessage: 'Unsupported file format. Please use .svg or .stl files.'
			}));
		}
	}

	function handleGenerate() {
		const p = $project;

		if (p.fileType === 'svg') {
			generateSvg();
		} else if (p.fileType === 'stl') {
			generateStl();
		}
	}

	function generateSvg() {
		if (currentWorker) currentWorker.terminate();

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
				case 'result':
					project.update((p) => ({
						...p,
						workflowState: 'done',
						gcode: msg.gcode,
						progressPercent: 100,
						progressStage: 'Complete'
					}));
					viewportRef?.showToolpath(msg.toolpathData);
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
			polylines: $project.svgPolylines,
			toolConfig: $toolConfig,
			machineConfig: $machineConfig,
			cutDepth: $project.cutDepth
		});
	}

	function generateStl() {
		if (currentWorker) currentWorker.terminate();

		if (!stlViewer) {
			project.update((p) => ({
				...p,
				workflowState: 'error',
				errorMessage: 'No STL model loaded in viewport.'
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
				case 'result':
					project.update((p) => ({
						...p,
						workflowState: 'done',
						gcode: msg.gcode,
						progressPercent: 100,
						progressStage: 'Complete'
					}));
					viewportRef?.showToolpath(msg.toolpathData);
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

		// Extract transformed vertices from the viewport mesh (includes position/rotation/scale)
		const vertices = stlViewer.getTransformedVertices();
		worker.postMessage({
			type: 'process-stl',
			vertices,
			toolConfig: $toolConfig,
			machineConfig: $machineConfig,
			stockConfig: $stockConfig,
			resolution: $project.resolution,
			stepover: $project.stepover
		}, [vertices.buffer]);
	}

	function handleResetFile() {
		if (stlViewer) {
			stlViewer.dispose();
			stlViewer = null;
		}
		viewportRef?.clearToolpath();
		project.update(p => ({
			...p,
			fileType: null,
			fileName: '',
			svgPolylines: [],
			stlVertices: null,
			stlBuffer: null,
			workflowState: 'idle',
			gcode: '',
			errorMessage: ''
		}));
	}
</script>

<Sidebar onfile={handleFile} ongenerate={handleGenerate} onreset={handleResetFile} {stlViewer} />

<div class="main-area">
	{#if $project.fileType === 'stl' && stlViewer}
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
	<Viewport3D bind:this={viewportRef} bind:sceneCtx />
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
