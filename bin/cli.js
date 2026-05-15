#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from '../src/commands/init.js';
import { runConfigureWp } from '../src/commands/configure-wp.js';
import { runMigratePosts } from '../src/commands/migrate-posts.js';
import { runInstallPlugin } from '../src/commands/install-plugin.js';
import { runDns } from '../src/commands/dns.js';
import { runGenerateFiles } from '../src/commands/generate-files.js';
import { runVerify } from '../src/commands/verify.js';

const program = new Command();
program
  .name('headless-wp-onboard')
  .description('Set up a Netlify + Hostinger WordPress headless blog at /blog for a new client.')
  .version('0.1.0');

program
  .command('init')
  .description('Interactive end-to-end setup. Asks for all inputs, runs every step.')
  .option('--config <path>', 'Path to existing client.json to skip prompts')
  .action(runInit);

program
  .command('configure-wp')
  .description('Set WordPress site URLs, title, permalinks via XML-RPC.')
  .option('--config <path>', 'Path to client.json', './client.json')
  .action(runConfigureWp);

program
  .command('migrate')
  .description('Bulk-import posts from a JSON file via XML-RPC.')
  .requiredOption('--posts <path>', 'Path to posts.json')
  .option('--config <path>', 'Path to client.json', './client.json')
  .action(runMigratePosts);

program
  .command('install-plugin')
  .description('Upload and activate the SEO redirect plugin (built from template).')
  .option('--config <path>', 'Path to client.json', './client.json')
  .action(runInstallPlugin);

program
  .command('dns')
  .description('Provision NS records for the CMS subdomain (Cloudflare/Netlify automated, others manual).')
  .option('--config <path>', 'Path to client.json', './client.json')
  .action(runDns);

program
  .command('generate-files')
  .description('Write netlify.toml and robots.txt to the static-site repo path.')
  .option('--config <path>', 'Path to client.json', './client.json')
  .option('--out <path>', 'Output directory', '.')
  .action(runGenerateFiles);

program
  .command('verify')
  .description('Smoke-test the full setup with curl checks.')
  .option('--config <path>', 'Path to client.json', './client.json')
  .action(runVerify);

program.parseAsync(process.argv).catch((err) => {
  console.error('\n❌ Error:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
