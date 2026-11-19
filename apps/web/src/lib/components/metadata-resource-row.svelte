<script lang="ts">
    import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
    import XIcon from "@lucide/svelte/icons/x";
    import { onMount } from "svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Field from "$lib/components/ui/field/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import type {
        CountResult,
        createResourceCounter,
    } from "$lib/resource-counter.ts";
    import {
        changeResourcePath,
        type ResourceFields,
        type ResourceOption,
        resourceKind,
    } from "$lib/resource-fields.ts";

    let {
        id,
        position,
        fields,
        options,
        required,
        counter,
        onchange,
        onremove,
    }: {
        id: number;
        position: number;
        fields: ResourceFields;
        options: ResourceOption[];
        required: string[];
        counter: ReturnType<typeof createResourceCounter>;
        onchange: (fields: ResourceFields) => void;
        onremove: () => void;
    } = $props();
    const controls = [
        { key: "name", label: "Name" },
        { key: "path", label: "Path" },
        { key: "title", label: "Title" },
        { key: "format", label: "Format" },
    ] as const;
    const uid = $props.id();
    let count = $state<CountResult | null>(null);
    let loading = $state(false);
    let sequence = 0;
    let alive = false;
    let directory = $derived(
        resourceKind(fields.path, options) === "directory" ||
            (count?.status === "counted" && count.kind === "directory"),
    );

    function invalidateCount() {
        sequence++;
        count = null;
        loading = false;
    }

    async function refresh() {
        const path = fields.path;
        const token = ++sequence;
        if (!path?.trim()) {
            count = null;
            loading = false;
            return;
        }
        loading = true;
        count = null;
        try {
            const next = await counter(path, () => alive && token === sequence);
            if (!alive || token !== sequence || next === null) return;
            count = next;
            if (next.status === "counted") {
                if (next.kind === "directory" && fields.format !== "")
                    onchange({ ...fields, format: "" });
            }
        } catch (cause) {
            console.error(
                "Resource count request failed.",
                cause instanceof Error ? cause.name : "Unknown error",
            );
            if (alive && token === sequence)
                count = {
                    status: "error",
                    message: "Could not count this resource. Retry.",
                };
        } finally {
            if (alive && token === sequence) loading = false;
        }
    }

    function edit(key: keyof ResourceFields, value: string) {
        if (key === "path") {
            invalidateCount();
            onchange(changeResourcePath(fields, value, options));
        } else onchange({ ...fields, [key]: value });
    }

    onMount(() => {
        alive = true;
        void refresh();
        return () => {
            alive = false;
            sequence++;
        };
    });
</script>

<Field.Set aria-label={`Resource ${position}`} class="gap-3">
    <Field.Group
        class="grid gap-3 sm:grid-cols-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_5rem_6rem_2rem]"
    >
        {#each controls as control (control.key)}
            {@const invalid =
                fields[control.key] === null ||
                (required.includes(control.key) &&
                    !fields[control.key]?.trim())}
            <Field.Field data-invalid={invalid}>
                <Field.Label
                    for={`${uid}-${control.key}`}
                    required={required.includes(control.key)}
                    >{control.label}</Field.Label
                >
                <Input
                    id={`${uid}-${control.key}`}
                    name={`resource-${id}-${control.key}`}
                    value={fields[control.key] ?? ""}
                    required={required.includes(control.key)}
                    aria-invalid={invalid}
                    aria-describedby={invalid
                        ? `${uid}-${control.key}-error`
                        : undefined}
                    list={control.key === "path" ? `${uid}-paths` : undefined}
                    disabled={control.key === "format" && directory}
                    oninput={(event) =>
                        edit(control.key, event.currentTarget.value)}
                    onblur={control.key === "path" ? refresh : undefined}
                />
                {#if invalid}<Field.Error
                        class="text-xs"
                        id={`${uid}-${control.key}-error`}
                        >{control.label}
                        {fields[control.key] === null
                            ? "has an unsupported supplied value."
                            : "is required."}</Field.Error
                    >{/if}
            </Field.Field>
        {/each}
        <Field.Field>
            <Field.Label
                for={`${uid}-count`}
                required={required.includes("count")}>Count</Field.Label
            >
            <div class="flex min-h-8 items-center gap-1">
                <output
                    id={`${uid}-count`}
                    aria-live="polite"
                    class="min-w-0 text-sm wrap-anywhere"
                >
                    {#if loading}Counting…
                    {:else if count?.status === "counted"}{count.value}
                        {count.value === 1
                            ? count.unit.slice(0, -1)
                            : count.unit}
                    {:else if count?.status === "unsupported"}Unsupported
                    {:else if count?.status === "error"}Unavailable
                    {:else}Not counted{/if}
                </output>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Recount resource ${fields.name ?? position}`}
                    onclick={refresh}
                    disabled={loading || !fields.path?.trim()}
                    ><RefreshCwIcon /></Button
                >
            </div>
            {#if count?.status === "error" || count?.status === "unsupported"}<Field.Description
                    class="text-xs">{count.message}</Field.Description
                >{/if}
        </Field.Field>
        <Field.Field>
            <!-- Match the label line without centring against validation messages. -->
            <Field.Label
                for={`${uid}-remove`}
                aria-hidden="true"
                class="pointer-events-none hidden sm:flex">&#160;</Field.Label
            >
            <div class="flex h-8 items-center">
                <Button
                    id={`${uid}-remove`}
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove resource ${fields.name ?? position}`}
                    onclick={onremove}><XIcon /></Button
                >
            </div>
        </Field.Field>
    </Field.Group>
    <datalist id={`${uid}-paths`}>
        {#each options as option (option.path)}<option
                value={`${option.path}${option.kind === "directory" ? "/" : ""}`}
            ></option>{/each}
    </datalist>
</Field.Set>
