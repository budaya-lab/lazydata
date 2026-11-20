<script lang="ts">
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import { setSidebar } from "./context.svelte.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		open = $bindable(true),
		onOpenChange = () => {},
		class: className,
		style,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	} = $props();

	const sidebar = setSidebar({
		open: () => open,
		setOpen: (value: boolean) => {
			open = value;
			onOpenChange(value);

		},
	});
</script>

<svelte:window onkeydown={sidebar.handleShortcutKeydown} />

<Tooltip.Provider delayDuration={0}>
	<div
		data-slot="sidebar-wrapper"
		{style}
		class={cn(
			"group/sidebar-wrapper flex min-h-svh w-full [--sidebar-width:16rem] [--sidebar-width-icon:3rem] has-data-[variant=inset]:bg-sidebar",
			className
		)}
		{@attach (element) => {
			ref = element;
			return () => { ref = null; };
		}}
		{...restProps}
	>
		{@render children?.()}
	</div>
</Tooltip.Provider>
