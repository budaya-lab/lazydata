import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit({
    adapter: adapter(),
    csp: {
      directives: {
        'default-src': ['self'],
        'img-src': ['self', 'data:'],
        'base-uri': ['none'],
        'object-src': ['none'],
        'frame-ancestors': ['none'],
      },
    },
  })],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
});
