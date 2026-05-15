// Netlify DNS automation. Requires personal access token from app.netlify.com → User settings → Applications.
const NL_API = 'https://api.netlify.com/api/v1';

async function nlFetch(token, path, options = {}) {
  const res = await fetch(`${NL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Netlify API error (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
}

// Find the DNS zone for a domain. Netlify DNS zones are listed under the user account.
export async function findDnsZone(token, domain) {
  const zones = await nlFetch(token, '/dns_zones');
  const zone = zones.find((z) => z.name === domain);
  if (!zone) {
    throw new Error(
      `No Netlify DNS zone found for "${domain}". The domain must be using Netlify DNS (NS records pointing to nsone.net).`
    );
  }
  return zone;
}

export async function listRecords(token, zoneId) {
  return nlFetch(token, `/dns_zones/${zoneId}/dns_records`);
}

export async function addRecord(token, zoneId, { type, hostname, value, ttl = 3600 }) {
  return nlFetch(token, `/dns_zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({ type, hostname, value, ttl }),
  });
}

// High-level: delegate cms.<domain> to Hostinger NS via Netlify DNS
export async function delegateCmsSubdomain(token, rootDomain, cmsSubdomain, nsList) {
  const zone = await findDnsZone(token, rootDomain);
  const existing = await listRecords(token, zone.id);
  const created = [];
  for (const ns of nsList) {
    const dup = existing.find(
      (r) => r.type === 'NS' && r.hostname === cmsSubdomain && r.value === ns
    );
    if (dup) {
      created.push({ skipped: true, value: ns });
      continue;
    }
    const r = await addRecord(token, zone.id, {
      type: 'NS',
      hostname: cmsSubdomain,
      value: ns,
    });
    created.push(r);
  }
  return { zoneId: zone.id, created };
}
