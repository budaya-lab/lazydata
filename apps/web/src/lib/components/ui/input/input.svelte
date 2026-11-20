<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";

	type InputType = Exclude<HTMLInputTypeAttribute, "file">;
	type Props = WithElementRef<
		Omit<HTMLInputAttributes, "type"> &
			({ type: "file"; files?: FileList | null } | { type?: InputType; files?: undefined })
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		"data-slot": dataSlot = "input",
		...restProps
	}: Props = $props();

	const inputStyles = "border-transparent border-b-input bg-transparent focus-visible:border-b-ring aria-invalid:border-b-destructive dark:aria-invalid:border-b-destructive/50 h-10 border px-0 py-1 text-base transition-[color,border-color] file:h-7 file:text-sm file:font-medium md:text-sm w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 form-ui:h-8 form-ui:rounded-lg form-ui:border-input form-ui:px-2.5 form-ui:focus-visible:border-ring form-ui:focus-visible:ring-3 form-ui:focus-visible:ring-ring/50 form-ui:aria-invalid:border-destructive form-ui:aria-invalid:ring-3 form-ui:aria-invalid:ring-destructive/20";
	const elementRef = (element: HTMLInputElement) => { ref = element; return () => { ref = null; }; };
</script>

{#if type === "file"}
	<input
		{@attach elementRef}
		data-slot={dataSlot}
		class={cn(inputStyles, className)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<input
		{@attach elementRef}
		data-slot={dataSlot}
		class={cn(inputStyles, className)}
		{type}
		bind:value
		{...restProps}
	/>
{/if}
