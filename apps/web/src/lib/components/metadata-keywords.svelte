<script lang="ts">
    import MetadataTags from "$lib/components/metadata-tags.svelte";
    import type { KeywordEdits } from "$lib/draft-checks.ts";
    import * as Field from "$lib/components/ui/field/index.js";
    import * as NativeSelect from "$lib/components/ui/native-select/index.js";

    let {
        tasks,
        projects,
        stage,
        extraKeywords,
        stageOptions,
        onedit,
    }: {
        tasks: string[];
        projects: string[];
        stage: string;
        extraKeywords: string[];
        stageOptions: { value: string; label: string }[];
        onedit: (values: KeywordEdits) => void;
    } = $props();
    let invalidStage = $derived(
        !stageOptions.some(({ value }) => value === stage),
    );
</script>

<Field.Set id="root/keywords" class="scroll-mt-28 gap-4">
    <Field.Legend class="mb-2">Keywords</Field.Legend>
    <Field.Description class="text-xs" id="metadata-keywords-help">
        Press Enter or comma to add tags. Spaces stay within a tag.
    </Field.Description>
    <Field.Group class="grid gap-4 sm:grid-cols-2">
        <MetadataTags
            id="metadata-tasks"
            label="Tasks"
            bind:value={tasks}
            onedit={(tasks) => onedit({ tasks })}
            required
        />
        <MetadataTags
            id="metadata-projects"
            label="Projects"
            bind:value={projects}
            onedit={(projects) => onedit({ projects })}
            required
        />
        <Field.Field data-invalid={invalidStage}>
            <Field.Label for="metadata-stage" required>Stage</Field.Label>
            <NativeSelect.Root
                id="metadata-stage"
                name="stage"
                class="w-full"
                bind:value={stage}
                onchange={(event) => onedit({ stage: event.currentTarget.value })}
                required
                aria-invalid={invalidStage}
                aria-describedby={invalidStage
                    ? "metadata-stage-error"
                    : undefined}
            >
                <NativeSelect.Option value=""
                    >Select a stage</NativeSelect.Option
                >
                {#each stageOptions as option (option.value)}
                    <NativeSelect.Option value={option.value}
                        >{option.label}</NativeSelect.Option
                    >
                {/each}
            </NativeSelect.Root>
            {#if invalidStage}
                <Field.Error class="text-xs" id="metadata-stage-error"
                    >Stage is required.</Field.Error
                >
            {/if}
        </Field.Field>
        <MetadataTags
            id="metadata-extra-keywords"
            label="Extra keywords"
            bind:value={extraKeywords}
            onedit={(extraKeywords) => onedit({ extraKeywords })}
        />
    </Field.Group>
</Field.Set>
