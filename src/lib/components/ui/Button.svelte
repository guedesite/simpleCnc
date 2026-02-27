<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'danger';
		disabled?: boolean;
		onclick?: () => void;
		children: Snippet;
	}

	let { variant = 'primary', disabled = false, onclick, children }: Props = $props();
</script>

<button class="btn btn-{variant}" {disabled} {onclick}>
	{@render children()}
</button>

<style>
	.btn {
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s, opacity 0.15s;
		width: 100%;
		font-weight: 600;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn-primary {
		background: #0af;
		color: #000;
	}
	.btn-primary:hover:not(:disabled) {
		background: #0cf;
	}
	.btn-secondary {
		background: #333;
		color: #fff;
		border: 1px solid #555;
	}
	.btn-secondary:hover:not(:disabled) {
		background: #444;
	}
	.btn-danger {
		background: #c33;
		color: #fff;
	}
	.btn-danger:hover:not(:disabled) {
		background: #e44;
	}
</style>
