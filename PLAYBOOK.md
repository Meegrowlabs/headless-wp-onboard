# Headless WordPress Onboarding — Agent Playbook

This file is the **agent-agnostic operating manual**. Any AI coding assistant
(Claude Code, Codex, Antigravity, Cursor, Continue, etc.) can be pointed at
this file and follow the workflow to onboard a new client. The agent runs the
CLI tool `headless-wp-onboard` for the heavy lifting; the agent is just the
conductor.

## Architecture being installed

```
yourbrand.com         → Netlify (static main site)
yourbrand.com/blog    → Netlify (proxies all /blog/* to Hostinger WP)
cms.yourbrand.com     → Hostinger WordPress (editor only)
```

A reverse proxy on Netlify makes WordPress content appear under the primary
domain. Direct visits to `cms.yourbrand.com` 301 to the primary domain. SEO,
sitemap, and canonical URLs all live on the primary domain.

## Prerequisites you (or the human) must do BEFORE running this

1. Buy a domain (any registrar).
2. Create a Hostinger account and install WordPress at `cms.<domain>`.
3. From Hostinger hPanel, copy the **nameserver pair** shown under
   Domain → Connect (e.g. `aurora.dns-parking.com` / `nebula.dns-parking.com`).
4. If DNS is on Cloudflare: get an API token (My Profile → API Tokens →
   Create Token → "Edit zone DNS" template, scope to the domain's zone).
5. If DNS is on Netlify DNS: get a personal access token (User settings →
   Applications → Personal access tokens → New).
6. The static site repo should exist (a basic HTML site). If not, copy
   `starter-template/` from this package as a starting point.

## What the agent should do — step by step

### Step 1 — Confirm prerequisites with the user

Ask: "Is WordPress installed at `cms.<domain>`?" and "Do you have the
nameserver pair from Hostinger?" If no, walk the user through the Hostinger UI.
**Do not skip this** — running steps below before WP exists will fail.

### Step 2 — Run `headless-wp-onboard init`

```
npx headless-wp-onboard init
```

The CLI handles the interactive Q&A. The agent's job here is to **not
duplicate the prompts** — let the CLI ask. The agent only narrates progress
to the user and helps debug errors.

The CLI will:
- Verify WordPress credentials via XML-RPC
- Configure WP options (title, tagline, permalinks, home/siteurl)
- Build & upload the SEO redirect plugin (needs WP application password)
- Provision DNS for the cms subdomain
- Migrate posts if a JSON file is provided
- Generate `netlify.toml` and `robots.txt` in the static-site repo

### Step 3 — Help the user commit & deploy

After `init` completes, the static-site repo has new files. Tell the user:

```
git add -A
git commit -m "Add headless WordPress + Netlify proxy config"
git push
```

Netlify will auto-deploy.

### Step 4 — Wait for DNS, then verify

DNS for the cms subdomain takes 5–30 minutes. Once it resolves
(`dig <cms-domain> +short` returns an IP):

```
npx headless-wp-onboard verify
```

This runs 7 smoke tests. If anything fails, see "Known gotchas" below.

### Step 5 — Hand off and security cleanup

After verify is green:
- Tell the user to **change their WordPress admin password** (passwords
  given to the CLI are stored in `client.json` and should be treated as
  compromised).
- Recommend they `.gitignore client.json` if they haven't already.
- Set up a build hook in Netlify if they want auto-rebuild on new posts
  (optional with a proxy setup — new WP posts appear instantly).

## Known gotchas (read these before debugging)

### "Cookie check failed" when creating WP application passwords
WordPress sets cookies based on the `home` URL. If `home = ecolive.in` but
the admin UI is at `cms.ecolive.in`, the cookie domains mismatch and form
submissions like app-password creation fail silently with this notice.

**Fix:** temporarily set Site Address (URL) back to the `cms.<domain>` value,
create the application password, then set Site Address back to the primary
domain. Or use the **WP REST API plugin upload** approach the CLI uses,
which doesn't depend on the admin AJAX cookies.

### LiteSpeed cache serves stale HTML
Hostinger ships LiteSpeed Cache enabled by default. Changes to permalinks,
site title, or active plugins won't appear until cache is purged.

**Fix:** WP admin → LiteSpeed Cache → Toolbox → Purge All. The CLI does this
automatically after installing the plugin.

### Cloudflare zone not found
If `delegate-cms-subdomain` errors with "no zone found", the domain isn't
on Cloudflare yet, OR the API token doesn't have permission for that zone.
Verify with: `curl https://api.cloudflare.com/client/v4/zones?name=<domain>
-H "Authorization: Bearer <token>"` — should return the zone in `result`.

### Netlify DNS zone not found
Same idea — domain must be using Netlify DNS (NS records pointing to
`nsone.net`). Check with `dig NS <domain> +short`.

### Direct cms.<domain> still serves content instead of 301
The SEO redirect plugin is either not active, or LiteSpeed has cached
the pre-plugin response. Purge LiteSpeed cache.

### Page title still shows "cms.<domain>" instead of the brand
Same cause — cache. Purge LiteSpeed.

### `unzip` command not found in CI/sandbox
The CLI uses `zip` to build the plugin. If `zip` isn't available, install
it: `apt install zip` (Debian/Ubuntu), `brew install zip` (macOS), etc.

## Sub-commands the agent can run individually

If a step fails or needs to be redone:

```
headless-wp-onboard configure-wp     # Re-apply WP options
headless-wp-onboard install-plugin   # Re-upload SEO plugin
headless-wp-onboard dns              # Re-provision DNS
headless-wp-onboard migrate --posts posts.json
headless-wp-onboard generate-files --out ../my-static-site
headless-wp-onboard verify
```

All commands use `./client.json` by default.

## posts.json schema (for migration)

```json
[
  {
    "slug": "url-friendly-slug",
    "title": "Post Title",
    "date": "2026-05-15",
    "category": "Category Name",
    "excerpt": "Short summary used as meta description.",
    "content": "<p>HTML body content.</p><h2>Subheading</h2><p>...</p>"
  }
]
```

Existing static HTML files can be converted with a small script — see
`scripts/import-static-to-json.js` (in the starter template).
