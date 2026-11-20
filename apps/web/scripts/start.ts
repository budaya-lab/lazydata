import type { IncomingMessage, Server } from 'node:http';
import { MAX_DATASET_TEXT_BYTES } from '../src/lib/dataset-text-limits.ts';

if (process.env.SOCKET_PATH) {
  throw new Error('SOCKET_PATH is not supported by the local Steward.');
}

process.env.BODY_SIZE_LIMIT = String(MAX_DATASET_TEXT_BYTES);
process.env.HOST = '127.0.0.1';
process.env.PROTOCOL_HEADER = 'x-penjaga-protocol';
delete process.env.HOST_HEADER;
delete process.env.PORT_HEADER;
const { server }: { server: Server } = await import(new URL('../build/index.js', import.meta.url).href);
// This process serves plain HTTP. Never trust a client-supplied proxy protocol.
server.prependListener('request', (request: IncomingMessage) => {
  request.headers['x-penjaga-protocol'] = 'http';
});
