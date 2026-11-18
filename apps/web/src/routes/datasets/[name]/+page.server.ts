import { error } from "@sveltejs/kit";
import { DescriptorError } from "../../../lib/server/descriptor.ts";
import { readDatasetSnapshot } from "../../../lib/server/dataset-text.ts";
import { DiscoveryError } from "../../../lib/server/discovery.ts";
import { inspectMetadata, stageOptions } from "../../../lib/server/metadata.ts";
import { readReadme } from "../../../lib/server/readme.ts";
import type { PageServerLoad } from "./$types";

export const load = (async ({ params, url }) => {
	const view = url.searchParams.get('view') ?? 'readme';
	if (view !== 'readme' && view !== 'metadata' && view !== 'datapackage') error(400, 'Choose README, Metadata or datapackage.json.');
	try {
		if (view === 'readme') {
			return { name: params.name, view: 'readme' as const, readme: await readReadme(process.env.DATASET_ROOT, params.name) };
		}
		const snapshot = await readDatasetSnapshot(process.env.DATASET_ROOT, params.name, 'datapackage.json');
		if (view === 'datapackage') return { name: params.name, view: 'datapackage' as const, text: snapshot.text };
		const { issues, overview, keywordFields } = inspectMetadata(snapshot.text);
		return { name: params.name, view: 'metadata' as const, issues, overview, keywordFields, stageOptions };
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
