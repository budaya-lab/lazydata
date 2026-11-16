<svelte:options runes={true} />

<script lang="ts">
    import { resolve } from "$app/paths";
    import { page } from "$app/state";
</script>

<svelte:head>
    <title>Dataset error — Lazydata</title>
</svelte:head>

<main>
    <h1>Dataset error</h1>
    <p>{page.error?.message}</p>
    <a href={resolve("/")}>Back to datasets</a>
</main>
