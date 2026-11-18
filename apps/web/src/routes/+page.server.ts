import { error } from "@sveltejs/kit";
import { listDatasets, datasetView, validateDatasetFilters, DatasetFilterError } from "../lib/server/dataset-list.ts";
import { DiscoveryError } from "../lib/server/discovery.ts";
import type { PageServerLoad } from "./$types";

export const load = (async ({ url }) => {
	try {
		const query = url.searchParams.get('q') ?? '';
		const status = url.searchParams.get('status') ?? 'all';
		validateDatasetFilters(query, status);
		return datasetView(await listDatasets(process.env.DATASET_ROOT), query, status);
	} catch (cause) {
		if (cause instanceof DatasetFilterError) error(400, cause.message);
		if (cause instanceof DiscoveryError) {
			console.error(cause);
			error(500, cause.message);
		}
		throw cause;
	}
}) satisfies PageServerLoad;
