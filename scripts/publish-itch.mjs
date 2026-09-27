// Builds the itch.io package and pushes it with butler, itch's uploader.
//
//   npm run publish:itch
//
// Reads BUTLER_API_KEY and ITCH_TARGET from .env.itch, which is gitignored and never read by the
// Vite build. butler is fetched into .cache/butler on first use. It pushes to the `html5` channel;
// butler sends only what changed since the last push, so an update is usually a few hundred KB.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { arch } from 'node:os';
import { join } from 'node:path';

const ENV_FILE = '.env.itch';
const ZIP = join('release', 'collapse-field-html5.zip');
const BUTLER_DIR = join('.cache', 'butler');
const BUTLER = join(BUTLER_DIR, 'butler');
const CHANNEL = 'html5';

const fail = (msg) => {
  console.error(`publish-itch: ${msg}`);
  process.exit(1);
};

function readEnv() {
  if (!existsSync(ENV_FILE)) fail(`${ENV_FILE} is missing; it holds BUTLER_API_KEY and ITCH_TARGET`);
  const env = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  if (!env.BUTLER_API_KEY) fail(`BUTLER_API_KEY is empty in ${ENV_FILE}; generate one at https://itch.io/user/settings/api-keys`);
  if (!/^[\w-]+\/[\w-]+$/.test(env.ITCH_TARGET ?? '')) fail(`ITCH_TARGET in ${ENV_FILE} must look like username/project`);
  return env;
}

function ensureButler() {
  if (existsSync(BUTLER)) return;
  const channel = `darwin-${arch() === 'arm64' ? 'arm64' : 'amd64'}`;
  if (process.platform !== 'darwin') fail('fetching butler is only scripted for macOS; install it from https://itch.io/docs/butler/');
  mkdirSync(BUTLER_DIR, { recursive: true });
  const archive = join(BUTLER_DIR, 'butler.zip');
  execFileSync('curl', ['-sSL', '-o', archive, `https://broth.itch.zone/butler/${channel}/LATEST/archive/default`], { stdio: 'inherit' });
  execFileSync('unzip', ['-o', '-q', archive, '-d', BUTLER_DIR], { stdio: 'inherit' });
  chmodSync(BUTLER, 0o755);
}

const env = readEnv();
ensureButler();
execFileSync('npm', ['run', 'package:itch'], { stdio: 'inherit' });

// the version shown on itch: the package version plus the commit it was built from
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
let commit = 'local';
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  /* not a git checkout */
}
const target = `${env.ITCH_TARGET}:${CHANNEL}`;
console.log(`publish-itch: pushing ${ZIP} to ${target} as ${version}+${commit}`);
execFileSync(BUTLER, ['push', ZIP, target, '--userversion', `${version}+${commit}`], {
  stdio: 'inherit',
  // handed to butler only; never written anywhere or printed
  env: { ...process.env, BUTLER_API_KEY: env.BUTLER_API_KEY },
});
execFileSync(BUTLER, ['status', env.ITCH_TARGET], { stdio: 'inherit', env: { ...process.env, BUTLER_API_KEY: env.BUTLER_API_KEY } });
