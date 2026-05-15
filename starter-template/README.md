# Static Site Starter — works with headless-wp-onboard

Minimal scaffold for a new client's static main site. Pair with WordPress
headless blog via `headless-wp-onboard`.

## Files

- `index.html` — landing page with placeholders (`{{BRAND}}`, `{{DOMAIN}}`, `{{TAGLINE}}`)
- `blog.html` — blog listing page, loads posts dynamically from `/wp-json/wp/v2/posts`

After cloning:

1. Replace placeholders in HTML files with the client's actual brand info
2. Run `headless-wp-onboard init` to set up Netlify proxy + WP backend
3. The `init` command generates `netlify.toml` and `robots.txt` here
4. Commit and push — Netlify deploys

Adapt the styles freely. The only requirement is that `blog.html` keeps its
fetch call to `/wp-json/wp/v2/posts` so it can render the WP posts list.
