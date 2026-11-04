const fs = require('fs');
const path = require('path');

loadEnv();

const secretKey = process.env.STRIPE_SECRET_KEY || '';
const apiVersion = process.env.STRIPE_API_VERSION || '2026-10-28.endive';
const lookupKey = 'daily_dividend_monthly_inr';
const couponId = 'daily_dividend_free_forever';
const promotionCode = 'barclays123';

function loadEnv() {
  const envFile = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envFile)) return;
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index < 0) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

function form(params = {}) {
  const result = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') result.append(key, String(value));
  });
  return result;
}

async function stripe(endpoint, { method = 'GET', params = {}, allow404 = false } = {}) {
  const body = form(params);
  const url = new URL(`https://api.stripe.com${endpoint}`);
  const headers = { Authorization: `Bearer ${secretKey}`, 'Stripe-Version': apiVersion };
  const options = { method, headers };
  if (method === 'GET') body.forEach((value, key) => url.searchParams.append(key, value));
  else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.body = body;
  }
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (allow404 && response.status === 404) return null;
  if (!response.ok) throw new Error((data.error && data.error.message) || `Stripe returned ${response.status}.`);
  return data;
}

async function main() {
  if (!secretKey.startsWith('sk_')) throw new Error('Add STRIPE_SECRET_KEY to .env before running this setup.');

  let price;
  if (process.env.STRIPE_PRICE_ID) {
    price = await stripe(`/v1/prices/${encodeURIComponent(process.env.STRIPE_PRICE_ID)}`);
    const valid = price.active && price.currency === 'inr' && price.unit_amount === 30000 &&
      price.recurring && price.recurring.interval === 'month' && price.recurring.interval_count === 1;
    if (!valid) throw new Error('STRIPE_PRICE_ID must reference an active ₹300 INR monthly price.');
    console.log('Reusing the configured ₹300/month price.');
  } else {
    const existingPrices = await stripe('/v1/prices', {
      params: { 'lookup_keys[]': lookupKey, active: true, limit: 10 }
    });
    price = (existingPrices.data || []).find(item =>
      item.currency === 'inr' && item.unit_amount === 30000 && item.recurring && item.recurring.interval === 'month'
    );
    if (!price) {
      price = await stripe('/v1/prices', {
        method: 'POST',
        params: {
          currency: 'inr',
          unit_amount: 30000,
          'recurring[interval]': 'month',
          'recurring[interval_count]': 1,
          'product_data[name]': 'Daily Dividend Membership',
          'product_data[description]': 'Full access to Daily Dividend company stories and account features.',
          lookup_key: lookupKey,
          nickname: '₹300 monthly'
        }
      });
      console.log('Created the ₹300/month price.');
    } else {
      console.log('Reusing the existing ₹300/month price.');
    }
  }

  let coupon = await stripe(`/v1/coupons/${encodeURIComponent(couponId)}`, { allow404: true });
  if (!coupon) {
    coupon = await stripe('/v1/coupons', {
      method: 'POST',
      params: { id: couponId, name: 'Daily Dividend free access', percent_off: 100, duration: 'forever' }
    });
    console.log('Created the 100%-off forever coupon.');
  } else {
    console.log('Reusing the existing 100%-off forever coupon.');
  }

  const codes = await stripe('/v1/promotion_codes', {
    params: { code: promotionCode, active: true, limit: 10 }
  });
  let promo = (codes.data || []).find(item => String(item.code || '').toLowerCase() === promotionCode);
  if (!promo) {
    promo = await stripe('/v1/promotion_codes', {
      method: 'POST',
      params: {
        code: promotionCode,
        'promotion[type]': 'coupon',
        'promotion[coupon]': coupon.id,
        'metadata[purpose]': 'Daily Dividend free membership'
      }
    });
    console.log(`Created promotion code ${promotionCode}.`);
  } else {
    console.log(`Reusing promotion code ${promotionCode}.`);
  }

  console.log('\nAdd this value to local and production environment variables:');
  console.log(`STRIPE_PRICE_ID=${price.id}`);
  console.log('\nWebhook URL: https://dailydividend.info/api/stripe/webhook');
  console.log('Webhook events: checkout.session.completed, checkout.session.async_payment_succeeded, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted');
  console.log('Copy the webhook signing secret into STRIPE_WEBHOOK_SECRET.');
}

main().catch(error => {
  console.error(`Stripe setup failed: ${error.message}`);
  process.exitCode = 1;
});
