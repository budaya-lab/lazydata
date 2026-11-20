<script lang="ts">
  import * as Card from '$lib/components/ui/card/index.js';

  let { counts }: { counts: { total: number; passed: number; issues: number; unavailable: number } } = $props();
  const cards = [
    { key: 'total', label: 'Datasets', description: 'Folders in this workspace' },
    { key: 'passed', label: 'Metadata passed', description: 'Shared metadata checks passed' },
    { key: 'issues', label: 'Metadata issues', description: 'Descriptors that need attention' },
    { key: 'unavailable', label: 'Unavailable', description: 'Descriptors that could not be read' },
  ] as const;
</script>

<section aria-label="Workspace metadata status" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
  {#each cards as card (card.key)}
    <Card.Root size="sm">
      <Card.Header>
        <Card.Description>{card.label}</Card.Description>
      </Card.Header>
      <Card.Content>
        <p data-count={card.key} class="text-3xl font-semibold tabular-nums">{counts[card.key]}</p>
      </Card.Content>
      <Card.Footer>
        <p class="text-xs text-muted-foreground">{card.description}</p>
      </Card.Footer>
    </Card.Root>
  {/each}
</section>
