<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>SimpleCNC - CAM Software</title>
</svelte:head>

<div class="app">
	{@render children()}
</div>

<style>
	.app {
		display: flex;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
	}
</style>
