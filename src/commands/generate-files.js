import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { loadConfig, loadTemplate, render, log } from '../lib/util.js';

export async function runGenerateFiles(opts) {
  const cfg = await loadConfig(opts.config);
  const out = resolve(opts.out || '.');
  log.title(`Generating files in ${out}`);

  const vars = {
    DOMAIN: cfg.domain,
    CMS_DOMAIN: cfg.cms_domain,
    BLOG_PATH: cfg.blog_path,
    BRAND: cfg.brand || cfg.site_title || 'Site',
  };

  await mkdir(out, { recursive: true });

  const netlifyToml = render(await loadTemplate('netlify.toml.tpl'), vars);
  await writeFile(join(out, 'netlify.toml'), netlifyToml);
  log.ok(`Wrote ${join(out, 'netlify.toml')}`);

  const robots = render(await loadTemplate('robots.txt.tpl'), vars);
  await writeFile(join(out, 'robots.txt'), robots);
  log.ok(`Wrote ${join(out, 'robots.txt')}`);

  log.info(`\nNext: cd ${out} && git add -A && git commit -m "Add Netlify + WordPress proxy config" && git push`);
}
