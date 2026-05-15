import { loadConfig, log } from '../lib/util.js';

async function head(url, followRedirect = false) {
  return fetch(url, { method: 'HEAD', redirect: followRedirect ? 'follow' : 'manual' });
}

async function getText(url) {
  const res = await fetch(url);
  return { status: res.status, body: await res.text() };
}

export async function runVerify(opts) {
  const cfg = await loadConfig(opts.config);
  log.title(`Verifying setup for ${cfg.domain}`);

  const checks = [
    {
      name: `Direct cms.${cfg.domain} blog URL should 301`,
      run: async () => {
        // cachebust so LiteSpeed doesn't serve a stale 200 from before plugin install
        const r = await head(`https://${cfg.cms_domain}${cfg.blog_path}/hello-world/?_=${Date.now()}`);
        const loc = r.headers.get('location') || '';
        if (r.status === 301 && loc.startsWith(`https://${cfg.domain}`)) {
          return { ok: true, msg: `301 → ${loc}` };
        }
        return { ok: false, msg: `Expected 301 to ${cfg.domain}, got ${r.status} (location: ${loc || '<none>'})` };
      },
    },
    {
      name: `Proxied URL via ${cfg.domain} should 200`,
      run: async () => {
        const r = await head(`https://${cfg.domain}${cfg.blog_path}/hello-world/`);
        return r.status === 200 ? { ok: true, msg: '200 OK' } : { ok: false, msg: `Got ${r.status}` };
      },
    },
    {
      name: 'Page title contains site title',
      run: async () => {
        const r = await getText(`https://${cfg.domain}${cfg.blog_path}/hello-world/`);
        const m = r.body.match(/<title>([^<]*)<\/title>/);
        const title = m ? m[1] : '';
        const expected = cfg.site_title;
        if (title.includes(expected)) return { ok: true, msg: `"${title}"` };
        return { ok: false, msg: `Title does not contain "${expected}": "${title}"` };
      },
    },
    {
      name: 'Canonical URL is on primary domain',
      run: async () => {
        const r = await getText(`https://${cfg.domain}${cfg.blog_path}/hello-world/`);
        const m = r.body.match(/<link rel="canonical" href="([^"]+)"/);
        const canonical = m ? m[1] : '';
        if (canonical.startsWith(`https://${cfg.domain}`)) return { ok: true, msg: canonical };
        return { ok: false, msg: `Canonical: ${canonical || '<none>'}` };
      },
    },
    {
      name: 'wp-admin still accessible on cms subdomain',
      run: async () => {
        const r = await head(`https://${cfg.cms_domain}/wp-admin/`);
        return r.status === 302 || r.status === 200
          ? { ok: true, msg: `${r.status}` }
          : { ok: false, msg: `${r.status} (expected 302 → login or 200)` };
      },
    },
    {
      name: 'Sitemap reachable on primary domain',
      run: async () => {
        // cachebust to skip stale Netlify edge responses
        const r = await head(`https://${cfg.domain}/wp-sitemap.xml?_=${Date.now()}`);
        return r.status === 200 ? { ok: true, msg: '200 OK' } : { ok: false, msg: `${r.status}` };
      },
    },
    {
      name: 'robots.txt on primary domain',
      run: async () => {
        const r = await getText(`https://${cfg.domain}/robots.txt`);
        if (r.status === 200 && r.body.includes('Sitemap:')) return { ok: true, msg: 'Found sitemap reference' };
        return { ok: false, msg: `${r.status}, no sitemap line` };
      },
    },
  ];

  let pass = 0, fail = 0;
  for (const c of checks) {
    try {
      const r = await c.run();
      if (r.ok) {
        log.ok(`${c.name} — ${r.msg}`);
        pass++;
      } else {
        log.fail(`${c.name} — ${r.msg}`);
        fail++;
      }
    } catch (e) {
      log.fail(`${c.name} — ${e.message}`);
      fail++;
    }
  }
  console.log(`\n📊 ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}
