<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		variant = "legend",
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLLegendElement>> & {
		variant?: "legend" | "label";
	} = $props();
</script>

<legend
	{@attach (element) => { ref = element; return () => { ref = null; }; }}
	data-slot="field-legend"
	data-variant={variant}
	class={cn("mb-3 font-semibold uppercase data-[variant=label]:text-xs data-[variant=legend]:text-xs form-ui:normal-case form-ui:font-medium form-ui:data-[variant=label]:text-sm form-ui:data-[variant=legend]:text-base", className)}
	{...restProps}
>
	{@render children?.()}
</legend>
