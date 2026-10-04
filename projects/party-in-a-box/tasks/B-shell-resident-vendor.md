# Person B: app shell, Resident view, petition mock, Vendor view

**Read first:** [`00-shared-contracts.md`](00-shared-contracts.md) (architecture, routes, `Store`
and `Logic` APIs, data shapes) and `HANDOFF.md` §2, §3, §7, §9.

**You own:** `web/index.html`, `web/css/app.css`, `web/js/app.js`, `web/js/store.js`,
`web/js/resident.js`, `web/js/petition.js`, `web/js/vendor.js`. Don't edit anything else.

**Others wait on you for:** the scaffold (A and C need somewhere to plug in). Push it within
20 minutes, even if every view only says "coming soon".

## Step 1 (12:00–12:20): scaffold, push

- `web/index.html`: header with title and a role switcher (links to `#/resident`, `#/vendor`,
  `#/village`), a "Reset demo" button, `<main id="view">`, `<footer>`. Load Leaflet CSS + JS from
  cdnjs, `css/app.css`, `css/village.css`, then scripts in the order given in the contracts file.
- Create empty placeholders so nothing 404s: `web/css/village.css`, `web/js/village.js` (with a
  "coming soon" view). A will overwrite `village.js`; you never touch it after this.
- `web/js/store.js`: the `Store` API from the contracts file, localStorage key `bpib:v1`, every
  read/write in try/catch.
- `web/js/app.js`: `fetch` the three JSON files (if `sample.json` or `blocks.json` is missing
  yet, use an empty default and keep going), build `ctx`, route on `hashchange`, highlight the
  active role, render the footer text from the contracts file.

Test with `python3 -m http.server -d web 8000`. Push.

## Step 2 (12:20–1:00): Resident view, block packet (`resident.js`)

`window.Views.resident = function (el, ctx) { ... }`
1. Leaflet map centered on Oak Park (41.885, -87.785), zoom 14, OpenStreetMap tiles.
2. Address box → `Logic.findBlock(address, ctx.blocks)`. Highlight the block's `lines`
   (green if eligible, red if not) and zoom to it.
3. **Block packet** beside/below the map:
   - Eligible ✅ or Not eligible ❌ + `reason`. If not eligible: "Nearest eligible block:
     1100 S Cuyler Ave, 54 m away", clickable to look it up.
   - Shade: tree count and large trees.
   - Curb: `parking` strings and overnight ban.
   - Rules checklist from `ctx.rules.checklist`, and a link to `ctx.rules.official_form_url`.
   - "Rules shown are 2026; confirm 2027 with Public Works."
4. Until A's `blocks.json` lands, test with a one-block hand-written array.

## Step 3 (1:00–1:30): booking form (still `resident.js`)

Shown under the packet only for eligible blocks:
- Date range (start, end), kind (party / block sale), services checkboxes (barricades, Green
  Block Party kit, vendor wanted), expected guests.
- Live checks as dates change: "Petition due by <Logic.petitionDue>" (warn red if that's in the
  past), `Logic.seasonCheck` problems.
- Submit → `Store.add("requests", {..., status: "Submitted"})`, then show "Request saved in
  this browser (demo)" and a **"Copy petition link"** button that copies
  `location.origin + location.pathname + "#/petition/" + id`.
- Banner on the form: "Demo only — do not enter real personal information."

Push after this works.

## Step 4 (1:30–1:50): petition mock (`petition.js`)

`window.Views.petition = function (el, ctx, params) { ... }` for `#/petition/<id>`.
- Big banner: "Demo only — do not enter real personal information. Signatures stay in this browser."
- Show the request: block, date range, kind, organizer.
- Sign form: name, house number. Save with `Store.add("signatures", {request_id, ...})`.
- Count: "7 / 10 addresses signed" (count distinct `house_number`s).

## Step 5 (1:50–2:10): Vendor view (`vendor.js`)

`window.Views.vendor = function (el, ctx) { ... }`
- Pick a vendor from a dropdown of `Store.all("vendors")` (only `approved: true` ones can quote;
  others show "Awaiting Village approval").
- List parties where `Logic.vendorVisible(request, ctx)` is true and `services.vendor_wanted`:
  block, date range, guests, existing quotes.
- Quote form: price (USD), menu, max capacity served → `Store.add("bids", ...)`. Show a
  warning if `Logic.flagWords(menu)` hits ("No alcohol sales at block parties").
- On the resident side of the same card, a "Confirm this vendor" button sets the bid to
  `Confirmed` and the request's `confirmed_bid_id`.
- Banner: "Sample vendors are fictional. A quote is the vendor's price to the organizer for its
  own service."

## Stretch (only after 2:10, only if everything else works)

Draft PDFs with jsPDF (cdnjs) per `HANDOFF.md` §5 item 8, watermarked "Draft, not the official
Village form". Skip without regret.

## Done means

- [ ] Scaffold live on Pages; role switcher switches views; footer on every view.
- [ ] `1100 S Cuyler Ave` → eligible, 55 trees; `600 Superior St` → not eligible + nearest eligible block.
- [ ] Start date 2026-10-17 → "Petition due by 2026-10-03"; a date after Oct 31 → outside season.
- [ ] Booking saves a request; petition link opens the sign page; signatures update the count.
- [ ] Vendor view never shows ineligible, out-of-season or rejected parties; alcohol in a menu is flagged.
- [ ] "Reset demo" returns to sample data.
