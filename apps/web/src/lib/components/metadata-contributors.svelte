<script lang="ts">
    import XIcon from "@lucide/svelte/icons/x";
    import { tick } from "svelte";
    import type { DraftRow } from "$lib/draft-checks.ts";
    import MetadataTags from "$lib/components/metadata-tags.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Field from "$lib/components/ui/field/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import {
        CONTRIBUTOR_ROLE_PRESETS,
        MAX_CONTRIBUTOR_ROWS,
        type ContributorFields,
        type ContributorModel,
        contributorFieldIssues,
    } from "$lib/contributor-fields.ts";

    let { model, onedit }: {
        model: ContributorModel;
        onedit: (rows: DraftRow<ContributorFields>[]) => void;
    } = $props();
    type Row = { id: number; fields: ContributorFields };
    let rows = $derived<Row[]>(model.rows.map((fields, id) => ({ id, fields })));
    let nextId = MAX_CONTRIBUTOR_ROWS;
    let container = $state<HTMLFieldSetElement | null>(null);
    let addButton = $state<HTMLButtonElement | null>(null);
    let announcement = $state("");
    const uid = $props.id();

    function update(id: number, fields: Partial<ContributorFields>) {
        rows = rows.map((row) =>
            row.id === id ? { ...row, fields: { ...row.fields, ...fields } } : row,
        );
        onedit(rows);
    }

    async function add() {
        rows = [...rows, { id: nextId++, fields: { title: "", roles: [] } }];
        onedit(rows);
        announcement = "Contributor added.";
        await tick();
        container
            ?.querySelectorAll<HTMLInputElement>('input[name$="-title"]')
            .item(rows.length - 1)
            ?.focus();
    }

    async function remove(id: number) {
        const index = rows.findIndex((row) => row.id === id);
        rows = rows.filter((row) => row.id !== id);
        onedit(rows);
        announcement = "Contributor removed.";
        await tick();
        const input = container
            ?.querySelectorAll<HTMLInputElement>('input[name$="-title"]')
            .item(Math.min(index, rows.length - 1));
        if (input) input.focus();
        else addButton?.focus();
    }
</script>

<Field.Set
    id="root/contributors"
    aria-label="Contributors"
    class="scroll-mt-28 gap-4"
    bind:ref={container}
>
    <Field.Legend class="mb-2">Contributors</Field.Legend>
    <Field.Description id="metadata-contributors-help" class="text-xs">
        Add a name and optional roles. Press Enter or comma to add a role;
        suggestions and custom roles are supported.
    </Field.Description>
    {#if model.message}
        <p role="status" class="text-sm wrap-anywhere">{model.message}</p>
    {/if}
    <Field.Group class="gap-4">
        {#each rows as row, index (row.id)}
            {@const issues = contributorFieldIssues(row.fields)}
            <Field.Set aria-label={`Contributor ${index + 1}`} class="gap-3">
                <Field.Group
                    class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_2rem]"
                >
                    <Field.Field data-invalid={Boolean(issues.title)}>
                        <Field.Label for={`${uid}-${row.id}-title`} required
                            >Name</Field.Label
                        >
                        <Input
                            id={`${uid}-${row.id}-title`}
                            name={`contributor-${row.id}-title`}
                            value={row.fields.title ?? ""}
                            required
                            aria-invalid={Boolean(issues.title)}
                            aria-describedby={issues.title
                                ? `${uid}-${row.id}-title-error`
                                : undefined}
                            oninput={(event) =>
                                update(row.id, { title: event.currentTarget.value })}
                        />
                        {#if issues.title}
                            <Field.Error
                                class="text-xs"
                                id={`${uid}-${row.id}-title-error`}
                                >{issues.title}</Field.Error
                            >
                        {/if}
                    </Field.Field>
                    <MetadataTags
                        id={`contributor-${row.id}-roles`}
                        label="Roles"
                        bind:value={
                            () => row.fields.roles ?? [],
                            (roles) => update(row.id, { roles })
                        }
                        onedit={(roles) => onedit(rows.map((current) => current.id === row.id
                            ? { ...current, fields: { ...current.fields, roles } } : current))}
                        suggestions={CONTRIBUTOR_ROLE_PRESETS}
                        helpId="metadata-contributors-help"
                        validationMessage={issues.roles}
                    />
                    <Field.Field>
                        <Field.Label
                            for={`${uid}-${row.id}-remove`}
                            aria-hidden="true"
                            class="pointer-events-none hidden sm:flex"
                            >&#160;</Field.Label
                        >
                        <div class="flex h-8 items-center">
                            <Button
                                id={`${uid}-${row.id}-remove`}
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Remove contributor ${row.fields.title || index + 1}`}
                                onclick={() => remove(row.id)}><XIcon /></Button
                            >
                        </div>
                    </Field.Field>
                </Field.Group>
            </Field.Set>
        {:else}
            <p class="text-sm text-muted-foreground">No contributors yet.</p>
        {/each}
    </Field.Group>
    <div>
        <Button
            type="button"
            variant="outline"
            size="sm"
            bind:ref={addButton}
            onclick={add}
            disabled={rows.length >= MAX_CONTRIBUTOR_ROWS}>Add a contributor</Button
        >
    </div>
    <span role="status" class="sr-only">{announcement}</span>
</Field.Set>
