<script lang="ts">
    import { resolve } from "$app/paths";
    import { afterNavigate, beforeNavigate, goto } from "$app/navigation";
    import { page } from "$app/state";
    import { untrack } from "svelte";
    import { receiveMetadataSession, updateMetadataSession, type MetadataSession } from "$lib/metadata-session.ts";
    import ReadmeBody from "$lib/components/readme-body.svelte";
    import MetadataForm from "$lib/components/metadata-form.svelte";
    import * as Alert from "$lib/components/ui/alert/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();
    let datasetUrl = $derived(
        resolve("/datasets/[name]", { name: encodeURIComponent(data.name) }),
    );
    type MetadataData = Extract<PageProps['data'], { view: 'metadata' }>;
    let session = $state.raw<MetadataSession<MetadataData> | null>(untrack(() =>
        receiveMetadataSession(null, data.name, data.view === 'metadata' ? data : undefined)));
    let active = $derived(session?.metadata.name === data.name ? session : null);
    let baseline = $derived(active?.metadata ?? null);
    let draft = $derived(active?.draft ?? null);
    let view = $derived(page.shallow?.url.searchParams.get('view') ?? data.view);
    let jsonText = $derived(active?.draft?.text() ?? baseline?.metadataText ?? (data.view === 'datapackage' ? data.text : ''));
    // Router loads change for each view; capture a metadata baseline only once per dataset.
    afterNavigate(() => {
        session = receiveMetadataSession(session, data.name, data.view === 'metadata' ? data : undefined);
    });
    function updateDraft(name: string, error: string) {
        session = updateMetadataSession(session, name, error);
    }
    async function switchView(event: MouseEvent, target: 'metadata' | 'datapackage') {
        if (!active || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        await goto(resolve(`/datasets/[name]?view=${target}`, { name: encodeURIComponent(data.name) }), { shallow: true, reset: true });
    }
    beforeNavigate((navigation) => {
        if (!session?.draft || (!session.draft.dirty && !session.error)) return;
        if (!navigation.willUnload && navigation.to?.url.pathname === navigation.from?.url.pathname) return;
        if (navigation.type === 'leave') navigation.cancel();
        else if (!window.confirm('Discard unsaved metadata changes?')) navigation.cancel();
    });
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
            variant={view === "readme" ? "secondary" : "ghost"}
            aria-current={view === "readme" ? "page" : undefined}
            >README</Button
        >
        <Button
            href={`${datasetUrl}?view=metadata`}
            variant={view === "metadata" ? "secondary" : "ghost"}
            aria-current={view === "metadata" ? "page" : undefined}
            onclick={(event) => switchView(event, 'metadata')}
            >Metadata</Button
        >
        <Button
            href={`${datasetUrl}?view=datapackage`}
            variant={view === "datapackage" ? "secondary" : "ghost"}
            aria-current={view === "datapackage" ? "page" : undefined}
            onclick={(event) => switchView(event, 'datapackage')}
            >datapackage.json</Button
        >
    </nav>
    {#if baseline}
        {#key baseline.name}
            <div hidden={view !== 'metadata'}>
                {#if draft}
                    <MetadataForm {...baseline.overview} keywordFields={baseline.keywordFields} resourceModel={baseline.resourceModel} resourceCountUrl={`${datasetUrl}/resources`} sourceModel={baseline.sourceModel} licenseModel={baseline.licenseModel} contributorModel={baseline.contributorModel} stageOptions={baseline.stageOptions} issues={baseline.issues} {draft} reloadUrl={`${datasetUrl}?view=metadata`} datasetId={baseline.name} ondraft={updateDraft} />
                {:else}
                    <p role="alert">Safe metadata editing is unavailable: {active?.error} The original JSON is still available in datapackage.json.</p>
                    {#if baseline.issues.length}
                        <ul aria-label="Metadata validation" class="list-disc pl-5">
                            {#each baseline.issues as issue, index (`${index}:${issue}`)}<li>{issue}</li>{/each}
                        </ul>
                    {/if}
                {/if}
            </div>
        {/key}
    {/if}
    {#if view === "readme" && data.view === "readme"}
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
    {:else if view === "datapackage"}
        <h2 class="font-heading text-xl font-semibold">datapackage.json</h2>
        <p>Read-only JSON preview. Metadata edits appear here without saving.</p>
        {#if active?.error}
            <p role="alert" class="text-sm text-destructive">Some form edits could not be represented: {active.error} This shows the last representable draft. Return to Metadata to resolve them.</p>
        {/if}
        <pre
            class="max-w-full overflow-x-auto border bg-muted p-4 text-xs leading-relaxed"><code
                >{jsonText}</code
            ></pre>
    {/if}
</section>
