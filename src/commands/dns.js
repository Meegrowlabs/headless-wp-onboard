import * as cf from '../dns/cloudflare.js';
import * as nldns from '../dns/netlify-dns.js';
import { loadConfig, log } from '../lib/util.js';

export async function runDns(opts) {
  const cfg = await loadConfig(opts.config);
  const provider = cfg.dns?.provider;
  if (!provider) throw new Error('Missing dns.provider in config (cloudflare | netlify-dns | manual).');
  if (!cfg.hostinger_ns || cfg.hostinger_ns.length === 0) {
    throw new Error('Missing hostinger_ns array in config (e.g. ["aurora.dns-parking.com", "nebula.dns-parking.com"])');
  }

  log.title(`DNS provisioning — ${provider}`);

  if (provider === 'cloudflare') {
    if (!cfg.dns.token) throw new Error('Missing dns.token for Cloudflare');
    const r = await cf.delegateCmsSubdomain(
      cfg.dns.token,
      cfg.domain,
      cfg.cms_domain,
      cfg.hostinger_ns
    );
    r.created.forEach((rec) => {
      if (rec.skipped) log.ok(`Skipped existing NS → ${rec.content || rec.value}`);
      else log.ok(`Added NS ${cfg.cms_domain} → ${rec.content || rec.value || '?'}`);
    });
    return;
  }

  if (provider === 'netlify-dns') {
    if (!cfg.dns.token) throw new Error('Missing dns.token for Netlify DNS');
    const r = await nldns.delegateCmsSubdomain(
      cfg.dns.token,
      cfg.domain,
      cfg.cms_domain,
      cfg.hostinger_ns
    );
    r.created.forEach((rec) => {
      if (rec.skipped) log.ok(`Skipped existing NS → ${rec.value}`);
      else log.ok(`Added NS ${cfg.cms_domain} → ${rec.value || rec.content}`);
    });
    return;
  }

  // Manual providers: print instructions
  log.notice(
    `\nDNS provider "${provider}" is not automated. Please add these records manually in your DNS panel:\n`
  );
  cfg.hostinger_ns.forEach((ns) => {
    console.log(`  Type: NS    Name: ${cfg.cms_domain.replace(`.${cfg.domain}`, '')}    Value: ${ns}    TTL: 3600`);
  });
  console.log(`\nDo NOT change the nameservers for the root domain (${cfg.domain}). Only add NS records for the cms subdomain.\n`);
}
