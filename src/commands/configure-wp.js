import { setOptions, verifyCredentials } from '../wp/xmlrpc.js';
import { loadConfig, log } from '../lib/util.js';

export async function runConfigureWp(opts) {
  const cfg = await loadConfig(opts.config);
  log.title('Configuring WordPress');

  log.info(`Verifying credentials for ${cfg.wp.user} @ ${cfg.cms_domain}…`);
  const ok = await verifyCredentials(cfg.cms_domain, cfg.wp.user, cfg.wp.pass);
  if (!ok) throw new Error('Credentials invalid or XML-RPC not reachable.');
  log.ok('Credentials valid');

  // KNOWN GOTCHA: WP "Cookie check failed" appears when home != siteurl during admin actions.
  // For XML-RPC writes this doesn't matter — we use direct auth. But once we set home to the public
  // domain, the next admin-UI step needs siteurl=cms_domain to be saved first (it is, below).
  const options = {
    blogname: cfg.site_title,
    blog_tagline: cfg.site_tagline || '',
    home: `https://${cfg.domain}`,
    siteurl: `https://${cfg.cms_domain}`,
    permalink_structure: `${cfg.blog_path}/%postname%/`,
  };
  log.info('Setting blog title, tagline, home/siteurl, permalink structure…');
  await setOptions(cfg.cms_domain, cfg.wp.user, cfg.wp.pass, options);
  log.ok(`Site title → "${cfg.site_title}"`);
  log.ok(`Site URL → https://${cfg.domain}`);
  log.ok(`Admin URL → https://${cfg.cms_domain}`);
  log.ok(`Permalinks → ${cfg.blog_path}/%postname%/`);
}
