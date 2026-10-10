import {spawn} from 'node:child_process';
import type {ChildProcess} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

jest.setTimeout(30_000);

const SERVER_ENTRY = path.resolve(__dirname, '../src/server.ts');

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const {port} = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

async function waitFor(read: () => string, text: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!read().includes(text)) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for "${text}". Output so far:\n${read()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe.each(['SIGINT', 'SIGTERM'] as const)('процесс сервера получает %s', (signal) => {
  let dir: string;
  let child: ChildProcess | undefined;
  let output = '';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tracker-e2e-'));
    output = '';
  });

  afterEach(() => {
    child?.kill('SIGKILL');
    fs.rmSync(dir, {recursive: true, force: true});
  });

  it('корректно останавливается и завершается с кодом 0', async () => {
    const port = await freePort();

    child = spawn(process.execPath, ['--import', 'tsx', SERVER_ENTRY], {
      env: {
        ...process.env,
        PORT: String(port),
        DB_PATH: path.join(dir, 'app.db'),
        BOOTSTRAP_API_KEY: 'e2e-bootstrap-key-0123456789',
        CMC_API_KEY: 'e2e-cmc-key',
        CMC_BASE_URL: 'http://127.0.0.1:9',
        SYNC_INTERVAL_MS: '60000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const collect = (chunk: Buffer) => {
      output += chunk.toString();
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);

    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      child?.once('exit', (code, killedBy) => resolve({code, signal: killedBy}));
    });

    await waitFor(() => output, 'Server started', 20_000);
    child.kill(signal);

    expect(await exited).toEqual({code: 0, signal: null});
    expect(output).toContain('Shutting down');
  });
});
