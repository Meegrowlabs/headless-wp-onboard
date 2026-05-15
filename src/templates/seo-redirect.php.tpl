<?php
/**
 * Plugin Name: {{BRAND}} SEO Redirect
 * Description: 301 redirects direct visitors from {{CMS_DOMAIN}} to {{DOMAIN}}, blocks crawlers on cms subdomain. Keeps wp-admin/wp-json/wp-content accessible for proxy.
 * Version: 1.0
 * Author: headless-wp-onboard
 */

if (!defined('ABSPATH')) exit;

add_action('init', function () {
    if (empty($_SERVER['HTTP_HOST'])) return;
    if ($_SERVER['HTTP_HOST'] !== '{{CMS_DOMAIN}}') return;

    $path = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';

    // Never redirect these paths (admin + asset paths Netlify proxies through)
    $protected = array('/wp-admin', '/wp-login', '/wp-json', '/wp-content', '/wp-includes',
                       '/xmlrpc.php', '/wp-sitemap', '/feed');
    foreach ($protected as $p) {
        if (strpos($path, $p) === 0) return;
    }

    // If request came via reverse proxy (Netlify, etc.), do not redirect
    if (!empty($_SERVER['HTTP_X_FORWARDED_HOST']) || !empty($_SERVER['HTTP_X_NF_REQUEST_ID'])) return;

    wp_redirect('https://{{DOMAIN}}' . $path, 301);
    exit;
}, 1);

// Disable WordPress core canonical redirect for sitemap/feed paths,
// so /wp-sitemap.xml served via reverse proxy doesn't bounce to the primary domain
// (which would cause an infinite proxy loop).
add_filter('redirect_canonical', function ($redirect_url, $requested_url) {
    $path = parse_url($requested_url, PHP_URL_PATH) ?: '';
    if (strpos($path, '/wp-sitemap') === 0 || strpos($path, '/feed') === 0) {
        return false;
    }
    return $redirect_url;
}, 10, 2);

// Block direct crawlers on cms subdomain with a strict robots.txt
add_filter('robots_txt', function ($output, $public) {
    if (!empty($_SERVER['HTTP_HOST']) && $_SERVER['HTTP_HOST'] === '{{CMS_DOMAIN}}'
        && empty($_SERVER['HTTP_X_FORWARDED_HOST'])
        && empty($_SERVER['HTTP_X_NF_REQUEST_ID'])) {
        return "User-agent: *\nDisallow: /\n";
    }
    return $output;
}, 10, 2);
