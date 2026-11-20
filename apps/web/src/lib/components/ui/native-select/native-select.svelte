<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLSelectAttributes } from "svelte/elements";

	type NativeSelectProps = Omit<WithElementRef<HTMLSelectAttributes, HTMLSelectElement>, "size"> & {
		size?: "sm" | "default";
	};

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		size = "default",
		children,
		...restProps
	}: NativeSelectProps = $props();
</script>

<div
	class={cn(
		"group/native-select relative w-fit has-[select:disabled]:opacity-50",
		className
	)}
	data-slot="native-select-wrapper"
	data-size={size}
>
	<select
		bind:value
		{@attach (element) => { ref = element; return () => { ref = null; }; }}
		data-slot="native-select"
		data-size={size}
		class="border-transparent border-b-input bg-transparent placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground focus-visible:border-b-ring aria-invalid:border-b-destructive dark:aria-invalid:border-b-destructive/50 form-ui:h-8 form-ui:rounded-lg form-ui:border-input form-ui:px-2.5 form-ui:pr-8 form-ui:py-1 form-ui:focus-visible:border-ring form-ui:focus-visible:ring-3 form-ui:focus-visible:ring-ring/50 form-ui:aria-invalid:border-destructive form-ui:aria-invalid:ring-3 form-ui:aria-invalid:ring-destructive/20 h-10 w-full min-w-0 appearance-none rounded-none border py-2 pr-8 pl-0 text-sm transition-[color,border-color] select-none data-[size=sm]:h-9 outline-none disabled:pointer-events-none disabled:cursor-not-allowed"
		{...restProps}
	>
		{@render children?.()}
	</select>
	<ChevronDownIcon class="text-muted-foreground top-1/2 right-0 form-ui:right-2.5 size-3.5 -translate-y-1/2 pointer-events-none absolute select-none" aria-hidden data-slot="native-select-icon" />
</div>
