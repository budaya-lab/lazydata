<script lang="ts">
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Dataset Steward — Lazydata</title>
</svelte:head>

<main>
  <h1>Datasets</h1>
  <p>Metadata checks only. Resource files and buckets are not read. Select a dataset for details.</p>
  {#if data.datasets.length}
    <ul>
      {#each data.datasets as dataset (dataset.name)}
        <li><a href={resolve('/datasets/[name]', { name: encodeURIComponent(dataset.name) })}>{dataset.name}</a>
          {#if dataset.status === 'unavailable'}
            — Metadata unavailable: {dataset.message}
          {:else if dataset.status === 'issues'}
            — Metadata issues ({dataset.issueCount})
          {:else}
            — Metadata checks passed
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p>No ds-* folders found in the configured parent directory.</p>
  {/if}
</main>
