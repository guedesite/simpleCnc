<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		label: string;
		value: string;
		options: Option[];
		onchange?: (value: string) => void;
	}

	let { label, value = $bindable(), options, onchange }: Props = $props();

	function handleChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		value = target.value;
		onchange?.(target.value);
	}
</script>

<label class="select-input">
	<span class="label-text">{label}</span>
	<select {value} onchange={handleChange}>
		{#each options as opt}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
</label>

<style>
	.select-input {
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
	select {
		width: 100%;
		padding: 6px 8px;
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 4px;
		color: #fff;
		font-size: 0.875rem;
		font-family: inherit;
		cursor: pointer;
	}
	select:focus {
		outline: none;
		border-color: #0af;
	}
</style>
