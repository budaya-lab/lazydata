if (process.env.SOCKET_PATH) {
  throw new Error('SOCKET_PATH is not supported by the local Steward.');
}

process.env.HOST = '127.0.0.1';
await import(new URL('../build/index.js', import.meta.url).href);
