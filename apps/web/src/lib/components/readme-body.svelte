<script lang="ts">
    import type { ReadmeNode } from "$lib/readme.ts";
    import { Badge } from "$lib/components/ui/badge/index.js";

    let { nodes }: { nodes: ReadmeNode[] } = $props();
</script>

{#snippet renderNodes(items: ReadmeNode[])}
    {#each items as node (node)}
        {#if node.tag === "text"}
            {node.text}
        {:else if node.tag === "badge"}
            <span class="form-ui mr-2 inline-flex max-w-full align-middle">
                <Badge role="img" aria-label={node.text} class="max-w-full wrap-anywhere">{node.text}</Badge>
            </span>
        {:else if node.tag === "hr"}
            <hr />
        {:else if node.tag === "br"}
            <br />
        {:else}
            <svelte:element
                this={node.tag}
                href={node.href}
                start={node.start}
                rel={node.href ? "noreferrer noopener" : undefined}
                target={node.href ? "_blank" : undefined}
            >
                {@render renderNodes(node.children)}
            </svelte:element>
        {/if}
    {/each}
{/snippet}

<article aria-label="Dataset README" class="readme-view">
    {@render renderNodes(nodes)}
</article>
