import { test as base, expect } from '@playwright/test';
import { fork } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createServer } from 'vite';
import { withPostgres } from './postgres';

export const test = base.extend<{ database: string; app: { url: string; command: (method: string, value?: unknown) => Promise<any> } }>({
  database: async ({}, use) => { await withPostgres(use); },
  app: async ({ database }, use, info) => {
    const directory = await mkdtemp(`${tmpdir()}/picie-e2e-`);
    await mkdir(`${directory}/photos`);
    const child = fork(fileURLToPath(new URL('../../backend/e2e/server.js', import.meta.url)), [], {
      cwd: directory, silent: true,
      env: {
        PATH: process.env.PATH, XDG_CACHE_HOME: `${directory}/cache`, NODE_ENV: 'e2e',
        POSTGRES_HOST: database, POSTGRES_NAME: 'postgres',
        POSTGRES_USER: 'e2e', POSTGRES_PASSWORD: 'synthetic',
        JWT_SECRET: randomBytes(32).toString('hex'),
        PHOTO_ENC_KEY: randomBytes(32).toString('base64'),
        PHOTO_STORAGE_PATH: `${directory}/photos`,
      },
    });
    let log = '', sequence = 0;
    child.stdout?.on('data', bytes => { log += bytes.toString(); });
    child.stderr?.on('data', bytes => { log += bytes.toString(); });
    const pending = new Map<number, { resolve: Function; reject: Function; timer: ReturnType<typeof setTimeout> }>();
    child.on('message', (message: any) => {
      const request = pending.get(message.id);
      if (request) {
        clearTimeout(request.timer); pending.delete(message.id);
        message.error ? request.reject(new Error(message.error)) : request.resolve(message.result);
      }
    });
    const command = (method: string, value?: unknown): Promise<any> => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Fixture command timed out: ${method}`)); }, 20000);
      pending.set(id, { resolve, reject, timer }); child.send({ id, method, value });
    });
    let vite: Awaited<ReturnType<typeof createServer>> | undefined;
    try {
      const port = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Backend failed to start: ${log}`)), 20000);
        child.once('exit', () => { clearTimeout(timer); reject(new Error(`Backend exited: ${log}`)); });
        child.on('message', (m: any) => { if (m.ready) { clearTimeout(timer); resolve(m.port); } });
      });
      const root = fileURLToPath(new URL('..', import.meta.url));
      vite = await createServer({ root, configFile: `${root}/vite.config.ts`, envDir: false,
        define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') },
        server: {
          host: '127.0.0.1', port: 0,
          watch: { ignored: ['**/e2e-results/**', '**/e2e-report/**', '**/test-results/**', '**/playwright-report/**'] },
          proxy: { '/api': `http://127.0.0.1:${port}` },
        },
      });
      await vite.listen();
      await use({ url: vite.resolvedUrls!.local[0], command });
    } finally {
      if (info.status !== info.expectedStatus) await info.attach('backend.log', { body: log, contentType: 'text/plain' });
      await vite?.close();
      if (child.connected) await command('stop').catch(() => {});
      if (child.connected) child.disconnect();
      child.kill();
      for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Fixture stopped')); }
      await rm(directory, { recursive: true, force: true });
    }
  },
});
export { expect };
