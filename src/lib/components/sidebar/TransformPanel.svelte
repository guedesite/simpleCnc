<script lang="ts">
	import NumberInput from '$lib/components/ui/NumberInput.svelte';
	import type { ObjectViewer, ObjectTransform } from '$lib/components/viewport/stl-controls.js';

	interface Props {
		viewer: ObjectViewer;
	}

	let props: Props = $props();

	let posX = $state(0);
	let posY = $state(0);
	let posZ = $state(0);
	let rotX = $state(0);
	let rotY = $state(0);
	let rotZ = $state(0);
	let scaleX = $state(1);
	let scaleY = $state(1);
	let scaleZ = $state(1);
	let uniformScale = $state(1);

	function syncFromTransform(t: ObjectTransform) {
		posX = round(t.positionX);
		posY = round(t.positionY);
		posZ = round(t.positionZ);
		rotX = round(t.rotationX);
		rotY = round(t.rotationY);
		rotZ = round(t.rotationZ);
		scaleX = round(t.scaleX);
		scaleY = round(t.scaleY);
		scaleZ = round(t.scaleZ);
		uniformScale = round(t.scaleX);
	}

	function round(v: number): number {
		return Math.round(v * 1000) / 1000;
	}

	// Subscribe/unsubscribe when viewer changes
	$effect(() => {
		const v = props.viewer;
		syncFromTransform(v.getTransform());
		v.onTransformChange(syncFromTransform);
		return () => {
			v.offTransformChange(syncFromTransform);
		};
	});

	function onPosX(v: number) { props.viewer.setTransform({ positionX: v }); }
	function onPosY(v: number) { props.viewer.setTransform({ positionY: v }); }
	function onPosZ(v: number) { props.viewer.setTransform({ positionZ: v }); }
	function onRotX(v: number) { props.viewer.setTransform({ rotationX: v }); }
	function onRotY(v: number) { props.viewer.setTransform({ rotationY: v }); }
	function onRotZ(v: number) { props.viewer.setTransform({ rotationZ: v }); }
	function onScaleX(v: number) { props.viewer.setTransform({ scaleX: v }); }
	function onScaleY(v: number) { props.viewer.setTransform({ scaleY: v }); }
	function onScaleZ(v: number) { props.viewer.setTransform({ scaleZ: v }); }
	function onUniformScale(v: number) {
		props.viewer.setTransform({ scaleX: v, scaleY: v, scaleZ: v });
	}

	function handleAutoFlatten() {
		props.viewer.autoFlatten();
		syncFromTransform(props.viewer.getTransform());
	}
</script>

<div class="panel">
	<h3>Transform</h3>

	<div class="section-label">Position</div>
	<div class="row3">
		<NumberInput label="X" bind:value={posX} min={-2000} max={2000} step={0.1} unit="mm" onchange={onPosX} />
		<NumberInput label="Y" bind:value={posY} min={-2000} max={2000} step={0.1} unit="mm" onchange={onPosY} />
		<NumberInput label="Z" bind:value={posZ} min={-2000} max={2000} step={0.1} unit="mm" onchange={onPosZ} />
	</div>

	<div class="section-label">Rotation</div>
	<div class="row3">
		<NumberInput label="X" bind:value={rotX} min={-360} max={360} step={1} unit="°" onchange={onRotX} />
		<NumberInput label="Y" bind:value={rotY} min={-360} max={360} step={1} unit="°" onchange={onRotY} />
		<NumberInput label="Z" bind:value={rotZ} min={-360} max={360} step={1} unit="°" onchange={onRotZ} />
	</div>

	<div class="section-label">Scale</div>
	<NumberInput label="Uniform" bind:value={uniformScale} min={0.01} max={100} step={0.01} onchange={onUniformScale} />
	<div class="row3">
		<NumberInput label="X" bind:value={scaleX} min={0.01} max={100} step={0.01} onchange={onScaleX} />
		<NumberInput label="Y" bind:value={scaleY} min={0.01} max={100} step={0.01} onchange={onScaleY} />
		<NumberInput label="Z" bind:value={scaleZ} min={0.01} max={100} step={0.01} onchange={onScaleZ} />
	</div>

	<button class="flatten-btn" onclick={handleAutoFlatten}>
		Auto-Flatten (Z=0)
	</button>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	h3 {
		margin: 0;
		font-size: 0.875rem;
		color: #0af;
		text-transform: uppercase;
		letter-spacing: 1px;
		border-bottom: 1px solid #333;
		padding-bottom: 8px;
	}
	.section-label {
		font-size: 0.7rem;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-top: 2px;
	}
	.row3 {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 6px;
	}
	.flatten-btn {
		margin-top: 4px;
		padding: 8px 12px;
		background: #2a5a2a;
		border: 1px solid #4a8a4a;
		border-radius: 4px;
		color: #cfc;
		cursor: pointer;
		font-size: 0.8rem;
		font-family: inherit;
		transition: all 0.15s;
	}
	.flatten-btn:hover {
		background: #3a7a3a;
		border-color: #6aba6a;
	}
</style>
