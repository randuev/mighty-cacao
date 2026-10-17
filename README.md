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
Orders are simulated in `app.js` (`orderForm` submit handler, ~line 280).
Replace the `setTimeout` block with:
```js
await fetch('https://YOUR-ENDPOINT/api/orders', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify(payload),
});
```
The payload shape is in `collectPayload()` — items, customer, delivery, payment, totals.

## Customizing
- Products/prices/emoji tiles: `PRODUCTS` array at top of `app.js`
- Fees, free-shipping threshold, same-day cutoff: constants below it
- Palette: CSS variables at the top of `styles.css`
- Contact details/footer: bottom of `index.html`
