<script lang="ts">
	interface Props {
		accept?: string;
		onfiles?: (files: File[]) => void;
		compact?: boolean;
	}

	let { accept = '.svg,.stl', onfiles, compact = false }: Props = $props();

	let dragging = $state(false);
	let inputEl: HTMLInputElement;

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragging = true;
	}

	function handleDragLeave() {
		dragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			onfiles?.(Array.from(files));
		}
	}

	function handleClick() {
		inputEl?.click();
	}

	function handleInputChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			onfiles?.(Array.from(target.files));
			target.value = '';
		}
	}
</script>

{#if compact}
	<button class="compact-upload" onclick={handleClick}>
		+ Add files
		<input
			bind:this={inputEl}
			type="file"
			{accept}
			multiple
			onchange={handleInputChange}
			hidden
		/>
	</button>
{:else}
	<div
		class="file-upload"
		class:dragging
		role="button"
		tabindex="0"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		onclick={handleClick}
		onkeydown={(e) => { if (e.key === 'Enter') handleClick(); }}
	>
		<input
			bind:this={inputEl}
			type="file"
			{accept}
			multiple
			onchange={handleInputChange}
			hidden
		/>
		<div class="upload-content">
			<div class="upload-icon">+</div>
			<p>Drop SVG or STL files here</p>
			<p class="small">or click to browse</p>
		</div>
	</div>
{/if}

<style>
	.file-upload {
		border: 2px dashed #444;
		border-radius: 8px;
		padding: 24px;
		text-align: center;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}
	.file-upload:hover, .file-upload.dragging {
		border-color: #0af;
		background: rgba(0, 170, 255, 0.05);
	}
	.upload-icon {
		font-size: 2rem;
		color: #666;
		margin-bottom: 8px;
	}
	p {
		margin: 4px 0;
		color: #aaa;
		font-size: 0.875rem;
	}
	.small {
		font-size: 0.75rem;
		color: #666;
	}
	.compact-upload {
		width: 100%;
		padding: 8px 12px;
		background: none;
		border: 1px dashed #444;
		border-radius: 4px;
		color: #888;
		cursor: pointer;
		font-size: 0.8rem;
		font-family: inherit;
		transition: all 0.15s;
	}
	.compact-upload:hover {
		border-color: #0af;
		color: #0af;
	}
</style>
