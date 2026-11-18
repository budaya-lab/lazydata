import path from "node:path";
import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter(),
			csp: {
				directives: {
					"default-src": ["self"],
					"img-src": ["self", "data:"],
					"base-uri": ["none"],
					"object-src": ["none"],
					"frame-ancestors": ["none"],
				},
			},
		}),
	],
	resolve: {
		alias: {
			$lib: path.resolve("./src/lib"),
		},
	},
	server: { host: "127.0.0.1" },
	preview: { host: "127.0.0.1" },
});
