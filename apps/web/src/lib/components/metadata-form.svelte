<script lang="ts">
    import { onDestroy } from "svelte";
    import MetadataContributors from "$lib/components/metadata-contributors.svelte";
    import MetadataKeywords from "$lib/components/metadata-keywords.svelte";
    import MetadataLicenses from "$lib/components/metadata-licenses.svelte";
    import MetadataResources from "$lib/components/metadata-resources.svelte";
    import MetadataSources from "$lib/components/metadata-sources.svelte";
    import MetadataVersionCreated from "$lib/components/metadata-version-created.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Field from "$lib/components/ui/field/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Textarea } from "$lib/components/ui/textarea/index.js";
    import type { ContributorModel } from "$lib/contributor-fields.ts";
    import { type CheckState, createDraftChecker } from "$lib/draft-checker.ts";
    import { type DraftChanges, draftIssues } from "$lib/draft-checks.ts";
    import { MetadataDraft, MetadataDraftError } from "$lib/metadata-draft.ts";
    import type { LicenseModel } from "$lib/license-fields.ts";
    import type { ResourceModel } from "$lib/resource-fields.ts";
    import type { SourceModel } from "$lib/source-fields.ts";

    let {
        name,
        title,
        description,
        version,
        created,
        keywordFields,
        resourceModel,
        resourceCountUrl,
        sourceModel,
        licenseModel,
        contributorModel,
        stageOptions,
        issues,
        draft,
        reloadUrl,
        saveUrl,
        datasetId,
        ondraft,
    }: {
        name: string;
        title: string;
        description: string;
        version: string | null;
        created: string | null;
        keywordFields: {
            tasks: string[];
            projects: string[];
            stage: string;
            extraKeywords: string[];
        };
        resourceModel: ResourceModel;
        resourceCountUrl: string;
        sourceModel: SourceModel;
        licenseModel: LicenseModel;
        contributorModel: ContributorModel;
        stageOptions: { value: string; label: string }[];
        issues: string[];
        draft: MetadataDraft;
        reloadUrl: string;
        saveUrl: string;
        datasetId: string;
        ondraft: (datasetId: string, error: string) => void;
    } = $props();
    let checkState = $derived<CheckState>({ pending: false, issues });
    let dateError = "";
    let pendingDate = false;
    const failedFields: Record<string, string> = {};
    let syncError = $state("");
    let dirty = $state(false);
    let saving = $state(false);
    let saveMessage = $state("");
    let saveError = $state("");
    let disposed = false;
    const checker = createDraftChecker<{ text: string; dateError?: string }>(
        (draft) => draftIssues(draft.text, draft.dateError),
        (state) => {
            checkState = state;
        },
    );
    onDestroy(() => { disposed = true; checker.dispose(); });

    async function save() {
        if (saving || syncError || !dirty) return;
        const text = draft.text();
        saving = true;
        saveMessage = "";
        saveError = "";
        try {
            const response = await fetch(saveUrl, {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: text,
            });
            const result: unknown = await response.json();
            if (disposed) return;
            if (typeof result !== 'object' || result === null || !('status' in result)) throw new Error('Invalid Save response.');
            if (!response.ok || result.status !== 'saved') {
                saveError = 'message' in result && typeof result.message === 'string' ? result.message : 'Save could not be confirmed. Your draft is retained.';
                return;
            }
            draft.markSaved(text);
            dirty = draft.dirty;
            ondraft(datasetId, syncError);
            saveMessage = dirty || syncError ? 'Saved submitted changes. Newer edits are still unsaved.' : 'Saved.';
        } catch (cause) {
            console.error('Metadata Save request failed.', cause);
            if (!disposed) saveError = 'Save could not be confirmed. Your draft is retained. Retry Save or reload to check the file.';
        } finally {
            if (!disposed) saving = false;
        }
    }

    function edit(patch: DraftChanges) {
        saveMessage = "";
        saveError = "";
        if (patch.overview?.createdError !== undefined) dateError = patch.overview.createdError;
        if (patch.overview && Object.hasOwn(patch.overview, 'created')) pendingDate = !!dateError;
        const fields = Object.entries(patch).flatMap(([section, values]) =>
            section === 'licenseIds' ? [] : section === 'overview' || section === 'keywords'
                ? Object.keys(values).filter((key) => key !== 'createdError').map((key) => `${section}.${key}`)
                : [section]);
        try {
            draft.update(patch);
            for (const field of fields) delete failedFields[field];
        } catch (cause) {
            if (!(cause instanceof MetadataDraftError)) throw cause;
            for (const field of fields) failedFields[field] = cause.message;
        }
        syncError = [...new Set(Object.values(failedFields)), ...(pendingDate
            ? ['The partial Created date is retained in the form but cannot be represented in JSON.'] : [])].join(' ');
        dirty = draft.dirty;
        ondraft(datasetId, syncError);
        checker.schedule({ text: draft.text(), dateError });
    }

    const sections = [
        { id: "metadata-overview", label: "Overview" },
        { id: "root/keywords", label: "Keywords" },
        { id: "root/resources", label: "Resources" },
        { id: "root/contributors", label: "Contributors" },
        { id: "root/licenses", label: "Licenses" },
        { id: "root/sources", label: "Sources" },
    ];
</script>

<section
    aria-label="Metadata form"
    data-form-style="outlined"
    class="flex w-full min-w-0 max-w-3xl flex-col gap-4"
>
    <nav
        aria-label="Metadata sections"
        class="sticky top-0 z-10 flex flex-wrap gap-1 border-b bg-background py-2"
    >
        {#each sections as section (section.id)}
            <Button href={`#${section.id}`} variant="ghost" size="sm"
                >{section.label}</Button
            >
        {/each}
        <Button href="#metadata-validation" variant="ghost" size="sm"
            >Issues ({checkState.pending
                ? "…"
                : checkState.issues.length})</Button
        >
    </nav>
    <p class="text-xs text-muted-foreground">Fields marked * are required.</p>
    {#if syncError}
        <p role="alert" class="text-sm text-destructive">JSON preview could not include this edit: {syncError} Your input is retained; nothing is saved.</p>
    {/if}
    <Field.Group class="gap-6">
        <Field.Set id={sections[0].id} class="scroll-mt-28 gap-4">
            <Field.Legend class="mb-2">{sections[0].label}</Field.Legend>
            <Field.Group class="grid gap-4 sm:grid-cols-2">
                <Field.Field data-invalid={!name.trim()}>
                    <Field.Label for="metadata-name" required>Name</Field.Label>
                    <Input
                        id="metadata-name"
                        name="dataset-id"
                        bind:value={name}
                        oninput={(event) =>
                            edit({
                                overview: { name: event.currentTarget.value },
                            })}
                        required
                        aria-invalid={!name.trim()}
                        aria-describedby={!name.trim()
                            ? "metadata-name-error"
                            : undefined}
                    />
                    {#if !name.trim()}
                        <Field.Error class="text-xs" id="metadata-name-error"
                            >Name is required.</Field.Error
                        >
                    {/if}
                </Field.Field>
                <Field.Field data-invalid={!title.trim()}>
                    <Field.Label for="metadata-title" required
                        >Title</Field.Label
                    >
                    <Input
                        id="metadata-title"
                        name="title"
                        bind:value={title}
                        oninput={(event) =>
                            edit({
                                overview: { title: event.currentTarget.value },
                            })}
                        required
                        aria-invalid={!title.trim()}
                        aria-describedby={!title.trim()
                            ? "metadata-title-error"
                            : undefined}
                    />
                    {#if !title.trim()}
                        <Field.Error class="text-xs" id="metadata-title-error"
                            >Title is required.</Field.Error
                        >
                    {/if}
                </Field.Field>
                <Field.Field
                    class="sm:col-span-2"
                    data-invalid={!description.trim()}
                >
                    <Field.Label for="metadata-description" required
                        >Description</Field.Label
                    >
                    <Textarea
                        id="metadata-description"
                        name="description"
                        bind:value={description}
                        oninput={(event) =>
                            edit({
                                overview: {
                                    description: event.currentTarget.value,
                                },
                            })}
                        required
                        aria-invalid={!description.trim()}
                        aria-describedby={!description.trim()
                            ? "metadata-description-error"
                            : undefined}
                    />
                    {#if !description.trim()}
                        <Field.Error
                            class="text-xs"
                            id="metadata-description-error"
                            >Description is required.</Field.Error
                        >
                    {/if}
                </Field.Field>
                <MetadataVersionCreated
                    {version}
                    {created}
                    onedit={(overview) => edit({ overview })}
                />
            </Field.Group>
        </Field.Set>
        <MetadataKeywords
            {...keywordFields}
            {stageOptions}
            onedit={(keywords) => edit({ keywords })}
        />
        <MetadataResources
            model={resourceModel}
            countUrl={resourceCountUrl}
            onedit={(resources) => edit({ resources })}
        />
        <MetadataContributors
            model={contributorModel}
            onedit={(contributors) => edit({ contributors })}
        />
        <MetadataLicenses
            model={licenseModel}
            onedit={(licenses, licenseIds) => edit({ licenses, licenseIds })}
        />
        <MetadataSources
            model={sourceModel}
            onedit={(sources) => edit({ sources })}
        />
    </Field.Group>
    <section
        id="metadata-validation"
        aria-label="Metadata validation"
        aria-busy={checkState.pending}
        class="scroll-mt-28 text-sm"
    >
        <h2 class="mb-2 text-base font-medium">Metadata checks</h2>
        <p class="mb-2 text-xs text-muted-foreground">
            Checks inspect the JSON draft 500 ms after edits. Changes are not saved.
        </p>
        <p role="status" aria-live="polite" class="text-muted-foreground">
            {#if checkState.pending}Checking…
            {:else if checkState.issues.length}Metadata checks found issues ({checkState
                    .issues.length})
            {:else}Metadata checks passed.{/if}
        </p>
        {#if !checkState.pending && checkState.issues.length}
            <ul class="list-disc py-2 pl-5 wrap-anywhere">
                {#each checkState.issues as issue, index (`${index}:${issue}`)}
                    <li>{issue}</li>
                {/each}
            </ul>
        {/if}
    </section>
    <p class="max-w-prose text-sm text-muted-foreground">
        Shared checks do not read resources or buckets. Resource counts are
        separate, read-only file reads. These checks do not authorize
        publication.
    </p>
    <div
        class="sticky bottom-0 flex flex-col gap-2 border-t bg-background py-3"
    >
        <p role="status" aria-live="polite" class="text-sm text-muted-foreground">
            {saving ? 'Saving…' : saveMessage || (dirty || syncError ? 'Unsaved changes.' : 'No unsaved changes.')}
        </p>
        {#if saveError}<p role="alert" class="text-sm text-destructive">{saveError}</p>{/if}
        <div class="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={saving || !!syncError || !dirty} onclick={save}>Save changes</Button>
            <Button type="button" variant="outline" disabled>Reset form</Button>
            <Button href={reloadUrl} variant="ghost" data-sveltekit-reload
                >Reload file</Button
            >
        </div>
    </div>
</section>
