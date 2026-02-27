<script lang="ts">
	import type { OriginPosition } from '$lib/types/machine.js';

	interface Props {
		value: OriginPosition;
		onchange?: (value: OriginPosition) => void;
		disabled?: boolean;
	}

	let { value = $bindable(), onchange, disabled = false }: Props = $props();

	// Grid rows: back on top (row 0), center (row 1), front on bottom (row 2)
	const rows: OriginPosition[][] = [
		['back-left', 'back-center', 'back-right'],
		['left', 'center', 'right'],
		['front-left', 'front-center', 'front-right']
	];

	function select(pos: OriginPosition) {
		if (disabled) return;
		value = pos;
		onchange?.(pos);
	}
</script>

<div class="origin-selector">
	<span class="label-text">Origin Position</span>
	<div class="grid-wrap" class:disabled>
		<span class="axis-label back">Back</span>
		<div class="grid">
			{#each rows as row}
				<div class="grid-row">
					{#each row as pos}
						<button
							class="dot"
							class:active={value === pos}
							{disabled}
							onclick={() => select(pos)}
							title={pos}
						></button>
					{/each}
				</div>
			{/each}
		</div>
		<span class="axis-label front">Front</span>
	</div>
</div>

<style>
	.origin-selector {
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
	.grid-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.grid-wrap.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
	.axis-label {
		font-size: 0.6rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.grid {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 12px;
		border: 1px solid #444;
		border-radius: 4px;
		background: #2a2a2a;
	}
	.grid-row {
		display: flex;
		gap: 12px;
		justify-content: center;
	}
	.dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid #555;
		background: #1a1a1a;
		cursor: pointer;
		padding: 0;
		transition: all 0.15s;
	}
	.dot:hover:not(:disabled) {
		border-color: #0af;
	}
	.dot.active {
		background: #0af;
		border-color: #0af;
		box-shadow: 0 0 6px rgba(0, 170, 255, 0.5);
	}
	.dot:disabled {
		cursor: not-allowed;
	}
</style>
