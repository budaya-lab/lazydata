<script lang="ts">
    import XIcon from "@lucide/svelte/icons/x";
    import { tick } from "svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Field from "$lib/components/ui/field/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import {
        MAX_SOURCE_ROWS,
        type SourceFields,
        type SourceModel,
        sourceDraftIssues,
        sourceLocatorIssue,
    } from "$lib/source-fields.ts";

    let { model }: { model: SourceModel } = $props();
    type Row = { id: number; fields: SourceFields };
    let rows = $derived<Row[]>(
        model.rows.map((fields, id) => ({ id, fields })),
    );
    let issues = $derived(sourceDraftIssues(rows.map((row) => row.fields)));
    let nextId = MAX_SOURCE_ROWS;
    let container = $state<HTMLFieldSetElement | null>(null);
    let addButton = $state<HTMLButtonElement | null>(null);
    let announcement = $state("");
    const uid = $props.id();

    function update(id: number, key: keyof SourceFields, value: string) {
        rows = rows.map((row) =>
            row.id === id
                ? { ...row, fields: { ...row.fields, [key]: value } }
                : row,
        );
    }

    async function add() {
        rows = [...rows, { id: nextId++, fields: { title: "", path: "" } }];
        announcement = "Source added.";
        await tick();
        container
            ?.querySelectorAll<HTMLInputElement>('input[name$="-title"]')
            .item(rows.length - 1)
            ?.focus();
    }

    async function remove(id: number) {
        const index = rows.findIndex((row) => row.id === id);
        rows = rows.filter((row) => row.id !== id);
        announcement = "Source removed.";
        await tick();
        const path = container
            ?.querySelectorAll<HTMLInputElement>('input[name$="-path"]')
            .item(Math.min(index, rows.length - 1));
        if (path) path.focus();
        else addButton?.focus();
    }
</script>

<Field.Set
    id="root/sources"
    aria-label="Sources"
    class="scroll-mt-28 gap-4"
    bind:ref={container}
>
    <Field.Legend class="mb-2">Sources</Field.Legend>
    <Field.Description class="text-xs">
        Add a source title and either a fully qualified HTTP(S) address or a
        relative POSIX path. No links are fetched.
    </Field.Description>
    {#if model.message}<p role="status" class="text-sm wrap-anywhere">
            {model.message}
        </p>{/if}
    <Field.Group class="gap-4">
        {#each rows as row, index (row.id)}
            {@const titleInvalid =
                row.fields.title === null || !row.fields.title?.trim()}
            {@const pathIssue =
                row.fields.path === null
                    ? "Source path has an unsupported value."
                    : sourceLocatorIssue(row.fields.path ?? "")}
            <Field.Set aria-label={`Source ${index + 1}`} class="gap-3">
                <Field.Group
                    class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_2rem]"
                >
                    <Field.Field data-invalid={titleInvalid}>
                        <Field.Label for={`${uid}-${row.id}-title`} required
                            >Title</Field.Label
                        >
                        <Input
                            id={`${uid}-${row.id}-title`}
                            name={`source-${row.id}-title`}
                            value={row.fields.title ?? ""}
                            required
                            aria-invalid={titleInvalid}
                            aria-describedby={titleInvalid
                                ? `${uid}-${row.id}-title-error`
                                : undefined}
                            oninput={(event) =>
                                update(
                                    row.id,
                                    "title",
                                    event.currentTarget.value,
                                )}
                        />
                        {#if titleInvalid}<Field.Error
                                class="text-xs"
                                id={`${uid}-${row.id}-title-error`}
                                >{row.fields.title === null
                                    ? "Title has an unsupported value."
                                    : "Title is required."}</Field.Error
                            >{/if}
                    </Field.Field>
                    <Field.Field data-invalid={Boolean(pathIssue)}>
                        <Field.Label for={`${uid}-${row.id}-path`} required
                            >URL or Path</Field.Label
                        >
                        <Input
                            id={`${uid}-${row.id}-path`}
                            name={`source-${row.id}-path`}
                            value={row.fields.path ?? ""}
                            required
                            aria-invalid={Boolean(pathIssue)}
                            aria-describedby={pathIssue
                                ? `${uid}-${row.id}-path-error`
                                : undefined}
                            oninput={(event) =>
                                update(
                                    row.id,
                                    "path",
                                    event.currentTarget.value,
                                )}
                        />
                        {#if pathIssue}<Field.Error
                                class="text-xs"
                                id={`${uid}-${row.id}-path-error`}
                                >{row.fields.path === null
                                    ? pathIssue
                                    : pathIssue === "path is required"
                                      ? "URL or Path is required."
                                      : "Enter a fully qualified HTTP(S) address or a safe relative POSIX path."}</Field.Error
                            >{/if}
                    </Field.Field>
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
                                aria-label={`Remove source ${row.fields.title ?? index + 1}`}
                                onclick={() => remove(row.id)}><XIcon /></Button
                            >
                        </div>
                    </Field.Field>
                </Field.Group>
            </Field.Set>
        {:else}<p class="text-sm text-muted-foreground">
                No sources yet.
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
            disabled={rows.length >= MAX_SOURCE_ROWS}>Add a source</Button
        >
    </div>
    <span role="status" class="sr-only">{announcement}</span>
</Field.Set>
