<script lang="ts">
    import FolderSearchIcon from "@lucide/svelte/icons/folder-search";
    import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
    import { resolve } from "$app/paths";
    import DatasetCounts from "$lib/components/dataset-counts.svelte";
    import MetadataStatus from "$lib/components/metadata-status.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Empty from "$lib/components/ui/empty/index.js";
    import * as Field from "$lib/components/ui/field/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import * as NativeSelect from "$lib/components/ui/native-select/index.js";
    import * as Table from "$lib/components/ui/table/index.js";
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();
    const columns = ["Task", "Project", "Stage", "Creators"];
    let refreshUrl = $derived(
        `${resolve("/")}?${new URLSearchParams({ q: data.query, status: data.status })}`,
    );

    function supplied(
        dataset: PageProps["data"]["datasets"][number],
        label: string,
    ): string {
        if (dataset.summary === null) return "Unavailable";
        const field = dataset.summary.find((field) => field.label === label);
        if (!field) throw new Error("Missing dataset table summary field.");
        return field.values.join("; ") || "Not supplied";
    }
</script>

<svelte:head>
    <title>Datasets — Lazydata</title>
</svelte:head>

<section aria-labelledby="datasets-heading" class="flex min-w-0 flex-col gap-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex flex-col gap-2">
            <h1
                id="datasets-heading"
                class="font-heading text-3xl font-semibold"
            >
                Datasets
            </h1>
            <p
                class="max-w-prose text-sm leading-relaxed text-muted-foreground"
            >
                Review supplied metadata and find descriptors that need
                attention.
            </p>
        </div>
        <Button href={refreshUrl} variant="outline" data-sveltekit-reload>
            <RefreshIcon data-icon="inline-start" aria-hidden="true" />Refresh
        </Button>
    </div>

    <DatasetCounts counts={data.counts} />

    <form
        action={resolve("/")}
        method="GET"
        role="search"
        aria-label="Find datasets"
        data-sveltekit-reload
    >
        <Field.Group class="gap-4 md:flex-row md:items-end">
            <Field.Field class="min-w-0 flex-1">
                <Field.Label for="dataset-search">Search datasets</Field.Label>
                <Input
                    id="dataset-search"
                    name="q"
                    type="search"
                    value={data.query}
                    maxlength={200}
                    placeholder="Name, title, task, project, stage or creator"
                />
            </Field.Field>
            <Field.Field class="md:w-52">
                <Field.Label for="metadata-filter">Metadata status</Field.Label>
                <NativeSelect.Root
                    id="metadata-filter"
                    name="status"
                    value={data.status}
                    class="w-full"
                >
                    <NativeSelect.Option value="all"
                        >All statuses</NativeSelect.Option
                    >
                    <NativeSelect.Option value="passed"
                        >Metadata passed</NativeSelect.Option
                    >
                    <NativeSelect.Option value="issues"
                        >Metadata issues</NativeSelect.Option
                    >
                    <NativeSelect.Option value="unavailable"
                        >Unavailable</NativeSelect.Option
                    >
                </NativeSelect.Root>
            </Field.Field>
            <div class="flex items-center gap-2">
                <Button type="submit">Apply</Button>
                {#if data.query || data.status !== "all"}
                    <Button
                        href={resolve("/")}
                        variant="ghost"
                        data-sveltekit-reload>Clear filters</Button
                    >
                {/if}
            </div>
        </Field.Group>
    </form>

    <p class="text-xs leading-relaxed text-muted-foreground">
        Metadata checks only. Resource files and buckets are not read. These
        checks do not authorize publication.
    </p>

    {#if data.datasets.length}
        <div class="min-w-0 border">
            <Table.Root>
                <Table.Caption
                    >Showing {data.datasets.length} of {data.counts.total} datasets</Table.Caption
                >
                <Table.Header>
                    <Table.Row>
                        <Table.Head scope="col">Dataset</Table.Head>
                        <Table.Head scope="col">Metadata checks</Table.Head>
                        {#each columns as column (column)}<Table.Head
                                scope="col">{column}</Table.Head
                            >{/each}
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {#each data.datasets as dataset (dataset.name)}
                        <Table.Row>
                            <Table.Cell
                                class="min-w-56"
                            >
                                <div class="flex flex-col gap-1">
                                    <a
                                        href={resolve("/datasets/[name]", {
                                            name: encodeURIComponent(
                                                dataset.name,
                                            ),
                                        })}
                                        class="w-max whitespace-nowrap font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                                        data-dataset-link>{dataset.name}</a
                                    >
                                    <p
                                        class="max-w-80 whitespace-normal wrap-anywhere text-xs leading-relaxed text-muted-foreground"
                                    >
                                        {supplied(dataset, "Title")}
                                    </p>
                                </div>
                            </Table.Cell>
                            <Table.Cell class="max-w-64 whitespace-normal"
                                ><MetadataStatus {dataset} /></Table.Cell
                            >
                            {#each columns as column (column)}
                                <Table.Cell
                                    class="max-w-56 whitespace-normal wrap-anywhere"
                                    >{supplied(dataset, column)}</Table.Cell
                                >
                            {/each}
                        </Table.Row>
                    {/each}
                </Table.Body>
            </Table.Root>
        </div>
    {:else}
        <Empty.Root class="border">
            <Empty.Header>
                <Empty.Media variant="icon"
                    ><FolderSearchIcon aria-hidden="true" /></Empty.Media
                >
                <Empty.Title
                    >{data.counts.total
                        ? "No matching datasets"
                        : "No datasets found"}</Empty.Title
                >
                <Empty.Description>
                    {#if data.counts.total}
                        Try another search or clear the filters to see all
                        datasets.
                    {:else}
                        No ds-* folders found in the configured parent
                        directory. Check DATASET_ROOT and refresh.
                    {/if}
                </Empty.Description>
            </Empty.Header>
            {#if data.counts.total}
                <Empty.Content
                    ><Button
                        href={resolve("/")}
                        variant="outline"
                        data-sveltekit-reload>Clear filters</Button
                    ></Empty.Content
                >
            {/if}
        </Empty.Root>
    {/if}
</section>
