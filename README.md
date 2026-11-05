# DHL Landed Cost Estimator for Shopify

Product-page block where shoppers pick a destination country, city and postcode and see estimated import
duties and taxes from the DHL Express MyDHL API `landed-cost` endpoint.

Storefront block -> Shopify App Proxy (`/apps/landed-cost/estimate`) -> your server (verifies Shopify signature)
-> DHL MyDHL API. DHL credentials live only in server environment variables.

## 1. Deploy the server (free)
1. Push this folder to a GitHub repo.
2. On Render.com: New > Blueprint > select the repo (uses `render.yaml`). Free tier sleeps after idle,
   so the first estimate after a pause can take ~30s; use Fly.io/Railway or a paid tier for production.
3. Set env vars (see `server/.env.example`): `SHOPIFY_API_SECRET`, `DHL_SITE_ID`, `DHL_PASSWORD`,
   `DHL_ACCOUNT_NUMBER`, origin address, `DEFAULT_HS_CODE`. Start with `DHL_ENV=test`, then switch to `prod`.

## 2. Create and deploy the Shopify app
1. Create an app in the Shopify Dev Dashboard; copy the Client ID and Client secret (secret -> `SHOPIFY_API_SECRET`).
2. Edit `shopify.app.toml`: set `client_id` and replace `YOUR-SERVER.onrender.com` with your server URL.
3. Install the Shopify CLI, then from this folder: `shopify app deploy`.
4. Install the app on your store (Dev Dashboard > Distribution > custom distribution for your store's URL).

## 3. Add it to the theme
Online Store > Themes > Customize > Product page > Add section > Apps > "Duties & taxes estimator".

## 4. Product data
Create product metafields (Settings > Custom data > Products):
- `custom.hs_code` (single line text): 6+ digit HS code
- `custom.country_of_origin` (single line text): ISO code, e.g. `IN`
Products without them fall back to `DEFAULT_HS_CODE` / `DEFAULT_ORIGIN_COUNTRY`.
Set variant weights in Shopify; the minimum billed weight is `MIN_WEIGHT_KG`.

## Notes
- Response parsing (`server/dhl.js > parseResponse`) is defensive; check it against a real response from your account.
- `customsValue` is sent as unit price x quantity. Confirm this matches your DHL response.
- Estimates only; Shopify Markets / checkout duties are separate.
- Rotate any credentials that were pasted into chat or committed anywhere.
