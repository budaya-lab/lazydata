import { error } from "@sveltejs/kit";
import {
	DescriptorError,
	readDescriptor,
} from "../../../lib/server/descriptor.ts";
import { DiscoveryError } from "../../../lib/server/discovery.ts";
import { inspectMetadata } from "../../../lib/server/metadata.ts";
import type { PageServerLoad } from "./$types";

export const load = (async ({ params }) => {
	try {
		const text = await readDescriptor(process.env.DATASET_ROOT, params.name);
		return {
			name: params.name,
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
