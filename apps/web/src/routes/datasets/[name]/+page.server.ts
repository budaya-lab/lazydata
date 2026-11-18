import { error } from "@sveltejs/kit";
import {
	DescriptorError,
	readDescriptor,
} from "../../../lib/server/descriptor.ts";
import { DiscoveryError } from "../../../lib/server/discovery.ts";
import { inspectMetadata } from "../../../lib/server/metadata.ts";
import { readReadme } from "../../../lib/server/readme.ts";
import type { PageServerLoad } from "./$types";

export const load = (async ({ params, url }) => {
	const view = url.searchParams.get('view') ?? 'readme';
	if (view !== 'readme' && view !== 'metadata') error(400, 'Choose README or Metadata.');
	try {
		if (view === 'readme') {
			return { name: params.name, view: 'readme' as const, readme: await readReadme(process.env.DATASET_ROOT, params.name) };
		}
		const text = await readDescriptor(process.env.DATASET_ROOT, params.name);
		return {
			name: params.name,
			view: 'metadata' as const,
			text,
			metadata: inspectMetadata(text),
		};
	} catch (cause) {
		if (cause instanceof DescriptorError || cause instanceof DiscoveryError) {
			console.error(cause);
			error(
				cause instanceof DescriptorError ? cause.status : 500,
				cause.message,
			);
		}
		throw cause;
	}
}) satisfies PageServerLoad;
