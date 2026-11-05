import crypto from 'node:crypto';

// Verifies Shopify App Proxy signature (HMAC-SHA256 hex over sorted key=value pairs, no separator).
export function verifyProxy(query, secret) {
  const { signature, ...rest } = query;
  if (!signature || !secret) return false;
  const msg = Object.keys(rest).sort()
    .map(k => `${k}=${Array.isArray(rest[k]) ? rest[k].join(',') : rest[k]}`)
    .join('');
  const digest = crypto.createHmac('sha256', secret).update(msg).digest('hex');
  const a = Buffer.from(digest), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
