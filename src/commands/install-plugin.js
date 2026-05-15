import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { uploadAndActivatePlugin, purgeLiteSpeedCache } from '../wp/plugin-upload.js';
import { loadConfig, loadTemplate, render, log } from '../lib/util.js';

export async function runInstallPlugin(opts) {
  const cfg = await loadConfig(opts.config);
  if (!cfg.wp.app_password) {
    throw new Error(
      'Missing wp.app_password in config. Generate one in WordPress → Users → Profile → Application Passwords, then add it to client.json.\n\n' +
      'NOTE: If "Cookie check failed" appears in WP admin when generating the app password, ' +
      'temporarily change Site Address (URL) back to cms.<domain>, generate the password, then restore.'
    );
  }
  log.title('Installing SEO redirect plugin');

  const slug = cfg.plugin_slug || `${slugify(cfg.brand || 'ecolive')}-seo-redirect`;
  const phpTemplate = await loadTemplate('seo-redirect.php.tpl');
  const phpContent = render(phpTemplate, {
    DOMAIN: cfg.domain,
    CMS_DOMAIN: cfg.cms_domain,
    BRAND: cfg.brand || cfg.site_title || 'Site',
  });

  // Build a ZIP with proper folder structure: <slug>/<slug>.php
  const workDir = join(tmpdir(), `hwo-${Date.now()}`);
  await mkdir(join(workDir, slug), { recursive: true });
  await writeFile(join(workDir, slug, `${slug}.php`), phpContent);
  const zipPath = join(workDir, `${slug}.zip`);
  try {
    execSync(`cd "${workDir}" && zip -qr "${zipPath}" "${slug}/"`, { stdio: 'pipe' });
  } catch (e) {
    throw new Error('`zip` command not found. Install zip (apt install zip / brew install zip).');
  }
  log.ok(`Built plugin zip → ${zipPath}`);

  log.info('Uploading + activating via WordPress REST API…');
  await uploadAndActivatePlugin(cfg.cms_domain, cfg.wp.user, cfg.wp.app_password, zipPath, slug);
  log.ok('Plugin uploaded + activated');

  // KNOWN GOTCHA: LiteSpeed cache (Hostinger default) holds stale HTML for cached posts.
  // Without purging, the redirect won't appear to work until cache expires.
  log.info('Purging LiteSpeed cache…');
  const purged = await purgeLiteSpeedCache(cfg.cms_domain, cfg.wp.user, cfg.wp.app_password);
  log[purged ? 'ok' : 'warn'](
    purged ? 'Cache purged' : 'Could not purge cache via API — purge manually in WP → LiteSpeed → Toolbox'
  );

  await rm(workDir, { recursive: true, force: true });
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
