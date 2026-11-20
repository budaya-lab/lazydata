<script lang="ts">
    import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
    import FileQuestionIcon from "@lucide/svelte/icons/file-question-mark";
    import FolderIcon from "@lucide/svelte/icons/folder";
    import { asset, resolve } from "$app/paths";
    import { page } from "$app/state";
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";

    const sidebar = Sidebar.useSidebar();
    const views = [
        { label: "All datasets", status: "all", icon: FolderIcon },
        { label: "Metadata issues", status: "issues", icon: CircleAlertIcon },
        { label: "Unavailable", status: "unavailable", icon: FileQuestionIcon },
    ];
</script>

<Sidebar.Root variant="inset" collapsible="offcanvas">
    <Sidebar.Header class="p-4">
        <a
            href={resolve("/")}
            data-sveltekit-reload
            class="flex items-center gap-3 py-2 focus-visible:outline-2 focus-visible:outline-ring"
        >
            <img src={asset("favicon.png")} alt="" class="size-9" />
            <span class="flex flex-col gap-0.5">
                <span class="font-heading text-xl font-semibold">Penjaga</span>
                <span class="text-xs text-muted-foreground"
                    >Dataset Steward</span
                >
            </span>
        </a>
    </Sidebar.Header>
    <Sidebar.Content>
        <Sidebar.Group>
            <Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
            <Sidebar.GroupContent>
                <nav aria-label="Dataset views">
                    <Sidebar.Menu>
                        {#each views as view (view.status)}
                            {@const active =
                                page.route.id === "/" &&
                                (page.url.searchParams.get("status") ??
                                    "all") === view.status}
                            <Sidebar.MenuItem>
                                <Sidebar.MenuButton isActive={active}>
                                    {#snippet child({ props })}
                                        <a
                                            {...props}
                                            href={view.status === "all"
                                                ? resolve("/")
                                                : `${resolve("/")}?status=${view.status}`}
                                            aria-current={active
                                                ? "page"
                                                : undefined}
                                            data-sveltekit-reload
                                            onclick={() =>
                                                sidebar.setOpenMobile(false)}
                                        >
                                            <view.icon aria-hidden="true" />
                                            <span>{view.label}</span>
                                        </a>
                                    {/snippet}
                                </Sidebar.MenuButton>
                            </Sidebar.MenuItem>
                        {/each}
                    </Sidebar.Menu>
                </nav>
            </Sidebar.GroupContent>
        </Sidebar.Group>
    </Sidebar.Content>
    <Sidebar.Footer class="p-5">
        <p class="text-xs leading-relaxed text-muted-foreground">
            Local workspace.<br />Files stay in your dataset folders.
        </p>
    </Sidebar.Footer>
</Sidebar.Root>
