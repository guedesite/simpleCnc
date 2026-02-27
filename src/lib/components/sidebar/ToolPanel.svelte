<script lang="ts">
	import NumberInput from '$lib/components/ui/NumberInput.svelte';
	import SelectInput from '$lib/components/ui/SelectInput.svelte';
	import { toolConfig } from '$lib/stores/tool-config.js';
	import { ToolType } from '$lib/types/tool.js';

	const toolTypeOptions = [
		{ value: ToolType.FlatEnd, label: 'Flat End Mill' },
		{ value: ToolType.BallNose, label: 'Ball Nose' },
		{ value: ToolType.VBit, label: 'V-Bit' }
	];

	function updateType(val: string) {
		toolConfig.update((c) => ({ ...c, type: val as ToolType }));
	}
	function updateDiameter(val: number) {
		toolConfig.update((c) => ({ ...c, diameter: val }));
	}
	function updateAngle(val: number) {
		toolConfig.update((c) => ({ ...c, angle: val }));
	}
</script>

<div class="panel">
	<h3>Tool</h3>
	<SelectInput
		label="Type"
		value={$toolConfig.type}
		options={toolTypeOptions}
		onchange={updateType}
	/>
	<NumberInput
		label="Diameter"
		bind:value={$toolConfig.diameter}
		min={0.1}
		max={50}
		step={0.1}
		unit="mm"
		onchange={updateDiameter}
	/>
	{#if $toolConfig.type === ToolType.VBit}
		<NumberInput
			label="Angle"
			bind:value={$toolConfig.angle}
			min={10}
			max={170}
			step={1}
			unit="deg"
			onchange={updateAngle}
		/>
	{/if}
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
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
</style>
