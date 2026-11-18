<script lang="ts">
    import { tick } from "svelte";
    import MetadataResourceRow from "$lib/components/metadata-resource-row.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Field from "$lib/components/ui/field/index.js";
    import { createResourceCounter } from "$lib/resource-counter.ts";
    import {
        MAX_RESOURCE_ROWS,
        type ResourceFields,
        type ResourceModel,
        resourceDraftIssues,
    } from "$lib/resource-fields.ts";

    let { model, countUrl }: { model: ResourceModel; countUrl: string } =
        $props();
    type Row = { id: number; fields: ResourceFields; count?: number };
    let rows = $derived<Row[]>(
        model.rows.map((fields, id) => ({ id, fields })),
    );
    let issues = $derived(
        resourceDraftIssues(
            rows.map((row) => ({ ...row.fields, count: row.count })),
        ),
    );
    let nextId = MAX_RESOURCE_ROWS;
    let counter = $derived(createResourceCounter(countUrl));
    let container = $state<HTMLFieldSetElement | null>(null);
    let addButton = $state<HTMLButtonElement | null>(null);
    let announcement = $state("");

    function update(id: number, patch: Partial<Row>) {
        rows = rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
    }

    async function add() {
        rows = [
            ...rows,
            {
                id: nextId++,
                fields: { name: "", path: "", title: "", format: "" },
            },
        ];
        announcement = "Resource added.";
        await tick();
        container
            ?.querySelectorAll<HTMLInputElement>('input[name$="-path"]')
            .item(rows.length - 1)
            ?.focus();
    }

    async function remove(id: number) {
        const index = rows.findIndex((row) => row.id === id);
        rows = rows.filter((row) => row.id !== id);
        announcement = "Resource removed.";
        await tick();
        const input = container
            ?.querySelectorAll<HTMLInputElement>('input[name$="-path"]')
            .item(Math.min(index, rows.length - 1));
        if (input) input.focus();
        else addButton?.focus();
    }
</script>

<Field.Set
    id="root/resources"
    aria-label="Resources"
    class="scroll-mt-28 gap-4"
    bind:ref={container}
>
    <Field.Legend class="mb-2">Resources</Field.Legend>
    <Field.Description class="text-xs">
        Choose a dataset-relative path. Root files and folders are suggested.
        Counts are read-only: CSV/TSV data rows, JSON array items, JSONL records
        or files recursively in a folder.
    </Field.Description>
    {#if model.message}<p role="status" class="text-sm wrap-anywhere">
            {model.message}
        </p>{/if}
    <Field.Group class="gap-4">
        {#each rows as row, index (row.id)}
            <MetadataResourceRow
                id={row.id}
                position={index + 1}
                fields={row.fields}
                options={model.options}
                required={model.required}
                {counter}
                onchange={(fields) => update(row.id, { fields })}
                oncount={(count) => update(row.id, { count })}
                onremove={() => remove(row.id)}
            />
        {:else}<p class="text-sm text-muted-foreground">
                No resources yet.
            </p>{/each}
    </Field.Group>
    {#if issues.length}
        <Field.Error class="text-xs"
            ><ul class="list-disc pl-4">
                {#each issues as issue, index (`${index}:${issue}`)}<li>
                        {issue}
                    </li>{/each}
            </ul></Field.Error
        >
    {/if}
    <div>
        <Button
            type="button"
            variant="outline"
            size="sm"
            bind:ref={addButton}
            onclick={add}
            disabled={rows.length >= MAX_RESOURCE_ROWS}>Add a resource</Button
        >
    </div>
    <span role="status" class="sr-only">{announcement}</span>
</Field.Set>
