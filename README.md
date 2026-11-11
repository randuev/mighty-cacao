# Mighty Cacao — ordering website

Self-contained static site (no build step): `index.html` + `styles.css` + `app.js`.

## Preview
```sh
cd /root/nerve-workspace/mighty-cacao
python3 -m http.server 8090
# open http://localhost:8090
```
(Opening `index.html` directly also works — no server required.)

## What works
- 11 products across 4 categories, filterable shelf
- Cart persisted in `localStorage` (survives refresh)
- Free-delivery progress bar ($50 threshold), $6 flat metro fee
- Checkout: delivery date/window picker (same-day logic, 2pm Sydney cutoff),
  leave-at-door, notes, pay-online/pay-at-door, validation, confirmation screen
  with order number. Cart clears on success.

## Wiring a real backend
Orders are simulated in `app.js` until `WORKER_URL` is set (top of the file).
Stripe payments run through the Cloudflare Worker in `worker/mighty-cacao-checkout.js`:

### One-time setup
1. **Stripe (test mode first)** — [dashboard.stripe.com/test](https://dashboard.stripe.com/test)
   - Product catalog → create all 14 products with AUD prices (see `CATALOG` in the Worker file for the list)
   - Copy each `price_…` ID into `PRICE_IDS` in the Worker file
   - Settings → Shipping rates → create **Sydney metro $6** and **Free over $50 $0** → copy the two `ship_…` IDs into `SHIPPING`
   - Developers → API keys → copy the **test secret key** (`sk_test_…`)
2. **Cloudflare** — dashboard → Workers & Pages → Create Worker → paste the Worker file
   - Settings → Variables → add **secret** `STRIPE_SECRET` = your `sk_test_…` (paste it here, never in the repo)
   - Deploy → copy the Worker URL (`https://mighty-cacao-checkout.<subdomain>.workers.dev`)
3. **Site** — set `WORKER_URL` in `app.js` (and in `success.html`), commit, push.

### Test a payment
On the live site, checkout redirects to Stripe. Use test card `4242 4242 4242 4242`,
any future expiry, any CVC. Success → `success.html` (fetches totals from Stripe and
clears the cart); cancel keeps the cart untouched.

Prices are verified server-side by the Worker against its own `CATALOG` —
tampered client totals get rejected, the Worker creates the session, and Stripe
emails the receipt. Delivery details ride in session metadata (visible in Stripe Dashboard).

### Going live
- Stripe: exit test mode, recreate products/shipping rates in live mode, swap all IDs + live secret key, redeploy Worker, test with a real $1 order.

## Customizing
- Products/prices/emoji tiles: `PRODUCTS` array at top of `app.js`
- Fees, free-shipping threshold, same-day cutoff: constants below it
- Palette: CSS variables at the top of `styles.css`
- Contact details/footer: bottom of `index.html`
