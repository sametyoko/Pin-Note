import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
// 永続DBをiCloud同期対象のDocumentsに置かない。
const local =
  process.env.PIN_NOTE_DATA_DIR ||
  resolve(homedir(), 'Library/Application Support/PinNote-db-koushin');
const socket = resolve('/private/tmp', `pin-note-${process.getuid()}`);
mkdirSync(local, { recursive: true, mode: 0o700 });
mkdirSync(socket, { recursive: true, mode: 0o700 });
function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 60000, ...options });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || r.error?.message);
  return r.stdout;
}
const bin = run('pg_config', ['--bindir']).trim();
const data = resolve(local, 'postgres');
if (process.argv[2] === 'stop') {
  run(`${bin}/pg_ctl`, ['-D', data, 'stop', '-m', 'fast']);
  console.log('PostgreSQLを停止しました。記録は保持されています。');
  process.exit(0);
}
if (!existsSync(resolve(data, 'PG_VERSION')))
  run(`${bin}/initdb`, [
    '-D',
    data,
    '-U',
    'pin_note',
    '--auth-local=trust',
    '--auth-host=scram-sha-256',
    '--encoding=UTF8',
    '--locale=C',
  ]);
if (spawnSync(`${bin}/pg_ctl`, ['-D', data, 'status']).status !== 0)
  run(`${bin}/pg_ctl`, [
    '-D',
    data,
    '-l',
    resolve(local, 'postgres.log'),
    '-o',
    `-h 127.0.0.1 -p 55432 -k ${socket}`,
    'start',
  ]);
const configPath = resolve(local, 'database.json');
const config = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, 'utf8'))
  : {
      DB_URL: 'jdbc:postgresql://127.0.0.1:55432/pin_note',
      DB_USER: 'pin_note',
      DB_PASSWORD: randomBytes(24).toString('hex'),
    };
const psqlArgs = [
  '-h',
  socket,
  '-p',
  '55432',
  '-U',
  'pin_note',
  '-d',
  'postgres',
  '-v',
  'ON_ERROR_STOP=1',
  '-tA',
];
if (!existsSync(configPath)) {
  run(`${bin}/psql`, psqlArgs, {
    input: `ALTER ROLE pin_note WITH PASSWORD '${config.DB_PASSWORD}';`,
  });
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}
if (
  !run(`${bin}/psql`, psqlArgs, {
    input: "SELECT 1 FROM pg_database WHERE datname='pin_note';",
  }).trim()
)
  run(`${bin}/createdb`, ['-h', socket, '-p', '55432', '-U', 'pin_note', 'pin_note']);
console.log('PostgreSQLを起動しました（127.0.0.1:55432）。保存先: ' + local);
