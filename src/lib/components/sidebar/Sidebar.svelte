<script lang="ts">
	import FileUpload from '$lib/components/ui/FileUpload.svelte';
	import ObjectList from './ObjectList.svelte';
	import ToolPanel from './ToolPanel.svelte';
	import FeedsPanel from './FeedsPanel.svelte';
	import StockPanel from './StockPanel.svelte';
	import ExportPanel from './ExportPanel.svelte';
	import TransformPanel from './TransformPanel.svelte';
	import { project, hasObjects, isLocked } from '$lib/stores/project.js';
	import type { ObjectViewer } from '$lib/components/viewport/stl-controls.js';

	interface Props {
		onfiles?: (files: File[]) => void;
		ongenerate?: () => void;
		onreset?: () => void;
		onselect?: (id: string) => void;
		onremove?: (id: string) => void;
		selectedViewer?: ObjectViewer | null;
	}

	let { onfiles, ongenerate, onreset, onselect, onremove, selectedViewer = null }: Props = $props();
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<h1>SimpleCNC</h1>
		<span class="version">v0.1</span>
	</div>

	<div class="sidebar-content">
		{#if !$hasObjects}
			<FileUpload {onfiles} />
		{:else}
			<ObjectList
				objects={$project.objects}
				selectedId={$project.selectedObjectId}
				{onselect}
				onremove={$isLocked ? undefined : onremove}
			/>
			{#if !$isLocked}
				<FileUpload {onfiles} compact />
				<button class="reset-btn" onclick={() => onreset?.()}>
					Clear All
				</button>
			{/if}
		{/if}

		{#if $hasObjects}
			{#if selectedViewer && !$isLocked}
				<TransformPanel viewer={selectedViewer} />
			{/if}
			<ToolPanel disabled={$isLocked} />
			<FeedsPanel disabled={$isLocked} />
			<StockPanel disabled={$isLocked} />
			<ExportPanel {ongenerate} />
		{/if}
	</div>
</aside>

<style>
	.sidebar {
		width: 300px;
		min-width: 300px;
		background: #1e1e1e;
		border-right: 1px solid #333;
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow-y: auto;
	}
	.sidebar-header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 16px;
		border-bottom: 1px solid #333;
	}
	h1 {
		margin: 0;
		font-size: 1.25rem;
		color: #fff;
	}
	.version {
		font-size: 0.75rem;
		color: #666;
	}
	.sidebar-content {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.reset-btn {
		background: none;
		border: 1px solid #444;
		color: #888;
		padding: 4px 8px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.75rem;
		font-family: inherit;
	}
	.reset-btn:hover {
		border-color: #c33;
		color: #f66;
	}
</style>
