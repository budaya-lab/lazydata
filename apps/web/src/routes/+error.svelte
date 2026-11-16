<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:options runes={true} />

<svelte:head>
  <title>Dataset discovery error — Lazydata</title>
</svelte:head>

<main>
  <h1>Dataset discovery error</h1>
  <p>{page.error?.message}</p>
</main>
