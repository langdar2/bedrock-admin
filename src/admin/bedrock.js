import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const DATA_PATH = process.env.BEDROCK_DATA_PATH || '/bedrock-data';

// --- server.properties ---

export function readProperties() {
  const file = join(DATA_PATH, 'server.properties');
  if (!existsSync(file)) return {};
  const lines = readFileSync(file, 'utf8').split('\n');
  const props = {};
  const comments = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) { comments.push(line); continue; }
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    props[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return { props, comments };
}

export function writeProperties(props, comments = []) {
  const file = join(DATA_PATH, 'server.properties');
  const lines = [...comments, '', ...Object.entries(props).map(([k, v]) => `${k}=${v}`)];
  writeFileSync(file, lines.join('\n') + '\n');
}

// --- allowlist.json ---

export function readAllowlist() {
  const file = join(DATA_PATH, 'allowlist.json');
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeAllowlist(list) {
  writeFileSync(join(DATA_PATH, 'allowlist.json'), JSON.stringify(list, null, 2));
}

// --- permissions.json ---

export function readPermissions() {
  const file = join(DATA_PATH, 'permissions.json');
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writePermissions(list) {
  writeFileSync(join(DATA_PATH, 'permissions.json'), JSON.stringify(list, null, 2));
}

// --- Worlds ---

export function listWorlds() {
  const worldsDir = join(DATA_PATH, 'worlds');
  if (!existsSync(worldsDir)) return [];
  return readdirSync(worldsDir).filter(name => {
    const full = join(worldsDir, name);
    return statSync(full).isDirectory();
  });
}

export function getActiveWorld() {
  const { props } = readProperties();
  return props?.['level-name'] || 'Bedrock level';
}

export function createWorld(name) {
  const worldsDir = join(DATA_PATH, 'worlds');
  const worldPath = join(worldsDir, name);
  if (existsSync(worldPath)) throw new Error('World already exists');
  mkdirSync(worldPath, { recursive: true });
  writeFileSync(join(worldPath, 'levelname.txt'), name);
}
