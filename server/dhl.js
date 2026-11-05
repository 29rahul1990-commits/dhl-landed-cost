const env = process.env;

const BASE = 'https://express.api.dhl.com/mydhlapi';
export const endpoint = () => `${BASE}${env.DHL_ENV === 'prod' ? '' : '/test'}/landed-cost`;

export function buildPayload({ country, city, postcode, price, qty, grams, currency, hs, origin, name }) {
  const unitWeight = Math.max(Number(env.MIN_WEIGHT_KG || 0.5), (grams / 1000));
  const totalWeight = +(unitWeight * qty).toFixed(3);
  const value = +(price * qty).toFixed(2);
  return {
    customerDetails: {
      shipperDetails: { postalCode: env.ORIGIN_POSTCODE, cityName: env.ORIGIN_CITY, countryCode: env.ORIGIN_COUNTRY },
      receiverDetails: { postalCode: postcode, cityName: city, countryCode: country }
    },
    accounts: [{ typeCode: 'shipper', number: env.DHL_ACCOUNT_NUMBER }],
    productCode: 'P',
    localProductCode: 'P',
    unitOfMeasurement: 'metric',
    currencyCode: currency,
    isCustomsDeclarable: true,
    isDTPRequested: true,
    isInsuranceRequested: false,
    getCostBreakdown: true,
    shipmentPurpose: 'commercial',
    transportationMode: 'air',
    merchantSelectedCarrierName: 'DHL',
    packages: [{
      typeCode: '3BX',
      weight: totalWeight,
      dimensions: {
        length: Number(env.DEFAULT_PKG_L || 25),
        width: Number(env.DEFAULT_PKG_W || 20),
        height: Number(env.DEFAULT_PKG_H || 10)
      }
    }],
    items: [{
      number: 1,
      name: String(name).slice(0, 70),
      description: String(name).slice(0, 255),
      manufacturerCountry: origin,
      quantity: qty,
      quantityType: 'prt',
      unitPrice: price,
      unitPriceCurrencyCode: currency,
      customsValue: value,
      customsValueCurrencyCode: currency,
      commodityCode: hs,
      weight: totalWeight,
      weightUnitOfMeasurement: 'metric',
      estimatedTariffRateType: 'highest_rate'
    }],
    getTariffFormula: false,
    getQuotationID: false
  };
}

const classify = s =>
  /duty|tariff/i.test(s) ? 'Import duty' :
  /tax|vat|gst/i.test(s) ? 'Import tax (VAT/GST)' : 'Fees';

// Defensive parse: sums item-level breakdown entries by type. Verify against a real response.
export function parseResponse(data) {
  const product = (data.products || [])[0];
  const buckets = {};
  for (const item of product?.items || []) {
    for (const b of item.breakdown || []) {
      const amount = Number(b.price);
      if (!Number.isFinite(amount) || amount === 0) continue;
      const label = classify(`${b.typeCode || ''} ${b.name || ''}`);
      buckets[label] = (buckets[label] || 0) + amount;
    }
  }
  const lines = Object.entries(buckets).map(([label, amount]) => ({ label, amount: +amount.toFixed(2) }));
  const total = +lines.reduce((s, l) => s + l.amount, 0).toFixed(2);
  return { lines, total };
}

export async function fetchLandedCost(input) {
  const auth = Buffer.from(`${env.DHL_SITE_ID}:${env.DHL_PASSWORD}`).toString('base64');
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(buildPayload(input)),
    signal: AbortSignal.timeout(15000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('DHL error', res.status, JSON.stringify(data).slice(0, 500));
    const err = new Error(data.detail || data.title || `DHL API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return parseResponse(data);
}
