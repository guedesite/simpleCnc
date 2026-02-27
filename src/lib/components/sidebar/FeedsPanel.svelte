<script lang="ts">
	import NumberInput from '$lib/components/ui/NumberInput.svelte';
	import { toolConfig } from '$lib/stores/tool-config.js';

	interface Props {
		disabled?: boolean;
	}

	let { disabled = false }: Props = $props();

	function updateSpindleSpeed(val: number) {
		toolConfig.update((c) => ({ ...c, spindleSpeed: val }));
	}
	function updateFeedRate(val: number) {
		toolConfig.update((c) => ({ ...c, feedRate: val }));
	}
	function updatePlungeRate(val: number) {
		toolConfig.update((c) => ({ ...c, plungeRate: val }));
	}
</script>

<div class="panel">
	<h3>Feeds & Speeds</h3>
	<NumberInput
		label="Spindle Speed"
		bind:value={$toolConfig.spindleSpeed}
		min={100}
		max={60000}
		step={100}
		unit="RPM"
		onchange={updateSpindleSpeed}
		{disabled}
	/>
	<NumberInput
		label="Feed Rate"
		bind:value={$toolConfig.feedRate}
		min={10}
		max={10000}
		step={10}
		unit="mm/min"
		onchange={updateFeedRate}
		{disabled}
	/>
	<NumberInput
		label="Plunge Rate"
		bind:value={$toolConfig.plungeRate}
		min={10}
		max={5000}
		step={10}
		unit="mm/min"
		onchange={updatePlungeRate}
		{disabled}
	/>
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
