<script lang="ts">
	import { onMount } from 'svelte';
	import { createScene, type SceneContext } from './scene-setup.js';
	import { createStockMesh } from './cnc-bed.js';
	import { createToolpathLines, removeToolpath } from './toolpath-preview.js';
	import { stockConfig } from '$lib/stores/machine-config.js';
	import { project } from '$lib/stores/project.js';

	interface Props {
		sceneCtx?: SceneContext | null;
		onviewportclick?: (event: MouseEvent) => void;
	}

	let { sceneCtx = $bindable(null), onviewportclick }: Props = $props();
	let canvas: HTMLCanvasElement;
	let stockGroup: import('three').Group | null = null;

	onMount(() => {
		sceneCtx = createScene(canvas);

		// Add initial stock
		stockGroup = createStockMesh($stockConfig.width, $stockConfig.height, $stockConfig.thickness);
		sceneCtx.scene.add(stockGroup);

		return () => {
			sceneCtx?.dispose();
			sceneCtx = null;
		};
	});

	// Update stock when config changes
	$effect(() => {
		if (sceneCtx && stockGroup) {
			sceneCtx.scene.remove(stockGroup);
			stockGroup = createStockMesh($stockConfig.width, $stockConfig.height, $stockConfig.thickness);
			sceneCtx.scene.add(stockGroup);
		}
	});

	// Update toolpath preview
	$effect(() => {
		if (!sceneCtx) return;
		const gcode = $project.gcode;

		if ($project.workflowState === 'done' && gcode) {
			// Toolpath data stored in project is already rendered when gcode is generated
		}
	});

	export function showToolpath(data: Float32Array) {
		if (!sceneCtx) return;
		removeToolpath(sceneCtx.scene);
		const lines = createToolpathLines(data);
		sceneCtx.scene.add(lines);
	}

	export function clearToolpath() {
		if (!sceneCtx) return;
		removeToolpath(sceneCtx.scene);
	}

	function handleCanvasClick(event: MouseEvent) {
		onviewportclick?.(event);
	}
</script>

<div class="viewport-container">
	<canvas bind:this={canvas} onclick={handleCanvasClick}></canvas>
</div>

<style>
	.viewport-container {
		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
