<svelte:options runes={true} />

<script lang="ts">
    import { resolve } from "$app/paths";
    import { page } from "$app/state";
</script>

<svelte:head>
    <title>Dataset error — Lazydata</title>
</svelte:head>

<section class="flex flex-col gap-4">
    <h1 class="font-heading text-3xl font-semibold">Dataset error</h1>
    <p>{page.error?.message}</p>
    <a href={resolve("/")} class="w-fit underline underline-offset-4">Back to datasets</a>
</section>
