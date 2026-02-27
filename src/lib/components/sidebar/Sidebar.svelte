<script lang="ts">
	import FileUpload from '$lib/components/ui/FileUpload.svelte';
	import ToolPanel from './ToolPanel.svelte';
	import FeedsPanel from './FeedsPanel.svelte';
	import StockPanel from './StockPanel.svelte';
	import ExportPanel from './ExportPanel.svelte';
	import TransformPanel from './TransformPanel.svelte';
	import { project, hasFile } from '$lib/stores/project.js';
	import type { StlViewer } from '$lib/components/viewport/stl-controls.js';

	interface Props {
		onfile?: (file: File) => void;
		ongenerate?: () => void;
		onreset?: () => void;
		stlViewer?: StlViewer | null;
	}

	let { onfile, ongenerate, onreset, stlViewer = null }: Props = $props();
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<h1>SimpleCNC</h1>
		<span class="version">v0.1</span>
	</div>

	<div class="sidebar-content">
		{#if !$hasFile}
			<FileUpload {onfile} />
		{:else}
			<div class="file-info">
				<span class="file-name">{$project.fileName}</span>
				<span class="file-type">{$project.fileType?.toUpperCase()}</span>
			</div>
			<button class="reset-btn" onclick={() => onreset?.()}>
				Change file
			</button>
		{/if}

		{#if $hasFile}
			{#if $project.fileType === 'stl' && stlViewer}
				<TransformPanel {stlViewer} />
			{/if}
			<ToolPanel />
			<FeedsPanel />
			<StockPanel />
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
	.file-info {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: #2a2a2a;
		border-radius: 4px;
	}
	.file-name {
		flex: 1;
		font-size: 0.875rem;
		color: #fff;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.file-type {
		font-size: 0.625rem;
		padding: 2px 6px;
		background: #0af;
		color: #000;
		border-radius: 2px;
		font-weight: 700;
	}
	.reset-btn {
		background: none;
		border: 1px solid #444;
		color: #888;
		padding: 4px 8px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.75rem;
	}
	.reset-btn:hover {
		border-color: #666;
		color: #aaa;
	}
</style>
