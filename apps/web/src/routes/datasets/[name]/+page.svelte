<script lang="ts">
    import { resolve } from "$app/paths";
    import ReadmeBody from "$lib/components/readme-body.svelte";
    import * as Alert from "$lib/components/ui/alert/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();
    let issues = $derived(
        data.view === "metadata"
            ? data.metadata.issues.map((message) => ({ message }))
            : [],
    );
    let datasetUrl = $derived(
        resolve("/datasets/[name]", { name: encodeURIComponent(data.name) }),
    );
</script>

<svelte:head>
    <title>{data.name} — Dataset Steward</title>
</svelte:head>

<section class="flex min-w-0 flex-col gap-4">
    <h1 class="font-heading text-3xl font-semibold wrap-anywhere">
        {data.name}
    </h1>
    <nav aria-label="Dataset sections" class="flex flex-wrap gap-2">
        <Button
            href={datasetUrl}
            variant={data.view === "readme" ? "secondary" : "ghost"}
            aria-current={data.view === "readme" ? "page" : undefined}
            >README</Button
        >
        <Button
            href={`${datasetUrl}?view=metadata`}
            variant={data.view === "metadata" ? "secondary" : "ghost"}
            aria-current={data.view === "metadata" ? "page" : undefined}
            >Metadata</Button
        >
    </nav>
    {#if data.view === "readme"}
        {#if data.readme.status === "unavailable"}
            <Alert.Root>
                <Alert.Title>README unavailable</Alert.Title>
                <Alert.Description
                    >{data.readme.message} You can still open Metadata.</Alert.Description
                >
            </Alert.Root>
        {:else}
            {#if data.readme.template}
                <Alert.Root>
                    <Alert.Title>Template README</Alert.Title>
                    <Alert.Description
                        >This README is unchanged from a reviewed tpl-dataset
                        template. Replace it with dataset-specific
                        documentation.</Alert.Description
                    >
                </Alert.Root>
            {/if}
            <p class="text-xs text-muted-foreground">
                Read-only README.md. Embedded HTML and image loading are
                disabled. Only credential-free HTTPS links are clickable.
            </p>
            {#if data.readme.empty}
                <p>README.md is empty.</p>
            {:else}
                <ReadmeBody nodes={data.readme.nodes} />
            {/if}
        {/if}
    {:else}
        <h2 class="font-heading text-xl font-semibold">Supplied metadata</h2>
        <p>
            Creators require an explicit contributor role of <code>creator</code
            >. No values are inferred.
        </p>
        {#if data.metadata.fields.length}
            <dl
                class="grid grid-cols-[minmax(6rem,1fr)_minmax(0,3fr)] gap-x-6 gap-y-3 wrap-anywhere"
            >
                {#each data.metadata.fields as field (field.label)}
                    <dt>{field.label}</dt>
                    <dd>
                        {field.values.length
                            ? field.values.join("; ")
                            : "Not supplied"}
                    </dd>
                {/each}
            </dl>
        {:else}
            <p>Summary unavailable. See validation results and raw text.</p>
        {/if}

        <h2 class="font-heading text-xl font-semibold">datapackage.json</h2>
        <p>Read-only text. No files are changed.</p>
        <pre
            class="max-w-full overflow-x-auto border bg-muted p-4 text-xs leading-relaxed"><code
                >{data.text}</code
            ></pre>

        <h2 class="font-heading text-xl font-semibold">Metadata validation</h2>
        <p>
            Lazydata metadata checks only. Resource files and buckets are not
            read. These checks do not authorize publication.
        </p>
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
    {/if}
</section>
