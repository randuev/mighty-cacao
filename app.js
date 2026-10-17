/* Mighty Cacao — storefront logic */
"use strict";

// ---------- data ----------
const PRODUCTS = [
  { id: "dc-classic", name: "Classic Drinking Chocolate", cat: "drinking", price: 14, size: "250g", emoji: "☕", bg: "#e8d3b2", tag: "Bestseller", desc: "Stone-ground 68% cacao with cane sugar. Melt into milk, oat or water." },
  { id: "dc-mocha", name: "Spiced Mocha Cacao", cat: "drinking", price: 15, size: "250g", emoji: "🌶️", bg: "#e3c6a8", tag: "New", desc: "Cacao, espresso, cinnamon and a whisper of chilli." },
  { id: "dc-white", name: "Golden Turmeric Cacao", cat: "drinking", price: 15, size: "250g", emoji: "✨", bg: "#f0e0bd", desc: "Cacao blended with turmeric, vanilla and coconut milk powder." },
  { id: "powder-raw", name: "Raw Cacao Powder", cat: "pantry", price: 18, size: "500g", emoji: "🥄", bg: "#d9c1a3", tag: "Pantry", desc: "Cold-pressed, unroasted. Baking, smoothies, the lot." },
  { id: "nibs", name: "Cacao Nibs", cat: "pantry", price: 16, size: "250g", emoji: "🌰", bg: "#cbb294", desc: "Cracked beans — crunchy, intense, dangerously snackable." },
  { id: "butter", name: "Cacao Butter Buttons", cat: "pantry", price: 12, size: "200g", emoji: "🧈", bg: "#efe0c4", desc: "Food-grade buttons for tempering, coating and skincare DIY." },
  { id: "bar-70", name: "70% Dark Bar", cat: "bars", price: 8, size: "100g", emoji: "🍫", bg: "#c9a483", tag: "Bestseller", desc: "Single-origin Sumaco valley. Snap, melt, repeat." },
  { id: "bar-sea", name: "Sea Salt Dark Bar", cat: "bars", price: 9, size: "100g", emoji: "🧂", bg: "#d5b294", desc: "70% dark finished with Murray river salt flakes." },
  { id: "bar-mint", name: "Mint Crisp Dark Bar", cat: "bars", price: 9, size: "100g", emoji: "🌿", bg: "#c8c1a0", desc: "Dark cacao, peppermint oil, crisp rice." },
  { id: "gift-box", name: "Mighty Gift Box", cat: "gifts", price: 45, size: "5 items", emoji: "🎁", bg: "#e2c49c", tag: "Gift", desc: "Bar selection + drinking chocolate + nibs in a keepsake box." },
  { id: "bundle", name: "Sunday Bundle", cat: "gifts", price: 38, size: "3 items", emoji: "🧺", bg: "#dcc9ab", desc: "Powder, nibs and a 70% bar — the everyday starter kit." },
];

const FREE_SHIP_THRESHOLD = 50;
const DELIVERY_FEE = 6;
const REGIONAL_FEE = 10;
const SAME_DAY_CUTOFF_HOUR = 14; // 2pm Sydney

const CATS = [
  { key: "all", label: "All" },
  { key: "drinking", label: "Drinking chocolate" },
  { key: "bars", label: "Bars" },
  { key: "pantry", label: "Pantry" },
  { key: "gifts", label: "Gifts" },
];

// ---------- state ----------
const LS_KEY = "mighty-cart-v1";
let cart = loadCart(); // { [productId]: qty }
let activeCat = "all";

function loadCart() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    // keep only valid products/quantities
    const clean = {};
    for (const [id, q] of Object.entries(obj)) {
      if (PRODUCTS.some(p => p.id === id) && Number.isInteger(q) && q > 0 && q <= 99) clean[id] = q;
    }
    return clean;
  } catch { return {}; }
}
function saveCart() { localStorage.setItem(LS_KEY, JSON.stringify(cart)); }

// ---------- helpers ----------
const $ = sel => document.querySelector(sel);
const money = n => `$${n.toFixed(2)}`;
const byId = id => PRODUCTS.find(p => p.id === id);

function cartCount() { return Object.values(cart).reduce((a, b) => a + b, 0); }
function subtotal() { return Object.entries(cart).reduce((s, [id, q]) => s + byId(id).price * q, 0); }
function deliveryFee() {
  const sub = subtotal();
  if (sub === 0) return 0;
  return sub >= FREE_SHIP_THRESHOLD ? 0 : DELIVERY_FEE;
}

let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- render: filters + grid ----------
function renderFilters() {
  const bar = $("#filterBar");
  bar.innerHTML = "";
  CATS.forEach(c => {
    const b = document.createElement("button");
    b.className = "chip" + (c.key === activeCat ? " active" : "");
    b.textContent = c.label;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(c.key === activeCat));
    b.addEventListener("click", () => { activeCat = c.key; renderFilters(); renderGrid(); });
    bar.appendChild(b);
  });
}

function renderGrid() {
  const grid = $("#productGrid");
  grid.innerHTML = "";
  PRODUCTS.filter(p => activeCat === "all" || p.cat === activeCat).forEach(p => {
    const card = document.createElement("article");
    card.className = "card";
    const qty = cart[p.id] || 0;
    card.innerHTML = `
      <div class="card-img" style="background:${p.bg}">
        ${p.tag ? `<span class="tag">${p.tag}</span>` : ""}
        <span>${p.emoji}</span>
      </div>
      <div class="card-body">
        <h3>${p.name}</h3>
        <p class="desc">${p.desc}</p>
        <div class="card-foot">
          <span class="price">${money(p.price)} <small style="color:var(--cocoa-500);font-weight:400">/ ${p.size}</small></span>
          <span data-slot></span>
        </div>
      </div>`;
    const slot = card.querySelector("[data-slot]");
    if (qty > 0) {
      slot.innerHTML = `
        <span class="qty-ctrl">
          <button aria-label="Remove one ${p.name}" data-dec>−</button>
          <span class="q">${qty}</span>
          <button aria-label="Add one ${p.name}" data-inc>+</button>
        </span>`;
      slot.querySelector("[data-inc]").addEventListener("click", () => add(p.id));
      slot.querySelector("[data-dec]").addEventListener("click", () => setQty(p.id, qty - 1));
    } else {
      const b = document.createElement("button");
      b.className = "add-btn";
      b.textContent = "Add";
      b.addEventListener("click", () => add(p.id));
      slot.appendChild(b);
    }
    grid.appendChild(card);
  });
}

// ---------- cart ops ----------
function add(id) {
  cart[id] = Math.min((cart[id] || 0) + 1, 99);
  afterCartChange();
  toast(`${byId(id).emoji} ${byId(id).name} added`);
}
function setQty(id, q) {
  if (q <= 0) delete cart[id];
  else cart[id] = Math.min(q, 99);
  afterCartChange();
}
function removeItem(id) { delete cart[id]; afterCartChange(); }

function afterCartChange() {
  saveCart();
  renderGrid();
  renderCart();
}

// ---------- render: cart drawer ----------
function renderCart() {
  const n = cartCount(), sub = subtotal(), fee = deliveryFee();
  $("#cartCount").textContent = n;
  $("#cartBtnTotal").textContent = money(sub);

  const items = $("#cartItems");
  items.innerHTML = "";
  const ids = Object.keys(cart);
  if (!ids.length) {
    items.innerHTML = `<div class="cart-empty"><div class="big">🍫</div><p>Your cart is empty.<br>The shelf awaits.</p></div>`;
  } else {
    ids.forEach(id => {
      const p = byId(id), q = cart[id];
      const row = document.createElement("div");
      row.className = "ci";
      row.innerHTML = `
        <div class="ci-emoji" style="background:${p.bg}">${p.emoji}</div>
        <div class="ci-info">
          <h4>${p.name}</h4>
          <div class="ci-price">${money(p.price)} · ${p.size}</div>
        </div>
        <span class="qty-ctrl">
          <button aria-label="Decrease ${p.name}" data-dec>−</button>
          <span class="q">${q}</span>
          <button aria-label="Increase ${p.name}" data-inc>+</button>
        </span>
        <span class="ci-line">${money(p.price * q)}</span>
        <button class="ci-remove" aria-label="Remove ${p.name}">🗑</button>`;
      row.querySelector("[data-inc]").addEventListener("click", () => setQty(id, q + 1));
      row.querySelector("[data-dec]").addEventListener("click", () => setQty(id, q - 1));
      row.querySelector(".ci-remove").addEventListener("click", () => removeItem(id));
      items.appendChild(row);
    });
  }

  // free shipping bar
  const remaining = Math.max(0, FREE_SHIP_THRESHOLD - sub);
  $("#shipMsg").innerHTML = remaining > 0
    ? `Add <strong>${money(remaining)}</strong> more for free delivery 🚚`
    : `Free delivery unlocked! 🎉`;
  $("#shipFill").style.width = Math.min(100, (sub / FREE_SHIP_THRESHOLD) * 100) + "%";

  $("#cartSubtotal").textContent = money(sub);
  $("#cartDelivery").textContent = ids.length ? (fee === 0 ? "FREE" : money(fee)) : "—";
  $("#cartGrand").textContent = money(sub + fee);
  $("#checkoutBtn").disabled = ids.length === 0;
}

// ---------- drawer + modal plumbing ----------
const overlay = $("#overlay");
const drawer = $("#cartDrawer");
const modal = $("#checkoutModal");

function openCart() {
  renderCart();
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("show"));
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}
function closeCart() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  overlay.classList.remove("show");
  setTimeout(() => { if (!modal.classList.contains("open")) overlay.hidden = true; }, 250);
}

function openCheckout() {
  if (!cartCount()) return;
  closeCart();
  buildCheckoutSummary();
  buildDateOptions();
  $("#coView").hidden = false;
  $("#coDone").hidden = true;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  $("#orderForm").elements["name"].focus();
}
function closeCheckout() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  overlay.classList.remove("show");
}

function buildCheckoutSummary() {
  const sub = subtotal(), fee = deliveryFee();
  const rows = Object.entries(cart).map(([id, q]) => {
    const p = byId(id);
    return `<div class="row"><span>${q}× ${p.name}</span><span>${money(p.price * q)}</span></div>`;
  }).join("");
  $("#coSummary").innerHTML = `
    ${rows}
    <div class="row"><span>Delivery</span><span>${fee === 0 ? "FREE" : money(fee)}</span></div>
    <div class="row grand"><span>Total</span><span>${money(sub + fee)}</span></div>`;
}

function buildDateOptions() {
  const sel = $("#dateSelect");
  sel.innerHTML = "";
  const now = new Date();
  const sameDayOk = now.getHours() < SAME_DAY_CUTOFF_HOUR;
  const fmt = d => d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  if (sameDayOk) {
    const o = document.createElement("option");
    o.textContent = `Today, ${fmt(now)} (same-day)`;
    sel.appendChild(o);
  }
  for (let i = sameDayOk ? 1 : 1; i <= 5; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const o = document.createElement("option");
    o.textContent = fmt(d);
    sel.appendChild(o);
  }
}

// ---------- order submit ----------
$("#orderForm").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target;
  let ok = true;
  ["name", "phone", "email", "address"].forEach(k => {
    const el = f.elements[k];
    const valid = el.value.trim() !== "" &&
      (k !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim())) &&
      (k !== "phone" || el.value.replace(/\D/g, "").length >= 8);
    el.classList.toggle("invalid", !valid);
    if (!valid) ok = false;
  });
  if (!ok) { toast("Please check the highlighted fields"); return; }

  const btn = $("#placeOrder");
  btn.disabled = true;
  btn.textContent = "Placing order…";

  // Simulated order placement — swap for a real endpoint when you have one,
  // e.g. fetch('/api/orders', {method:'POST', body: JSON.stringify(payload)})
  const payload = collectPayload();
  setTimeout(() => {
    const orderNo = "MC-" + Date.now().toString(36).toUpperCase().slice(-6);
    showConfirmation(orderNo, payload);
    cart = {};
    saveCart();
    renderGrid();
    renderCart();
    btn.disabled = false;
    btn.textContent = "Place order";
  }, 900);
});

function collectPayload() {
  const f = $("#orderForm");
  const fd = new FormData(f);
  return {
    items: Object.entries(cart).map(([id, q]) => ({ id, qty: q, price: byId(id).price })),
    customer: {
      name: fd.get("name"), phone: fd.get("phone"), email: fd.get("email"), address: fd.get("address"),
    },
    delivery: {
      date: $("#dateSelect").value,
      window: fd.get("slot"),
      leaveAtDoor: fd.get("leave") === "on",
      notes: $("#notesToggle").checked ? (f.elements["notes"].value || "") : "",
    },
    payment: fd.get("pay"),
    subtotal: subtotal(),
    fee: deliveryFee(),
  };
}

function showConfirmation(orderNo, o) {
  $("#coView").hidden = true;
  $("#coDone").hidden = false;
  $("#orderNo").textContent = orderNo;
  $("#doneMsg").textContent =
    `Thanks ${o.customer.name.split(" ")[0]}! We'll text ${o.customer.phone} when your driver is on the way. ` +
    `Delivery: ${o.delivery.date}, ${o.delivery.window}${o.delivery.leaveAtDoor ? " · leave at door" : ""}.`;
  $("#doneSummary").innerHTML = `
    ${o.items.map(i => `<div class="row"><span>${i.qty}× ${byId(i.id).name}</span><span>${money(i.price * i.qty)}</span></div>`).join("")}
    <div class="row"><span>Delivery</span><span>${o.fee === 0 ? "FREE" : money(o.fee)}</span></div>
    <div class="row grand"><span>Total</span><span>${money(o.subtotal + o.fee)}</span></div>
    <div class="meta">Payment: ${o.payment === "pay-on-delivery" ? "at the door" : "online (card)"}${o.delivery.notes ? ` · Note: "${o.delivery.notes}"` : ""}</div>`;
  f_reset();
}
function f_reset() { $("#orderForm").reset(); $("#notesWrap").hidden = true; }

// ---------- wiring ----------
$("#cartBtn").addEventListener("click", openCart);
$("#cartClose").addEventListener("click", closeCart);
$("#overlay").addEventListener("click", () => { if (!modal.classList.contains("open")) closeCart(); });
$("#checkoutBtn").addEventListener("click", openCheckout);
$("#coClose").addEventListener("click", closeCheckout);
$("#doneClose").addEventListener("click", closeCheckout);
$("#notesToggle").addEventListener("change", e => { $("#notesWrap").hidden = !e.target.checked; });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (modal.classList.contains("open")) closeCheckout();
    else if (drawer.classList.contains("open")) closeCart();
  }
});

// ---------- init ----------
renderFilters();
renderGrid();
renderCart();
