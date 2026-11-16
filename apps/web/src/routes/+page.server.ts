import { error } from "@sveltejs/kit";
import { listDatasets } from "../lib/server/dataset-list.ts";
import { DiscoveryError } from "../lib/server/discovery.ts";
import type { PageServerLoad } from "./$types";

export const csr = false;

export const load = (async () => {
	try {
		return { datasets: await listDatasets(process.env.DATASET_ROOT) };
	} catch (cause) {
		if (cause instanceof DiscoveryError) {
			console.error(cause);
			error(500, cause.message);
		}
		throw cause;
	}
}) satisfies PageServerLoad;
