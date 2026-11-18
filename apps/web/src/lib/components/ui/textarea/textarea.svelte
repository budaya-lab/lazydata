<script lang="ts">
	import { cn, type WithElementRef, type WithoutChildren } from "$lib/utils.js";
	import type { HTMLTextareaAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		"data-slot": dataSlot = "textarea",
		...restProps
	}: WithoutChildren<WithElementRef<HTMLTextareaAttributes>> = $props();
</script>

<textarea
	{@attach (element) => { ref = element; return () => { ref = null; }; }}
	data-slot={dataSlot}
	class={cn(
		"border-transparent border-b-input bg-transparent focus-visible:border-b-ring aria-invalid:border-b-destructive dark:aria-invalid:border-b-destructive/50 resize-none rounded-none border px-0 py-3 form-ui:rounded-lg form-ui:border-input form-ui:px-2.5 form-ui:py-2 form-ui:focus-visible:border-ring form-ui:focus-visible:ring-3 form-ui:focus-visible:ring-ring/50 form-ui:aria-invalid:border-destructive form-ui:aria-invalid:ring-3 form-ui:aria-invalid:ring-destructive/20 text-base transition-[color,border-color] md:text-sm flex field-sizing-content min-h-16 w-full outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	bind:value
	{...restProps}></textarea>
