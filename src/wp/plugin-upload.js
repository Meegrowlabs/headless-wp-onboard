// Upload + activate a WordPress plugin via REST API using Application Passwords.
// Requires: an application password (generated in WP admin → Users → Profile).
import { readFile } from 'node:fs/promises';

async function authedFetch(host, path, options = {}, user, appPass) {
  const headers = {
    Authorization: 'Basic ' + Buffer.from(`${user}:${appPass}`).toString('base64'),
    ...(options.headers || {}),
  };
  const url = `https://${host}${path}`;
  return fetch(url, { ...options, headers });
}

export async function uploadAndActivatePlugin(host, user, appPass, zipPath, pluginSlug) {
  const zipData = await readFile(zipPath);
  // Step 1: upload zip via REST API
  const uploadRes = await authedFetch(
    host,
    `/wp-json/wp/v2/plugins?slug=${encodeURIComponent(pluginSlug)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${pluginSlug}.zip"`,
      },
      body: zipData,
    },
    user,
    appPass
  );
  if (!uploadRes.ok && uploadRes.status !== 201) {
    const txt = await uploadRes.text();
    throw new Error(`Plugin upload failed (${uploadRes.status}): ${txt.slice(0, 300)}`);
  }
  const created = await uploadRes.json();
  const pluginPath = created.plugin || `${pluginSlug}/${pluginSlug}.php`;

  // Step 2: activate
  const actRes = await authedFetch(
    host,
    `/wp-json/wp/v2/plugins/${encodeURIComponent(pluginPath)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    },
    user,
    appPass
  );
  if (!actRes.ok) {
    const txt = await actRes.text();
    throw new Error(`Plugin activation failed (${actRes.status}): ${txt.slice(0, 300)}`);
  }
  return await actRes.json();
}

// Clear LiteSpeed cache via REST API (Hostinger ships LiteSpeed by default).
// Falls back silently if endpoint not available.
export async function purgeLiteSpeedCache(host, user, appPass) {
  try {
    const res = await authedFetch(
      host,
      '/wp-admin/admin-ajax.php?action=litespeed_purge_all',
      { method: 'POST' },
      user,
      appPass
    );
    return res.ok;
  } catch {
    return false;
  }
}
