import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const exec = promisify(execFile);

export async function withPostgres(use: (socketDirectory: string) => Promise<void>) {
  const directory = await mkdtemp(`${tmpdir()}/picie-pg-`);
  const bin = process.env.E2E_PG_BIN;
  const binary = (name: string) => bin ? `${bin}/${name}` : name;
  let started = false;
  try {
    await exec(binary('initdb'), ['-D', `${directory}/data`, '-U', 'e2e', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
    // A private Unix socket only: no TCP listener or existing database is used.
    await exec(binary('pg_ctl'), ['-D', `${directory}/data`, '-l', `${directory}/postgres.log`, '-w', 'start',
      '-o', `-k ${directory} -c listen_addresses='' -c unix_socket_permissions=0700`]);
    started = true;
    await use(directory);
  } finally {
    if (started) await exec(binary('pg_ctl'), ['-D', `${directory}/data`, '-m', 'immediate', '-w', 'stop']);
    await rm(directory, { recursive: true, force: true });
  }
}
