// Shared utilities: template render, config load/save, logging.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

export function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`Missing template variable: ${k}`);
    return vars[k];
  });
}

export async function loadTemplate(name) {
  const url = new URL(`../templates/${name}`, import.meta.url);
  return readFile(url, 'utf-8');
}

export async function loadConfig(path) {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(`Config file not found: ${abs}. Run \`init\` first or pass --config <path>.`);
  }
  return JSON.parse(await readFile(abs, 'utf-8'));
}

export async function saveConfig(path, config) {
  const abs = resolve(path);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, JSON.stringify(config, null, 2));
  return abs;
}

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

export const log = {
  step: (n, total, msg) => console.log(`${c.cyan}[${n}/${total}]${c.reset} ${msg}`),
  ok: (msg) => console.log(`  ${c.green}✓${c.reset} ${msg}`),
  fail: (msg) => console.log(`  ${c.red}✗${c.reset} ${msg}`),
  warn: (msg) => console.log(`  ${c.yellow}⚠${c.reset} ${msg}`),
  info: (msg) => console.log(`  ${c.dim}${msg}${c.reset}`),
  title: (msg) => console.log(`\n${c.bold}${c.blue}${msg}${c.reset}\n`),
  notice: (msg) => console.log(`${c.yellow}${msg}${c.reset}`),
};

export function progressBar(current, total, width = 20) {
  const pct = Math.round((current / total) * 100);
  const filled = Math.floor((pct / 100) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return `[${bar}] ${pct}% (${current}/${total})`;
}
