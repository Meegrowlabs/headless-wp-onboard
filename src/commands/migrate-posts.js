import { readFile } from 'node:fs/promises';
import { newPost } from '../wp/xmlrpc.js';
import { loadConfig, log, progressBar } from '../lib/util.js';

export async function runMigratePosts(opts) {
  const cfg = await loadConfig(opts.config);
  const postsRaw = await readFile(opts.posts, 'utf-8');
  const posts = JSON.parse(postsRaw);
  if (!Array.isArray(posts)) throw new Error('posts.json must be an array of post objects.');

  log.title(`Migrating ${posts.length} posts → ${cfg.cms_domain}`);

  const results = [];
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    process.stdout.write(`${progressBar(i + 1, posts.length)} ${p.slug}\n`);
    try {
      const id = await newPost(cfg.cms_domain, cfg.wp.user, cfg.wp.pass, p);
      log.ok(`post_id=${id} (${p.slug})`);
      results.push({ slug: p.slug, id, ok: true });
    } catch (e) {
      log.fail(`${p.slug}: ${e.message}`);
      results.push({ slug: p.slug, ok: false, error: e.message });
    }
  }
  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  console.log(`\n📊 ${ok} success, ${fail} failed`);
  if (fail) process.exitCode = 1;
}
