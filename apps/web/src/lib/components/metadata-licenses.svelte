<script lang="ts">
    import MetadataTags from "$lib/components/metadata-tags.svelte";
    import { untrack } from 'svelte';
    import { createLicenseIdentities } from '$lib/license-identities.ts';
    import * as Field from "$lib/components/ui/field/index.js";
    import {
        LICENSE_PRESETS,
        type LicenseModel,
        licenseDraftIssues,
    } from "$lib/license-fields.ts";

    let { model, onedit }: { model: LicenseModel; onedit: (names: string[], ids: number[]) => void } = $props();
    let names = $derived([...model.names]);
    let issues = $derived(licenseDraftIssues(names, model.required));
    const identities = createLicenseIdentities(untrack(() => model.names));
    function report(values: string[], removedIndex?: number) {
        onedit(values, identities.update(values, removedIndex));
    }
</script>

<Field.Set id="root/licenses" aria-label="Licenses" class="scroll-mt-28 gap-4">
    <Field.Legend class="mb-2">Licenses</Field.Legend>
    <Field.Description id="metadata-licenses-help" class="text-xs">
        Enter one or more license names. Common SPDX identifiers are suggested;
        custom identifiers are allowed.
    </Field.Description>
    {#if model.message}<p role="status" class="text-sm wrap-anywhere">
            {model.message}
        </p>{/if}
    <Field.Group class="gap-4">
        <MetadataTags
            id="metadata-licenses"
            label="Names"
            bind:value={names}
            onedit={report}
            required={model.required}
            suggestions={LICENSE_PRESETS}
            helpId="metadata-licenses-help"
            validationMessage={issues[0]}
        />
    </Field.Group>
</Field.Set>
