<script lang="ts">
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  let issues = $derived(data.metadata.issues.map((message) => ({ message })));
</script>

<svelte:head>
  <title>{data.name} — Dataset Steward</title>
</svelte:head>

<main>
  <a href={resolve('/')}>Back to datasets</a>
  <h1>{data.name}</h1>
  <h2>Supplied metadata</h2>
  <p>Creators require an explicit contributor role of <code>creator</code>. No values are inferred.</p>
  {#if data.metadata.fields.length}
    <dl>
      {#each data.metadata.fields as field (field.label)}
        <dt>{field.label}</dt>
        <dd>{field.values.length ? field.values.join('; ') : 'Not supplied'}</dd>
      {/each}
    </dl>
  {:else}
    <p>Summary unavailable. See validation results and raw text.</p>
  {/if}

  <h2>datapackage.json</h2>
  <p>Read-only text. No files are changed.</p>
  <pre><code>{data.text}</code></pre>

  <h2>Metadata validation</h2>
  <p>Lazydata metadata checks only. Resource files and buckets are not read. These checks do not authorize publication.</p>
  {#if data.metadata.issues.length}
    <p>Metadata checks found issues.</p>
    <ul>
      {#each issues as issue (issue)}
        <li>{issue.message}</li>
      {/each}
    </ul>
  {:else}
    <p>Metadata checks passed.</p>
  {/if}
</main>
