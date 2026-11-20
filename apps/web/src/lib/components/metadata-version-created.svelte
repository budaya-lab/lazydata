<script lang="ts">
    import { onMount } from "svelte";
    import type { OverviewEdits } from "$lib/draft-checks.ts";
    import * as Field from "$lib/components/ui/field/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import {
        createdAtLocalMidnight,
        isSemver,
        localDateForCreated,
    } from "$lib/overview-values.ts";

    let {
        version,
        created,
        onedit,
    }: {
        version: string | null;
        created: string | null;
        onedit: (values: OverviewEdits) => void;
    } = $props();
    let dateValue = $state("");
    let dateError = $state("");
    let ready = $state(false);
    let invalidVersion = $derived(
        version === null || (version !== "" && !isSemver(version)),
    );
    let invalidCreated = $derived(created === null || Boolean(dateError));

    onMount(() => {
        if (created !== "") {
            const day = created === null ? null : localDateForCreated(created);
            if (day === null)
                dateError = "Created must be a valid RFC3339 date-time.";
            else dateValue = day;
        }
        ready = true;
        if (dateError) onedit({ createdError: dateError });
    });

    function changeDate(event: Event & { currentTarget: HTMLInputElement }) {
        const input = event.currentTarget;
        dateValue = input.value;
        dateError = "";
        if (!input.validity.valid) {
            dateError = "Enter a valid date between years 0001 and 9999.";
        } else if (!dateValue) {
            created = "";
        } else {
            const value = createdAtLocalMidnight(dateValue);
            if (value === null) {
                dateError = "Midnight is not available in your browser's time zone for this date.";
            } else created = value;
        }
        onedit({ created, createdError: dateError });
    }
</script>

<Field.Field data-invalid={invalidCreated}>
    <Field.Label for="metadata-created">Created</Field.Label>
    <Input
        id="metadata-created"
        name="createdDate"
        type="date"
        value={dateValue}
        min="0001-01-01"
        max="9999-12-31"
        disabled={!ready}
        oninput={changeDate}
        aria-invalid={invalidCreated}
        aria-describedby={invalidCreated ? "metadata-created-error" : undefined}
    />
    <input
        type="hidden"
        name="created"
        value={created ?? ""}
        disabled={!ready || invalidCreated}
    />
    {#if invalidCreated}
        <Field.Error class="text-xs" id="metadata-created-error"
            >{dateError ||
                "Created must be a valid RFC3339 date-time."}</Field.Error
        >
    {/if}
</Field.Field>
<Field.Field data-invalid={invalidVersion}>
    <Field.Label for="metadata-version">Version</Field.Label>
    <Input
        id="metadata-version"
        name="version"
        bind:value={version}
        oninput={(event) => onedit({ version: event.currentTarget.value })}
        placeholder="1.0.0"
        aria-invalid={invalidVersion}
        aria-describedby={invalidVersion ? "metadata-version-error" : undefined}
    />
    {#if invalidVersion}
        <Field.Error class="text-xs" id="metadata-version-error"
            >Use a valid SemVer version, such as 1.0.0.</Field.Error
        >
    {/if}
</Field.Field>
