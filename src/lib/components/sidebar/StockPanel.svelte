<script lang="ts">
	import NumberInput from '$lib/components/ui/NumberInput.svelte';
	import OriginSelector from '$lib/components/ui/OriginSelector.svelte';
	import { machineConfig, stockConfig } from '$lib/stores/machine-config.js';
	import { project, hasSvgObjects, hasStlObjects } from '$lib/stores/project.js';

	interface Props {
		disabled?: boolean;
	}

	let { disabled = false }: Props = $props();
</script>

<div class="panel">
	<h3>Stock & Machine</h3>
	<NumberInput
		label="Stock Width"
		bind:value={$stockConfig.width}
		min={1}
		max={2000}
		step={1}
		unit="mm"
		{disabled}
	/>
	<NumberInput
		label="Stock Height"
		bind:value={$stockConfig.height}
		min={1}
		max={2000}
		step={1}
		unit="mm"
		{disabled}
	/>
	<NumberInput
		label="Stock Thickness"
		bind:value={$stockConfig.thickness}
		min={0.1}
		max={200}
		step={0.1}
		unit="mm"
		{disabled}
	/>
	<NumberInput
		label="Safe Z"
		bind:value={$machineConfig.safeZ}
		min={0.5}
		max={50}
		step={0.5}
		unit="mm"
		{disabled}
	/>
	<OriginSelector
		value={$machineConfig.originPosition}
		onchange={(pos) => machineConfig.update(c => ({ ...c, originPosition: pos }))}
		{disabled}
	/>

	{#if $hasSvgObjects}
		<NumberInput
			label="Cut Depth"
			bind:value={$project.cutDepth}
			min={0.1}
			max={50}
			step={0.1}
			unit="mm"
			{disabled}
		/>
	{/if}
	{#if $hasStlObjects}
		<NumberInput
			label="Resolution"
			bind:value={$project.resolution}
			min={0.1}
			max={5}
			step={0.1}
			unit="mm"
			{disabled}
		/>
		<NumberInput
			label="Stepover"
			bind:value={$project.stepover}
			min={0.1}
			max={20}
			step={0.1}
			unit="mm"
			{disabled}
		/>
		<label class="toggle-row">
			<input
				type="checkbox"
				bind:checked={$project.invertedMode}
				{disabled}
			/>
			<span class="toggle-label">Inverted (engrave)</span>
		</label>
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
	.toggle-row {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}
	.toggle-row input[type="checkbox"] {
		accent-color: #0af;
		width: 16px;
		height: 16px;
	}
	.toggle-row input[type="checkbox"]:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
	.toggle-label {
		font-size: 0.8rem;
		color: #ccc;
	}
</style>
