# headless-wp-onboard

> Onboard a new client to a Netlify static site + Hostinger WordPress headless blog at `/blog`, in ~30 minutes instead of 4 hours.

This tool automates ~70% of the work involved in setting up the architecture
proven on `ecolive.in`:

- Static main site on Netlify
- WordPress on Hostinger as a headless CMS at `cms.<domain>`
- Reverse proxy so `<domain>/blog/<slug>` appears at the primary domain
- SEO-safe (canonical URLs, 301 redirects, sitemap on primary domain)

It's **agent-agnostic** — Claude, Codex, Antigravity, Cursor, or a human can drive it.

## Three ways to use this

### A. As a guided playbook for an AI agent
Open `PLAYBOOK.md` and tell your AI assistant: *"Follow this playbook to
onboard the new client."* The playbook tells the AI exactly what to do, and
defers all real work to the CLI below.

### B. As a CLI (recommended)
```sh
npx headless-wp-onboard init
```
Asks you 10–12 questions, then runs every automatable step. The full
non-interactive command set:
```
headless-wp-onboard init               # Full interactive setup
headless-wp-onboard configure-wp       # Just configure WP options
headless-wp-onboard install-plugin     # Just install SEO redirect plugin
headless-wp-onboard migrate --posts posts.json
headless-wp-onboard dns                # Provision NS records for cms subdomain
headless-wp-onboard generate-files     # Write netlify.toml + robots.txt
headless-wp-onboard verify             # Run smoke tests
```

### C. As a template repo
Copy `starter-template/` into a new repo as the starting point for the
static main site. It has the right folder layout and a minimal index.html.

## Requirements

- Node.js 18+
- `zip` CLI (for building the plugin package) — preinstalled on macOS
  and most Linux distros
- A Hostinger account with WordPress installed at the target `cms.<domain>`
- DNS access for the primary domain (Cloudflare / Netlify DNS / GoDaddy / etc.)

## What gets automated

| Step | Automated? |
|---|---|
| WordPress URL & permalink config | ✅ via XML-RPC |
| Site title / tagline | ✅ via XML-RPC |
| SEO redirect plugin install | ✅ via REST API |
| LiteSpeed cache purge | ✅ via WP admin-ajax |
| DNS records for cms subdomain | ✅ Cloudflare + Netlify DNS |
| Bulk content migration | ✅ via XML-RPC |
| `netlify.toml` + `robots.txt` generation | ✅ template-based |
| Smoke tests after deploy | ✅ via fetch() |
| Hostinger WordPress install | ❌ Manual (no public API) |
| GoDaddy / Hostinger DNS records | ❌ Prints manual instructions |

## DNS providers supported

- **Cloudflare** — fully automated (needs API token, Zone:DNS:Edit)
- **Netlify DNS** — fully automated (needs personal access token)
- **GoDaddy** — prints exact records to paste manually
- **Hostinger DNS** — prints exact records to paste manually

## Config file (`client.json`)

`init` saves your answers to `./client.json`. **Add this to .gitignore** —
it contains passwords. Re-run any sub-command with `--config client.json`
without retyping.

```json
{
  "domain": "yourbrand.com",
  "cms_domain": "cms.yourbrand.com",
  "blog_path": "/blog",
  "site_title": "Yourbrand Insights",
  "site_tagline": "...",
  "brand": "Yourbrand",
  "wp": {
    "user": "admin@yourbrand.com",
    "pass": "...",
    "app_password": "..."
  },
  "dns": { "provider": "cloudflare", "token": "..." },
  "hostinger_ns": ["aurora.dns-parking.com", "nebula.dns-parking.com"],
  "posts_file": "./posts.json",
  "site_repo_path": "../yourbrand-website"
}
```

## Sandbox: how this was developed

Built and proven against `ecolive.in`. Migrated 9 posts, set up SEO
redirects, sitemap proxy, robots.txt, and full verification. See
`PLAYBOOK.md` "Known gotchas" for the bugs discovered along the way.

## License

MIT.
