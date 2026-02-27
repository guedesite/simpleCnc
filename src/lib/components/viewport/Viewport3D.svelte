<script lang="ts">
	import { onMount } from 'svelte';
	import { createScene, type SceneContext } from './scene-setup.js';
	import { createStockMesh, createOriginMarker } from './cnc-bed.js';
	import { createToolpathLines, removeToolpath, createAnimatedToolpath, type AnimatedToolpath } from './toolpath-preview.js';
	import { stockConfig, machineConfig } from '$lib/stores/machine-config.js';
	import { project } from '$lib/stores/project.js';
	import { computeOriginOffsets } from '$lib/types/machine.js';

	interface Props {
		sceneCtx?: SceneContext | null;
		onviewportclick?: (event: MouseEvent) => void;
	}

	let { sceneCtx = $bindable(null), onviewportclick }: Props = $props();
	let canvas: HTMLCanvasElement;
	let stockGroup: import('three').Group | null = null;
	let originMarkerGroup: import('three').Group | null = null;
	let currentAnimation: AnimatedToolpath | null = null;

	onMount(() => {
		sceneCtx = createScene(canvas);

		// Add initial stock (always at world origin, extends to width/height)
		stockGroup = createStockMesh($stockConfig.width, $stockConfig.height, $stockConfig.thickness);
		sceneCtx.scene.add(stockGroup);

		// Add origin marker (moves to show where machine origin sits on the stock)
		originMarkerGroup = createOriginMarker();
		sceneCtx.scene.add(originMarkerGroup);

		return () => {
			currentAnimation?.cancel();
			sceneCtx?.dispose();
			sceneCtx = null;
		};
	});

	// Update stock when dimensions change
	$effect(() => {
		if (sceneCtx && stockGroup) {
			sceneCtx.scene.remove(stockGroup);
			stockGroup = createStockMesh($stockConfig.width, $stockConfig.height, $stockConfig.thickness);
			sceneCtx.scene.add(stockGroup);
		}
	});

	// Move origin marker when origin position or stock dims change
	$effect(() => {
		if (originMarkerGroup) {
			const { originX, originY } = computeOriginOffsets(
				$machineConfig.originPosition,
				$stockConfig.width,
				$stockConfig.height
			);
			// originX/originY are negative offsets applied to G-code coords.
			// The marker position on the stock surface is the inverse: (-originX, 0, -originY)
			originMarkerGroup.position.set(-originX, 0, -originY);
		}
	});

	export function showToolpath(data: Float32Array) {
		if (!sceneCtx) return;
		currentAnimation?.cancel();
		currentAnimation = null;
		removeToolpath(sceneCtx.scene);
		const lines = createToolpathLines(data);
		sceneCtx.scene.add(lines);
	}

	export function showToolpathPreview(data: Float32Array) {
		if (!sceneCtx) return;
		currentAnimation?.cancel();
		removeToolpath(sceneCtx.scene);
		const anim = createAnimatedToolpath(data);
		currentAnimation = anim;
		sceneCtx.scene.add(anim.group);
		anim.animate();
	}

	export function clearToolpath() {
		if (!sceneCtx) return;
		currentAnimation?.cancel();
		currentAnimation = null;
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
