<script lang="ts">
    import XIcon from "@lucide/svelte/icons/x";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Field from "$lib/components/ui/field/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { addTags, hasTags } from "$lib/tags.ts";

    let {
        id,
        label,
        value = $bindable(),
        required = false,
        suggestions = [],
        helpId = "metadata-keywords-help",
        validationMessage,
    }: {
        id: string;
        label: string;
        value: string[];
        required?: boolean;
        suggestions?: readonly string[];
        helpId?: string;
        validationMessage?: string;
    } = $props();
    let draft = $state("");
    let input = $state<HTMLInputElement | null>(null);
    let announcement = $state("");
    let invalid = $derived(
        Boolean(validationMessage) || (required && !hasTags(value)),
    );

    function commit() {
        const next = addTags(value, draft);
        if (next.length > value.length)
            announcement = `${label}: ${next.length} tags.`;
        value = next;
        draft = "";
    }

    function keydown(event: KeyboardEvent) {
        if (
            !event.isComposing &&
            (event.key === "Enter" || event.key === ",")
        ) {
            event.preventDefault();
            commit();
        }
    }

    function remove(index: number) {
        value = value.filter((_, position) => position !== index);
        announcement = `${label}: tag removed. ${value.length} remaining.`;
        input?.focus();
    }
</script>

<Field.Field data-invalid={invalid}>
    <Field.Label for={id} {required}>{label}</Field.Label>
    <div
        data-invalid={invalid || undefined}
        class="flex min-h-8 min-w-0 flex-wrap items-center gap-1 rounded-lg border border-input px-2.5 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20"
    >
        {#each value as tag, index (`${index}:${tag}`)}
            <Badge variant="secondary" class="max-w-full min-w-0">
                <span class="min-w-0 wrap-anywhere"
                    >{tag.trim() ? tag : "Blank tag"}</span
                >
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${label.toLowerCase()} tag ${index + 1}: ${tag}`}
                    onclick={() => remove(index)}><XIcon /></Button
                >
            </Badge>
        {/each}
        <Input
            {id}
            name={id}
            bind:value={draft}
            bind:ref={input}
            placeholder="Add {label.toLowerCase()}"
            aria-label={label}
            list={suggestions.length ? `${id}-suggestions` : undefined}
            required={required && !hasTags(value)}
            aria-required={required}
            aria-invalid={invalid}
            aria-describedby={`${helpId}${invalid ? ` ${id}-error` : ""}`}
            class="min-w-20 flex-1 form-ui:h-6 form-ui:border-0 form-ui:px-0 form-ui:focus-visible:ring-0 form-ui:aria-invalid:ring-0"
            onkeydown={keydown}
            onblur={commit}
        />
    </div>
    {#if suggestions.length}<datalist id={`${id}-suggestions`}>
            {#each suggestions as suggestion (suggestion)}<option
                    value={suggestion}
                ></option>{/each}
        </datalist>{/if}
    <span role="status" class="sr-only">{announcement}</span>
    {#if invalid}
        <Field.Error class="text-xs" id={`${id}-error`}
            >{validationMessage ?? `${label} are required.`}</Field.Error
        >
    {/if}
</Field.Field>
