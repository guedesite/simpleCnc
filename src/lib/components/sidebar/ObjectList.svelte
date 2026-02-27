<script lang="ts">
	import type { ProjectObject } from '$lib/types/project-object.js';

	interface Props {
		objects: ProjectObject[];
		selectedId: string | null;
		onselect?: (id: string) => void;
		onremove?: (id: string) => void;
	}

	let { objects, selectedId, onselect, onremove }: Props = $props();
</script>

<div class="panel">
	<h3>Objects</h3>
	<div class="object-list">
		{#each objects as obj (obj.id)}
			<div
				class="object-item"
				class:selected={obj.id === selectedId}
				role="button"
				tabindex="0"
				onclick={() => onselect?.(obj.id)}
				onkeydown={(e) => { if (e.key === 'Enter') onselect?.(obj.id); }}
			>
				<span class="object-name">{obj.name}</span>
				<span class="object-type">{obj.type.toUpperCase()}</span>
				<button
					class="remove-btn"
					onclick={(e) => { e.stopPropagation(); onremove?.(obj.id); }}
					title="Remove"
				>&times;</button>
			</div>
		{/each}
	</div>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 8px;
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
	.object-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.object-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: #2a2a2a;
		border: 1px solid transparent;
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
		text-align: left;
		transition: all 0.15s;
		color: #ccc;
	}
	.object-item:hover {
		background: #333;
	}
	.object-item.selected {
		border-color: #0af;
		background: rgba(0, 170, 255, 0.1);
	}
	.object-name {
		flex: 1;
		font-size: 0.8rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.object-type {
		font-size: 0.6rem;
		padding: 1px 5px;
		background: #0af;
		color: #000;
		border-radius: 2px;
		font-weight: 700;
		flex-shrink: 0;
	}
	.remove-btn {
		background: none;
		border: none;
		color: #666;
		cursor: pointer;
		font-size: 1rem;
		padding: 0 2px;
		line-height: 1;
		flex-shrink: 0;
	}
	.remove-btn:hover {
		color: #f66;
	}
</style>
