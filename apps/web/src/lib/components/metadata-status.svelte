<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
  import FileQuestionIcon from '@lucide/svelte/icons/file-question-mark';

  let { dataset }: { dataset:
    | { status: 'passed' | 'issues'; issueCount: number }
    | { status: 'unavailable'; message: string }
  } = $props();
</script>

<div class="flex flex-col items-start gap-1">
  {#if dataset.status === 'unavailable'}
    <Badge
      variant="outline"
      aria-label="Metadata unavailable"
      title="Metadata unavailable"
      class="text-xs normal-case tracking-normal"
    >
      <FileQuestionIcon data-icon="inline-start" aria-hidden="true" />Unavailable
    </Badge>
    <p
      class="line-clamp-2 max-w-36 text-xs leading-snug text-muted-foreground"
      title={dataset.message}
    >
      {dataset.message}
    </p>
  {:else if dataset.status === 'issues'}
    <Badge
      variant="secondary"
      aria-label={`Metadata issues: ${dataset.issueCount}`}
      title={`Metadata issues: ${dataset.issueCount}`}
      class="text-xs normal-case tracking-normal"
    >
      <CircleAlertIcon data-icon="inline-start" aria-hidden="true" />Issues ({dataset.issueCount})
    </Badge>
  {:else}
    <Badge
      variant="outline"
      aria-label="Metadata checks passed"
      title="Metadata checks passed"
      class="text-xs normal-case tracking-normal"
    >
      <CircleCheckIcon data-icon="inline-start" aria-hidden="true" />Passed
    </Badge>
  {/if}
</div>
