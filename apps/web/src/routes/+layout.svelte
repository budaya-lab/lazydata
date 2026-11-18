<script lang="ts">
    import "./layout.css";
    import { resolve } from "$app/paths";
    import { page } from "$app/state";
    import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
    import AppSidebar from "$lib/components/app-sidebar.svelte";
    import { Separator } from "$lib/components/ui/separator/index.js";
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import type { LayoutProps } from "./$types";

    let { children }: LayoutProps = $props();
    let datasetName = $derived(
        page.route.id === "/datasets/[name]" ? page.params.name : undefined,
    );
</script>

<a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-background focus:p-3 focus:outline-2 focus:outline-ring"
    >Skip to content</a
>
<Sidebar.Provider>
    <AppSidebar />
    <Sidebar.Inset id="main-content" tabindex={-1} class="min-w-0">
        <header
            class="flex h-12 shrink-0 items-center gap-4 border-b px-4 lg:px-6"
        >
            <div class="flex min-w-0 items-center gap-3">
                <Sidebar.Trigger />
                <Separator
                    orientation="vertical"
                    class="me-2 data-vertical:h-4 data-vertical:self-auto"
                />
                <Breadcrumb.Root aria-label="Breadcrumb" class="min-w-0">
                    <Breadcrumb.List class="flex-nowrap">
                        <Breadcrumb.Item class="shrink-0">
                            {#if datasetName}
                                <Breadcrumb.Link href={resolve("/")}>Datasets</Breadcrumb.Link>
                            {:else}
                                <Breadcrumb.Page>Datasets</Breadcrumb.Page>
                            {/if}
                        </Breadcrumb.Item>
                        {#if datasetName}
                            <Breadcrumb.Separator />
                            <Breadcrumb.Item class="min-w-0">
                                <Breadcrumb.Page class="truncate" title={datasetName}>{datasetName}</Breadcrumb.Page>
                            </Breadcrumb.Item>
                        {/if}
                    </Breadcrumb.List>
                </Breadcrumb.Root>
            </div>
        </header>
        <div class="flex min-w-0 flex-1 flex-col px-4 py-4 md:py-6 lg:px-6">
            {@render children()}
        </div>
    </Sidebar.Inset>
</Sidebar.Provider>
