import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = resolve(
  process.env.PIN_NOTE_DATA_DIR ||
    resolve(homedir(), 'Library/Application Support/PinNote-db-koushin'),
  'database.json'
);
const config = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
const args = process.argv.slice(2);
const child = spawn(resolve(root, 'mvnw'), args.length ? args : ['spring-boot:run'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...config, ...process.env },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
