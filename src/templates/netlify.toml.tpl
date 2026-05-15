[build]
  publish = "."
  command = "echo 'No build step — static repo + WordPress proxy.'"

[build.environment]
  NODE_VERSION = "18"

# === Blog listing page (static) ===
[[redirects]]
  from   = "{{BLOG_PATH}}"
  to     = "/blog.html"
  status = 200
  force  = true

# === All blog post requests proxy to WordPress on Hostinger ===
[[redirects]]
  from   = "{{BLOG_PATH}}/*"
  to     = "https://{{CMS_DOMAIN}}{{BLOG_PATH}}/:splat"
  status = 200
  force  = true

# === WordPress assets ===
[[redirects]]
  from   = "/wp-content/*"
  to     = "https://{{CMS_DOMAIN}}/wp-content/:splat"
  status = 200
  force  = true

[[redirects]]
  from   = "/wp-includes/*"
  to     = "https://{{CMS_DOMAIN}}/wp-includes/:splat"
  status = 200
  force  = true

[[redirects]]
  from   = "/wp-json/*"
  to     = "https://{{CMS_DOMAIN}}/wp-json/:splat"
  status = 200
  force  = true

# === WP sitemap (for search engines) ===
[[redirects]]
  from   = "/wp-sitemap.xml"
  to     = "https://{{CMS_DOMAIN}}/wp-sitemap.xml"
  status = 200
  force  = true

[[redirects]]
  from   = "/wp-sitemap-*"
  to     = "https://{{CMS_DOMAIN}}/wp-sitemap-:splat"
  status = 200
  force  = true

# === Legacy .html → clean URL (301 permanent) ===
[[redirects]]
  from   = "/blog.html"
  to     = "{{BLOG_PATH}}"
  status = 301

# === SPA fallback ===
[[redirects]]
  from = "/*"
  to   = "/index.html"
  status = 200
