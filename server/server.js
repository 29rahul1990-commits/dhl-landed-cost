import express from 'express';
import rateLimit from 'express-rate-limit';
import { verifyProxy } from './verify.js';
import { fetchLandedCost } from './dhl.js';

const app = express();
app.set('trust proxy', 1);

const cache = new Map(); // key -> { exp, value }
const TTL = 10 * 60 * 1000;

app.get('/', (_req, res) => res.send('DHL landed cost proxy running'));
app.get('/healthz', (_req, res) => res.send('ok'));

app.get('/estimate',
  rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }),
  async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!verifyProxy(req.query, process.env.SHOPIFY_API_SECRET)) {
      return res.status(401).json({ ok: false, error: 'Invalid request signature.' });
    }
    const q = req.query;
    const country = String(q.country || '').toUpperCase();
    const origin = String(q.origin || process.env.DEFAULT_ORIGIN_COUNTRY || '').toUpperCase();
    const hs = String(q.hs || process.env.DEFAULT_HS_CODE || '').replace(/\D/g, '');
    const input = {
      country,
      city: String(q.city || '').trim().slice(0, 45).toUpperCase(),
      postcode: String(q.postcode || '').trim().slice(0, 12),
      price: Number(q.price),
      qty: Math.min(999, Math.max(1, parseInt(q.qty, 10) || 1)),
      grams: Math.max(0, Number(q.grams) || 0),
      currency: String(q.currency || '').toUpperCase(),
      hs, origin,
      name: String(q.name || 'Merchandise')
    };
    if (!/^[A-Z]{2}$/.test(country) || !input.city) return res.status(400).json({ ok: false, error: 'Country and city are required.' });
    if (!/^[A-Z]{3}$/.test(input.currency) || !(input.price > 0)) return res.status(400).json({ ok: false, error: 'Invalid price or currency.' });
    if (hs.length < 6) return res.status(422).json({ ok: false, error: 'Estimate unavailable for this product (missing HS code).' });
    if (!/^[A-Z]{2}$/.test(origin)) return res.status(422).json({ ok: false, error: 'Estimate unavailable for this product (missing country of origin).' });

    const key = JSON.stringify(input);
    const hit = cache.get(key);
    if (hit && hit.exp > Date.now()) return res.json(hit.value);

    try {
      const { lines, total } = await fetchLandedCost(input);
      if (!lines.length) return res.json({ ok: false, error: 'No duties or taxes could be calculated for this destination.' });
      const value = {
        ok: true, currency: input.currency, lines, total,
        disclaimer: 'Estimate only. Final duties and taxes are determined by customs at import.'
      };
      cache.set(key, { exp: Date.now() + TTL, value });
      if (cache.size > 2000) cache.delete(cache.keys().next().value);
      res.json(value);
    } catch (e) {
      res.status(502).json({ ok: false, error: 'Estimate temporarily unavailable.' });
    }
  });

app.listen(process.env.PORT || 3000, () => console.log('listening'));
