// WordPress XML-RPC client — used because basic-auth and cookie-based auth often fail
// in cross-host setups, but XML-RPC accepts username+password directly.
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function structParam(obj) {
  const members = Object.entries(obj)
    .map(([k, v]) => `<member><name>${xmlEscape(k)}</name>${valueXml(v)}</member>`)
    .join('');
  return `<value><struct>${members}</struct></value>`;
}

function valueXml(v) {
  if (v === null || v === undefined) return '<value><string></string></value>';
  if (typeof v === 'number' && Number.isInteger(v)) return `<value><int>${v}</int></value>`;
  if (typeof v === 'boolean') return `<value><boolean>${v ? 1 : 0}</boolean></value>`;
  if (Array.isArray(v)) {
    return `<value><array><data>${v.map(valueXml).join('')}</data></array></value>`;
  }
  if (typeof v === 'object') {
    return structParam(v);
  }
  return `<value><string>${xmlEscape(String(v))}</string></value>`;
}

export async function xmlrpcCall(host, method, args) {
  const params = args.map((a) => `<param>${valueXml(a)}</param>`).join('');
  const body = `<?xml version="1.0"?><methodCall><methodName>${xmlEscape(method)}</methodName><params>${params}</params></methodCall>`;
  const url = new URL(`https://${host}/xmlrpc.php`);
  const lib = url.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'http:' ? 80 : 443),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'headless-wp-onboard/0.1',
        },
        timeout: 30000,
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          if (chunks.includes('<fault>')) {
            const msg = chunks.match(/<string>([^<]*)<\/string>/);
            reject(new Error(`XML-RPC fault: ${msg ? msg[1] : 'unknown'}`));
          } else {
            resolve(chunks);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('XML-RPC timeout')));
    req.write(body);
    req.end();
  });
}

// Verify credentials by calling wp.getUsersBlogs
export async function verifyCredentials(host, user, pass) {
  const res = await xmlrpcCall(host, 'wp.getUsersBlogs', [user, pass]);
  return res.includes('<array>');
}

// Update WordPress options (title, tagline, etc.)
export async function setOptions(host, user, pass, options) {
  return xmlrpcCall(host, 'wp.setOptions', [1, user, pass, options]);
}

// Create a single post
export async function newPost(host, user, pass, post) {
  const dateGmt = post.date
    ? new Date(post.date + 'T10:00:00Z').toISOString().replace(/[-:]/g, '').slice(0, 15)
    : null;
  const struct = {
    post_type: 'post',
    post_status: post.status || 'publish',
    post_title: post.title,
    post_content: post.content,
    post_excerpt: post.excerpt || '',
    post_name: post.slug,
  };
  if (dateGmt) struct.post_date_gmt = dateGmt;
  if (post.category) {
    struct.terms_names = { category: [post.category] };
  }
  const res = await xmlrpcCall(host, 'wp.newPost', [1, user, pass, struct]);
  const m = res.match(/<string>(\d+)<\/string>/);
  return m ? Number(m[1]) : null;
}

// Helper: post_name is the slug. WordPress will deduplicate by slug.
