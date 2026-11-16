<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Dataset Steward — Lazydata</title>
</svelte:head>

<main>
  <h1>Datasets</h1>
  <p>Read-only dataset discovery.</p>
  {#if data.datasets.length}
    <ul>
      {#each data.datasets as name (name)}
        <li>{name}</li>
      {/each}
    </ul>
  {:else}
    <p>No ds-* folders found in the configured parent directory.</p>
  {/if}
</main>
