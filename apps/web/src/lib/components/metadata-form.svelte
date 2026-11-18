<script lang="ts">
    import MetadataKeywords from "$lib/components/metadata-keywords.svelte";
    import MetadataResources from "$lib/components/metadata-resources.svelte";
    import MetadataSources from "$lib/components/metadata-sources.svelte";
    import MetadataLicenses from "$lib/components/metadata-licenses.svelte";
    import type { LicenseModel } from "$lib/license-fields.ts";
    import type { SourceModel } from "$lib/source-fields.ts";
    import type { ResourceModel } from "$lib/resource-fields.ts";
    import MetadataVersionCreated from "$lib/components/metadata-version-created.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Field from "$lib/components/ui/field/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Textarea } from "$lib/components/ui/textarea/index.js";

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
        stageOptions,
        issues,
        reloadUrl,
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
        stageOptions: { value: string; label: string }[];
        issues: string[];
        reloadUrl: string;
    } = $props();
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
            >Checks ({issues.length})</Button
        >
    </nav>
    <p class="text-xs text-muted-foreground">Fields marked * are required.</p>
    <Field.Group class="gap-6">
        <Field.Set id={sections[0].id} class="scroll-mt-28 gap-4">
            <Field.Legend class="mb-2">{sections[0].label}</Field.Legend>
            <Field.Group class="grid gap-4 sm:grid-cols-2">
                <Field.Field data-invalid={!name.trim()}>
                    <Field.Label for="metadata-name" required>Name</Field.Label>
                    <Input
                        id="metadata-name"
                        name="name"
                        bind:value={name}
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
                <MetadataVersionCreated {version} {created} />
            </Field.Group>
        </Field.Set>
        <MetadataKeywords {...keywordFields} {stageOptions} />
        <MetadataResources model={resourceModel} countUrl={resourceCountUrl} />
        <MetadataLicenses model={licenseModel} />
        <MetadataSources model={sourceModel} />
    </Field.Group>
    <section
        id="metadata-validation"
        aria-label="Metadata validation"
        class="scroll-mt-28 text-sm"
    >
        <h2 class="mb-2 text-base font-medium">Metadata checks</h2>
        {#if issues.length}
            <p>Metadata checks found issues ({issues.length})</p>
            <ul class="list-disc py-2 pl-5 wrap-anywhere">
                {#each issues as issue, index (`${index}:${issue}`)}
                    <li>{issue}</li>
                {/each}
            </ul>
        {:else}<p class="text-muted-foreground">Metadata checks passed.</p>{/if}
    </section>
    <p class="max-w-prose text-sm text-muted-foreground">
        Shared checks do not read resources or buckets. Resource counts are separate,
        read-only file reads. These checks do not authorize publication.
    </p>
    <div
        class="sticky bottom-0 flex flex-col gap-2 border-t bg-background py-3"
    >
        <p class="text-sm text-muted-foreground">Saving is not implemented.</p>
        <div class="flex flex-wrap items-center gap-2">
            <Button type="button" disabled>Save changes</Button>
            <Button type="button" variant="outline" disabled>Reset form</Button>
            <Button href={reloadUrl} variant="ghost" data-sveltekit-reload
                >Reload file</Button
            >
        </div>
    </div>
</section>
