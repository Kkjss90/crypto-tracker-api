import http from 'node:http';
import type {AddressInfo} from 'node:net';

export interface FakeResponse {
  status?: number;
  body?: unknown;
  rawBody?: string;
  delayMs?: number;
}

export interface FakeCmcServer {
  baseUrl: string;
  requests: Array<{ url: string; apiKey: string | undefined }>;
  respondWith: (handler: (url: URL) => FakeResponse) => void;
  close: () => Promise<void>;
}

export async function startFakeCmcServer(): Promise<FakeCmcServer> {
  let handler: (url: URL) => FakeResponse = () => ({status: 200, body: {}});
  const requests: FakeCmcServer['requests'] = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const header = req.headers['x-cmc_pro_api_key'];
    requests.push({url: req.url ?? '', apiKey: Array.isArray(header) ? header[0] : header});

    const planned = handler(url);
    setTimeout(() => {
      res.statusCode = planned.status ?? 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(planned.rawBody ?? JSON.stringify(planned.body ?? {}));
    }, planned.delayMs ?? 0);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    respondWith: (next) => {
      handler = next;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
