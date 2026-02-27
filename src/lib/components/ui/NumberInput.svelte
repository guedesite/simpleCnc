<script lang="ts">
	interface Props {
		label: string;
		value: number;
		min?: number;
		max?: number;
		step?: number;
		unit?: string;
		disabled?: boolean;
		onchange?: (value: number) => void;
	}

	let { label, value = $bindable(), min = 0, max = 99999, step = 1, unit = '', disabled = false, onchange }: Props = $props();

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const newVal = parseFloat(target.value);
		if (!isNaN(newVal)) {
			value = newVal;
			onchange?.(newVal);
		}
	}
</script>

<label class="number-input">
	<span class="label-text">{label}</span>
	<div class="input-wrap">
		<input
			type="number"
			{min}
			{max}
			{step}
			{value}
			{disabled}
			oninput={handleInput}
		/>
		{#if unit}
			<span class="unit">{unit}</span>
		{/if}
	</div>
</label>

<style>
	.number-input {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.label-text {
		font-size: 0.75rem;
		color: #aaa;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.input-wrap {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	input {
		width: 100%;
		padding: 6px 8px;
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 4px;
		color: #fff;
		font-size: 0.875rem;
		font-family: inherit;
	}
	input:focus {
		outline: none;
		border-color: #0af;
	}
	input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.unit {
		font-size: 0.75rem;
		color: #888;
		white-space: nowrap;
	}
</style>
