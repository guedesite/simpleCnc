<script lang="ts">
	import NumberInput from '$lib/components/ui/NumberInput.svelte';
	import { machineConfig, stockConfig } from '$lib/stores/machine-config.js';
	import { project, hasSvgObjects, hasStlObjects } from '$lib/stores/project.js';
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
	/>
	<NumberInput
		label="Stock Height"
		bind:value={$stockConfig.height}
		min={1}
		max={2000}
		step={1}
		unit="mm"
	/>
	<NumberInput
		label="Stock Thickness"
		bind:value={$stockConfig.thickness}
		min={0.1}
		max={200}
		step={0.1}
		unit="mm"
	/>
	<NumberInput
		label="Safe Z"
		bind:value={$machineConfig.safeZ}
		min={0.5}
		max={50}
		step={0.5}
		unit="mm"
	/>
	<NumberInput
		label="Origin X"
		bind:value={$machineConfig.originX}
		min={-1000}
		max={1000}
		step={0.1}
		unit="mm"
	/>
	<NumberInput
		label="Origin Y"
		bind:value={$machineConfig.originY}
		min={-1000}
		max={1000}
		step={0.1}
		unit="mm"
	/>

	{#if $hasSvgObjects}
		<NumberInput
			label="Cut Depth"
			bind:value={$project.cutDepth}
			min={0.1}
			max={50}
			step={0.1}
			unit="mm"
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
		/>
		<NumberInput
			label="Stepover"
			bind:value={$project.stepover}
			min={0.1}
			max={20}
			step={0.1}
			unit="mm"
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
