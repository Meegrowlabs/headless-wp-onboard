import { input, password, select, confirm } from '@inquirer/prompts';
import { resolve } from 'node:path';
import { verifyCredentials } from '../wp/xmlrpc.js';
import { loadConfig, saveConfig, log } from '../lib/util.js';
import { runConfigureWp } from './configure-wp.js';
import { runInstallPlugin } from './install-plugin.js';
import { runMigratePosts } from './migrate-posts.js';
import { runDns } from './dns.js';
import { runGenerateFiles } from './generate-files.js';
import { existsSync } from 'node:fs';

export async function runInit(opts) {
  log.title('headless-wp-onboard — interactive setup');

  let cfg;
  if (opts.config && existsSync(resolve(opts.config))) {
    cfg = await loadConfig(opts.config);
    log.info(`Loaded existing config from ${opts.config}`);
  } else {
    cfg = await collectConfig();
    const path = opts.config || './client.json';
    const saved = await saveConfig(path, cfg);
    log.ok(`Saved config → ${saved}`);
  }

  // Confirm before running side-effects
  console.log('\nWill run these steps:');
  console.log('  1. Verify WP credentials');
  console.log('  2. Configure WP (title, URLs, permalinks)');
  console.log('  3. Install SEO redirect plugin (if app password provided)');
  console.log(`  4. DNS records via ${cfg.dns.provider}`);
  console.log(`  5. Migrate ${cfg.posts_file ? 'posts from ' + cfg.posts_file : '(skipped — no posts file)'}`);
  console.log('  6. Generate netlify.toml + robots.txt');
  const go = await confirm({ message: 'Proceed?', default: true });
  if (!go) {
    log.warn('Aborted. Re-run with --config to resume.');
    return;
  }

  const configPath = opts.config || './client.json';

  log.step(1, 6, 'Verifying WordPress credentials');
  const ok = await verifyCredentials(cfg.cms_domain, cfg.wp.user, cfg.wp.pass);
  if (!ok) throw new Error('XML-RPC auth failed. Check user/password and that xmlrpc.php is reachable.');
  log.ok('Credentials valid');

  log.step(2, 6, 'Configuring WordPress');
  await runConfigureWp({ config: configPath });

  if (cfg.wp.app_password) {
    log.step(3, 6, 'Installing SEO redirect plugin');
    await runInstallPlugin({ config: configPath });
  } else {
    log.step(3, 6, 'Skipping plugin install — no app password set');
    log.info('Generate one in WP → Users → Profile → Application Passwords, then run: headless-wp-onboard install-plugin');
  }

  log.step(4, 6, 'Provisioning DNS');
  await runDns({ config: configPath });

  if (cfg.posts_file) {
    log.step(5, 6, `Migrating posts from ${cfg.posts_file}`);
    await runMigratePosts({ config: configPath, posts: cfg.posts_file });
  } else {
    log.step(5, 6, 'Skipping post migration');
  }

  log.step(6, 6, 'Generating Netlify config files');
  await runGenerateFiles({ config: configPath, out: cfg.site_repo_path || '.' });

  console.log('\n✨ Done. Next:');
  console.log(`   1. cd ${cfg.site_repo_path || '.'} && git add -A && git commit && git push`);
  console.log('   2. Wait ~5-30 min for DNS to propagate');
  console.log(`   3. Run: headless-wp-onboard verify --config ${configPath}`);
  console.log('   4. Change the WordPress password in WP admin (yours is in client.json — keep secret).');
}

async function collectConfig() {
  console.log('\nLet me gather the basics. Anything sensitive is saved to client.json (gitignore this file).\n');

  const domain = await input({ message: 'Primary domain (e.g. yourbrand.com)', validate: (s) => !!s.match(/^[a-z0-9.-]+\.[a-z]{2,}$/i) || 'Invalid domain' });
  const cms_domain = await input({ message: 'CMS subdomain', default: `cms.${domain}` });
  const blog_path = await input({ message: 'Blog path on main site', default: '/blog' });
  const site_title = await input({ message: 'Site title (appears in <title> tags)', default: 'Insights' });
  const site_tagline = await input({ message: 'Site tagline (optional)', default: '' });
  const brand = await input({ message: 'Brand name (one word, used in plugin slug)', default: site_title.split(' ')[0] });

  console.log('\n[ WordPress on Hostinger ]');
  const wp_installed = await confirm({ message: `Is WordPress already installed at ${cms_domain}?`, default: true });
  if (!wp_installed) {
    console.log(`\n→ Open https://hpanel.hostinger.com → Add Website → install WordPress on ${cms_domain}.`);
    console.log('  When done, re-run init.\n');
    throw new Error('Aborted — install WP first.');
  }
  const wp_user = await input({ message: 'WP admin email/username', validate: (s) => !!s || 'Required' });
  const wp_pass = await password({ message: 'WP admin password', mask: '*' });
  const wp_app_password = await password({
    message: 'WP application password (optional, for plugin install — leave empty to skip)',
    mask: '*',
  });

  console.log('\n[ DNS ]');
  const dns_provider = await select({
    message: 'Where is DNS managed?',
    choices: [
      { name: 'Cloudflare (automated)', value: 'cloudflare' },
      { name: 'Netlify DNS (automated)', value: 'netlify-dns' },
      { name: 'GoDaddy / Manual', value: 'manual' },
      { name: 'Hostinger DNS (manual)', value: 'manual-hostinger' },
    ],
  });
  let dns_token = '';
  if (dns_provider === 'cloudflare') {
    dns_token = await password({ message: 'Cloudflare API token (Zone:DNS:Edit perm)', mask: '*' });
  } else if (dns_provider === 'netlify-dns') {
    dns_token = await password({ message: 'Netlify personal access token', mask: '*' });
  }

  console.log('\n[ Hostinger nameservers ]');
  console.log('In Hostinger hPanel → your WP site → Domain → Connect, copy the NS pair shown.');
  const ns1 = await input({ message: 'Nameserver 1', default: 'aurora.dns-parking.com' });
  const ns2 = await input({ message: 'Nameserver 2', default: 'nebula.dns-parking.com' });

  console.log('\n[ Content & repo ]');
  const posts_file = await input({
    message: 'Path to posts JSON file (or empty to skip migration)',
    default: '',
  });
  const site_repo_path = await input({
    message: 'Path to your static-site repo (where netlify.toml will be written)',
    default: '.',
  });

  return {
    domain,
    cms_domain,
    blog_path,
    site_title,
    site_tagline,
    brand,
    wp: { user: wp_user, pass: wp_pass, app_password: wp_app_password || null },
    dns: { provider: dns_provider, token: dns_token || null },
    hostinger_ns: [ns1, ns2].filter(Boolean),
    posts_file: posts_file || null,
    site_repo_path,
  };
}
