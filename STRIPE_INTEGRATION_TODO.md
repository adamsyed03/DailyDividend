# Stripe Integration TODO

This is the single source of truth for the remaining Stripe setup.

## Values to Replace

The Checkout Session already uses real application values for `mode`, `success_url`, `cancel_url`, and `line_items`; there are no sample placeholders embedded in the call.

Runtime values still need to be added before Checkout can run:

**Files containing the environment-variable contract:**
- [.env.example](.env.example)
- [server.js](server.js)
- [scripts/setup-stripe.js](scripts/setup-stripe.js)

| Field | Current Value | What to Set |
|-------|---------------|-------------|
| `STRIPE_SECRET_KEY` | Unset in local `.env` | A Stripe test secret key first, then a live secret stored in the deployment's secret manager. |
| `STRIPE_WEBHOOK_SECRET` | Unset in local `.env` | The signing secret for the `/api/stripe/webhook` endpoint in the matching test or live mode. |
| `STRIPE_PRICE_ID` | Unset in local `.env` | The recurring ₹300/month Price ID for Daily Dividend. |
| `PUBLIC_APP_URL` | Unset in local `.env` | `http://localhost:3000` locally or `https://dailydividend.info` in production. |

Never commit secret or webhook keys. Test and live Stripe resources are separate, so keep each environment's keys, price, promotion code, and webhook secret together.

## Configured Parameters

These Checkout Studio parameters are set on the existing hosted Checkout Session.

**File containing these parameters:**
- [server.js](server.js)

| Parameter | Value |
|-----------|-------|
| `ui_mode` | `hosted_page` |
| `mode` | `subscription` |
| `billing_address_collection` | `auto` |
| `phone_number_collection.enabled` | `false` |
| `automatic_tax.enabled` | `false` |
| `allow_promotion_codes` | `true` |
| `payment_method_collection` | `always` |
| `submit_type` | `auto` |
| `consent_collection.terms_of_service` | `required` |
| `custom_text.terms_of_service_acceptance.message` | Daily Dividend renewal, cancellation, and financial-information disclaimer text |
| `integration_identifier` | `hosted_web_0001` |
| `origin_context` | `web` |
| `line_items[0].price` | `STRIPE_PRICE_ID` |
| `line_items[0].quantity` | `1` |
| `success_url` | `/subscribe?session_id={CHECKOUT_SESSION_ID}` on the current application base URL |
| `cancel_url` | `/subscribe?checkout=cancelled` on the current application base URL |

The project sends raw REST requests and does not install a Stripe SDK, so there is no SDK version to compare with 21.0.0. `hosted_page` is used as required by the Checkout Studio fallback rule; verify it against the Stripe API version selected for each environment before launch.

## Setup and Next Steps

1. Start with Stripe test mode. Add test values to the untracked `.env`, or configure the same variables in the deployment secret manager.
2. Use the existing [scripts/setup-stripe.js](scripts/setup-stripe.js) helper if the ₹300/month Price and the `barclays123` promotion code still need to be created in that Stripe mode. If they already exist, set `STRIPE_PRICE_ID` to the existing recurring Price ID instead.
3. Register `https://dailydividend.info/api/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Configure the Stripe Customer Portal for cancellation and payment-method management, then test the existing billing-portal flow.
5. Verify the Terms of Service and Privacy Policy URLs in Stripe's business/public details before accepting live payments.
6. In test mode, complete Checkout with Stripe's standard successful test card `4242 4242 4242 4242`, any future expiry, any CVC, and any postal code. Also test a declined card such as `4000 0000 0000 0002`.
7. Test `barclays123` end to end. Because `payment_method_collection` is configured as `always`, Checkout will still request a payment method even when the promotion makes the invoice free.
8. Confirm webhook fulfillment grants article access after Checkout and that cancellation keeps access only through the paid period.
9. Repeat the configuration with live-mode keys, the live recurring Price, live promotion code, and live webhook endpoint before launch.

## How the Flow Works

An authenticated user opens the subscription page and starts Checkout. The server creates a hosted Stripe Checkout Session for the recurring Price and returns its URL. Stripe sends the customer back to `/subscribe` after completion or cancellation. Signed webhook events update the user's subscription state, which controls access to individual Rabbit Hole articles. The existing billing endpoint creates a Customer Portal session for self-service management.

The Checkout Studio specification intentionally removes `customer`, `client_reference_id`, and custom metadata from the Session parameters. The current fulfillment code identifies a user from `client_reference_id` or Session metadata, so this identity handoff must be reconciled before live launch; otherwise a completed Checkout may not be attached to the correct Daily Dividend account.

## Project Structure

No new routes, dependencies, or application modules were added. The integration uses the existing Checkout route, webhook handler, subscription state, and setup helper. This TODO is the only new file.

## Resources

- [Stripe support](https://support.stripe.com)
- [Stripe MCP documentation](https://docs.stripe.com/mcp)
- [Stripe Checkout testing](https://docs.stripe.com/testing)
- [Stripe Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal)
