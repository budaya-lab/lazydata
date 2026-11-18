<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  let issues = $derived(data.metadata.issues.map((message) => ({ message })));
</script>

<svelte:head>
  <title>{data.name} — Dataset Steward</title>
</svelte:head>

<section class="flex min-w-0 flex-col gap-4">
  <h1 class="font-heading text-3xl font-semibold wrap-anywhere">{data.name}</h1>
  <h2 class="font-heading text-xl font-semibold">Supplied metadata</h2>
  <p>Creators require an explicit contributor role of <code>creator</code>. No values are inferred.</p>
  {#if data.metadata.fields.length}
    <dl class="grid grid-cols-[minmax(6rem,1fr)_minmax(0,3fr)] gap-x-6 gap-y-3 wrap-anywhere">
      {#each data.metadata.fields as field (field.label)}
        <dt>{field.label}</dt>
        <dd>{field.values.length ? field.values.join('; ') : 'Not supplied'}</dd>
      {/each}
    </dl>
  {:else}
    <p>Summary unavailable. See validation results and raw text.</p>
  {/if}

  <h2 class="font-heading text-xl font-semibold">datapackage.json</h2>
  <p>Read-only text. No files are changed.</p>
  <pre class="max-w-full overflow-x-auto border bg-muted p-4 text-xs leading-relaxed"><code>{data.text}</code></pre>

  <h2 class="font-heading text-xl font-semibold">Metadata validation</h2>
  <p>Lazydata metadata checks only. Resource files and buckets are not read. These checks do not authorize publication.</p>
  {#if data.metadata.issues.length}
    <p>Metadata checks found issues.</p>
    <ul class="list-disc pl-5 wrap-anywhere">
      {#each issues as issue (issue)}
        <li>{issue.message}</li>
      {/each}
    </ul>
  {:else}
    <p>Metadata checks passed.</p>
  {/if}
</section>
