/**
 * Mighty Cacao — Stripe Checkout Worker
 * Cloudflare Worker (free tier). Runs server-side, holds the Stripe secret
 * as an encrypted env var. Verifies every price server-side — never trusts
 * amounts coming from the browser.
 *
 * Deploy:
 *   1. Cloudflare dashboard → Workers & Pages → Create Worker → paste this file
 *   2. Settings → Variables → add secret STRIPE_SECRET = sk_test_... (test mode)
 *   3. Deploy, then fill the CONFIG block below + WORKER_URL in site app.js
 */

// ---------- CONFIG: fill after creating in Stripe Dashboard (test mode) ----------
const PRICE_IDS = {
  // catalog id -> Stripe price id (must match the cent amounts below)
  "dc-classic":  "price_REPLACE_ME", // $14.00
  "dc-mocha":    "price_REPLACE_ME", // $15.00
  "dc-white":    "price_REPLACE_ME", // $15.00
  "powder-raw":  "price_REPLACE_ME", // $18.00
  "nibs":        "price_REPLACE_ME", // $16.00
  "butter":      "price_REPLACE_ME", // $12.00
  "bar-70":      "price_REPLACE_ME", // $8.00
  "bar-sea":     "price_REPLACE_ME", // $9.00
  "bar-mint":    "price_REPLACE_ME", // $9.00
  "gift-box":    "price_REPLACE_ME", // $45.00
  "bundle":      "price_REPLACE_ME", // $38.00
  "bl-lotus":    "price_REPLACE_ME", // $12.00
  "bl-night":    "price_REPLACE_ME", // $16.00
  "bl-ritual":   "price_REPLACE_ME", // $28.00
};

// Catalog as the source of truth (cents). Server recomputes totals from this.
const CATALOG = {
  "dc-classic": { cents: 1400, name: "Classic Drinking Chocolate 250g" },
  "dc-mocha":   { cents: 1500, name: "Spiced Mocha Cacao 250g" },
  "dc-white":   { cents: 1500, name: "Golden Turmeric Cacao 250g" },
  "powder-raw": { cents: 1800, name: "Raw Cacao Powder 500g" },
  "nibs":       { cents: 1600, name: "Cacao Nibs 250g" },
  "butter":     { cents: 1200, name: "Cacao Butter Buttons 200g" },
  "bar-70":     { cents: 800,  name: "70% Dark Bar 100g" },
  "bar-sea":    { cents: 900,  name: "Sea Salt Dark Bar 100g" },
  "bar-mint":   { cents: 900,  name: "Mint Crisp Dark Bar 100g" },
  "gift-box":   { cents: 4500, name: "Mighty Gift Box" },
  "bundle":     { cents: 3800, name: "Sunday Bundle" },
  "bl-lotus":   { cents: 1200, name: "Blue Lotus Loose Leaf 50g" },
  "bl-night":   { cents: 1600, name: "Blue Lotus Night Cacao 250g" },
  "bl-ritual":  { cents: 2800, name: "Night Ritual Box" },
};

// Shipping rates — create BOTH in Stripe Dashboard → Settings → Shipping rates (AUD)
const SHIPPING = {
  std:  { rate_id: "ship_REPLACE_ME", cents: 600 },  // metro flat $6
  free: { rate_id: "ship_REPLACE_ME", cents: 0 },     // free over threshold
};
const FREE_THRESHOLD_CENTS = 5000;

// CORS: only the site (and local dev) may call this Worker
const ALLOWED_ORIGINS = [
  "https://randuev.github.io",
  "http://localhost:8090",
  "http://localhost:8091",
];

// Where success/cancel pages live, per allowed origin
const SITE_BASE = {
  "https://randuev.github.io": "/mighty-cacao",
  "http://localhost:8090": "",
  "http://localhost:8091": "",
};

// ---------- plumbing ----------
const STRIPE_API = "https://api.stripe.com/v1";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : "",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function stripeFetch(path, body, secret) {
  return fetch(`${STRIPE_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? body.toString() : undefined,
  });
}

const clampStr = (s, n) => String(s || "").slice(0, n);

async function createCheckout(request, env, origin) {
  if (!env.STRIPE_SECRET) return json({ error: "Stripe secret not configured" }, 500, origin);

  let payload;
  try { payload = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400, origin); }

  const { items, customer = {}, delivery = {} } = payload || {};
  if (!Array.isArray(items) || items.length === 0 || items.length > 20)
    return json({ error: "Cart must contain 1–20 items" }, 400, origin);

  // Verify every line against the server-side catalog
  const form = new URLSearchParams();
  let subtotal = 0;
  items.forEach((it, i) => {
    const prod = CATALOG[it.id];
    if (!prod) throw new Error(`Unknown product: ${it.id}`);
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new Error(`Bad quantity for ${it.id}`);
    form.set(`line_items[${i}][price]`, PRICE_IDS[it.id]);
    form.set(`line_items[${i}][quantity]`, String(qty));
    subtotal += prod.cents * qty;
  });

  // Choose shipping rate server-side by subtotal
  const ship = subtotal >= FREE_THRESHOLD_CENTS ? SHIPPING.free : SHIPPING.std;
  if (!ship.rate_id.startsWith("ship_") || ship.rate_id === "ship_REPLACE_ME")
    return json({ error: "Shipping rate not configured" }, 500, origin);
  form.set("shipping_rates[0]", ship.rate_id);

  form.set("mode", "payment");
  const base = SITE_BASE[origin] !== undefined ? SITE_BASE[origin] : "/mighty-cacao";
  form.set("success_url", `${origin}${base}/success.html?session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${origin}${base}/cancel.html`);
  if (customer.email) form.set("customer_email", clampStr(customer.email, 200));
  form.set("billing_address_collection", "auto");

  // Order context travels in metadata (visible in Dashboard + our success page)
  form.set("metadata[site]", "mighty-cacao");
  form.set("metadata[customer_name]", clampStr(customer.name, 120));
  form.set("metadata[customer_phone]", clampStr(customer.phone, 40));
  form.set("metadata[address]", clampStr(customer.address, 400));
  form.set("metadata[delivery_date]", clampStr(delivery.date, 120));
  form.set("metadata[delivery_window]", clampStr(delivery.window, 60));
  form.set("metadata[leave_at_door]", delivery.leaveAtDoor ? "yes" : "no");
  form.set("metadata[notes]", clampStr(delivery.notes, 400));

  try {
    const res = await stripeFetch("/checkout/sessions", form, env.STRIPE_SECRET);
    const data = await res.json();
    if (!res.ok) return json({ error: data.error?.message || "Stripe error" }, 502, origin);
    return json({ url: data.url }, 200, origin);
  } catch (e) {
    return json({ error: "Could not reach Stripe" }, 502, origin);
  }
}

async function checkoutStatus(request, env, origin) {
  if (!env.STRIPE_SECRET) return json({ error: "Stripe secret not configured" }, 500, origin);
  const id = new URL(request.url).searchParams.get("session_id") || "";
  if (!id.startsWith("cs_")) return json({ error: "Bad session id" }, 400, origin);
  try {
    const res = await stripeFetch(`/checkout/sessions/${id}`, null, env.STRIPE_SECRET);
    const data = await res.json();
    if (!res.ok) return json({ error: data.error?.message || "Stripe error" }, 502, origin);
    return json({
      id: data.id,
      status: data.status, // open | complete | expired
      amount_total: data.amount_total / 100,
      email: data.customer_details?.email || "",
      shipping: data.shipping_details?.address || null,
      metadata: data.metadata || {},
    }, 200, origin);
  } catch {
    return json({ error: "Could not reach Stripe" }, 502, origin);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.includes(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (ALLOWED_ORIGINS.length && origin && !ALLOWED_ORIGINS.includes(origin))
      return json({ error: "Origin not allowed" }, 403, origin);

    if (request.method === "POST" && url.pathname === "/create-checkout")
      return createCheckout(request, env, origin);

    if (request.method === "GET" && url.pathname === "/checkout-status")
      return checkoutStatus(request, env, origin);

    if (request.method === "GET" && url.pathname === "/")
      return json({ ok: true, service: "mighty-cacao-checkout" }, 200, origin);

    return json({ error: "Not found" }, 404, origin);
  },
};
