// Cloudflare DNS automation. Requires API token with Zone:DNS:Edit permission.
const CF_API = 'https://api.cloudflare.com/client/v4';

async function cfFetch(token, path, options = {}) {
  const res = await fetch(`${CF_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(
      `Cloudflare API error: ${data.errors?.map((e) => e.message).join(', ') || JSON.stringify(data)}`
    );
  }
  return data.result;
}

// Find zone ID for a domain (root domain like "ecolive.in")
export async function findZoneId(token, domain) {
  const zones = await cfFetch(token, `/zones?name=${encodeURIComponent(domain)}`);
  if (!zones || zones.length === 0) {
    throw new Error(`No Cloudflare zone found for domain "${domain}". Add the domain to Cloudflare first.`);
  }
  return zones[0].id;
}

// List existing DNS records (used to detect conflicts)
export async function listRecords(token, zoneId, name, type) {
  const params = new URLSearchParams({ name, type });
  return cfFetch(token, `/zones/${zoneId}/dns_records?${params}`);
}

// Add an NS record (used to delegate cms.<domain> to Hostinger)
export async function addNsRecord(token, zoneId, fullName, nsTarget, ttl = 3600) {
  return cfFetch(token, `/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'NS',
      name: fullName,
      content: nsTarget,
      ttl,
      proxied: false,
    }),
  });
}

// Add an A record (used for direct IP targets, e.g. Hostinger IP)
export async function addARecord(token, zoneId, fullName, ip, ttl = 3600, proxied = false) {
  return cfFetch(token, `/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'A',
      name: fullName,
      content: ip,
      ttl,
      proxied,
    }),
  });
}

// High-level: delegate cms.<domain> to Hostinger's NS pair via Cloudflare
export async function delegateCmsSubdomain(token, rootDomain, cmsSubdomain, nsList) {
  const zoneId = await findZoneId(token, rootDomain);
  const fullName = cmsSubdomain;
  const existing = await listRecords(token, zoneId, fullName, 'NS');
  const created = [];
  for (const ns of nsList) {
    if (existing.find((r) => r.content === ns)) {
      created.push({ skipped: true, content: ns });
      continue;
    }
    const r = await addNsRecord(token, zoneId, fullName, ns);
    created.push(r);
  }
  return { zoneId, created };
}
