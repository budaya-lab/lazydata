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

<div class="flex flex-col items-start gap-2">
  {#if dataset.status === 'unavailable'}
    <Badge variant="outline"><FileQuestionIcon data-icon="inline-start" aria-hidden="true" />Metadata unavailable</Badge>
    <p class="max-w-64 text-xs leading-relaxed text-muted-foreground">{dataset.message}</p>
  {:else if dataset.status === 'issues'}
    <Badge variant="secondary"><CircleAlertIcon data-icon="inline-start" aria-hidden="true" />Metadata issues ({dataset.issueCount})</Badge>
  {:else}
    <Badge variant="outline"><CircleCheckIcon data-icon="inline-start" aria-hidden="true" />Metadata checks passed</Badge>
  {/if}
</div>
