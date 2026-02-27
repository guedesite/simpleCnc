<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { project, canGenerate, isProcessing, hasGCode } from '$lib/stores/project.js';
	import { exportGCode, parseGCodeStats } from '$lib/engine/gcode/exporter.js';

	interface Props {
		ongenerate?: () => void;
	}

	let { ongenerate }: Props = $props();

	function handleDownload() {
		if ($project.gcode) {
			const objects = $project.objects;
			const baseName =
				objects.length === 1
					? objects[0].name.replace(/\.[^.]+$/, '')
					: 'simplecnc-project';
			exportGCode($project.gcode, `${baseName}.nc`);
		}
	}

	let stats = $derived($project.gcode ? parseGCodeStats($project.gcode) : null);
</script>

<div class="panel">
	<h3>Export</h3>

	{#if $isProcessing}
		<div class="progress">
			<div class="progress-label">{$project.progressStage}</div>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {$project.progressPercent}%"></div>
			</div>
			<div class="progress-pct">{Math.round($project.progressPercent)}%</div>
		</div>
	{/if}

	<Button
		variant="primary"
		disabled={!$canGenerate}
		onclick={ongenerate}
	>
		{#snippet children()}
			{$isProcessing ? 'Processing...' : 'Generate G-code'}
		{/snippet}
	</Button>

	{#if $hasGCode && stats}
		<div class="stats">
			<div class="stat"><span>Lines:</span> <span>{stats.lineCount}</span></div>
			<div class="stat"><span>Rapid moves:</span> <span>{stats.rapidMoves}</span></div>
			<div class="stat"><span>Linear moves:</span> <span>{stats.linearMoves}</span></div>
		</div>

		<Button variant="secondary" onclick={handleDownload}>
			{#snippet children()}
				Download G-code
			{/snippet}
		</Button>
	{/if}

	{#if $project.workflowState === 'error'}
		<div class="error">{$project.errorMessage}</div>
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
	.progress {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.progress-label {
		font-size: 0.75rem;
		color: #aaa;
	}
	.progress-bar {
		height: 6px;
		background: #333;
		border-radius: 3px;
		overflow: hidden;
	}
	.progress-fill {
		height: 100%;
		background: #0af;
		border-radius: 3px;
		transition: width 0.2s;
	}
	.progress-pct {
		font-size: 0.75rem;
		color: #888;
		text-align: right;
	}
	.stats {
		font-size: 0.75rem;
		color: #aaa;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px;
		background: #1a1a1a;
		border-radius: 4px;
	}
	.stat {
		display: flex;
		justify-content: space-between;
	}
	.error {
		padding: 8px;
		background: rgba(204, 51, 51, 0.2);
		border: 1px solid #c33;
		border-radius: 4px;
		font-size: 0.75rem;
		color: #f66;
	}
</style>
