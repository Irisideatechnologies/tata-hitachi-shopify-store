# THEME_CHANGES

Running log of changes to the THCM Merchandise Store theme (Shopify Horizon). Newest entries are appended at the bottom.
Format for every future change: `## YYYY-MM-DD - title`, then what, files, endpoints, Shopify admin steps, editor settings, test result.

## Known risks

- **MAP_API_KEY is exposed in the storefront** (`snippets/map-auth-head.liquid`, shipped to every browser). It is there for testing only. Before go-live: move My Orders to `/api/me/orders` (JWT) and rotate the key.
- `/api/dashboard/orders?email=` trusts the `email` query parameter, so with the exposed key anyone can read another employee's orders. Same fix as above (JWT-scoped endpoint).
- The `/api/sap/daily-exports` response shape is unconfirmed. The Daily Orders parser is defensive, but column mapping and the download URL (it may need the JWT) must be re-checked against a real response (look for the `THCM daily exports: raw response` line in the browser console).
- Admin-only links are hidden client-side only. The admin pages themselves are protected by the API (JWT + 404 for non-admins), not by the hiding.

---

## 2026-10-08 - Employee portal: My Orders, Daily Orders, admin-only links, FAQ design

### 0. Shared API layer

- **What:** every storefront -> backend call now goes through one helper, `window.THCM_API`.
  - `keyRequest(method, path, body)`: `x-api-key`, `ngrok-skip-browser-warning`, `Content-Type` (only with a body).
  - `jwtRequest(method, path, body)`: `Authorization: Bearer <MAP_AUTH.getToken()>`, `ngrok-skip-browser-warning`.
  - Both: safe JSON parse, 401 -> `MAP_AUTH.logout()`, 404 -> `{ denied: true }`, network/CORS failure -> clear message + `console.error`.
- **Files**
  - `snippets/thcm-api.liquid` (new): the helper.
  - `snippets/map-auth-head.liquid` (edited): added `window.MAP_API_KEY` under `MAP_API_BASE`. Login logic untouched.
  - `layout/theme.liquid` (edited): renders `thcm-api` and `thcm-admin-links` right after `map-auth-head`.
- Existing map-* files (login, employee menu, employee admin) still use their own fetch calls; they were not changed.

### 1. My Orders

- **What:** logged-in employee's own orders: summary chips (Total / Awaiting approval / Approved / Delivered / Cancelled), filter tabs (All / Awaiting approval / Approved / Shipped / Delivered / Cancelled), order cards (items, 3 badges, Placed -> Approved -> Shipped -> Delivered stepper, red Cancelled state, Track shipment, Cancel order with confirm dialog), skeleton / empty / error+Retry states, cursor pagination.
- **Decision:** built a new section `sections/thcm-my-orders.liquid` (lower-case, hyphenated name) instead of filling `sections/Orders.liquid`. The empty `sections/Orders.liquid` is still in the repo and should be deleted by hand (it has no schema; I was not able to remove it).
- **Behaviour notes**
  - Stage used for tabs/chips (exclusive): cancelled > delivered > shipped (fulfilled) > approved (paid / partially paid) > awaiting approval.
  - Tabs filter the **current page** of results; chip counts come from walking all pages (limit 50, max 6 pages) so they cover all orders.
  - Cancel button only when `canCancel === true` and not `locked`.
  - All API data is written with `textContent`; tracking URLs must be http(s).
- **Files**
  - `sections/thcm-my-orders.liquid` (new): markup, schema, presets, static sample cards for the theme editor.
  - `snippets/thcm-orders-js.liquid` (new): all client logic.
  - `templates/page.orders.json` (new): page template.
  - `assets/tata.css` (edited): blocks `THCM Portal (shared)` and `My Orders`.
- **API endpoints**
  - `GET /api/dashboard/orders?email=<employee email>&limit=<n>&after=<cursor>|before=<cursor>` (x-api-key). `after` and `before` are never sent together.
  - `POST /api/map/orders/<shopifyOrderId>/cancel` (x-api-key).
- **Shopify admin**
  1. Online Store > Pages > Add page: title "My Orders", handle `orders`, Theme template `page.orders`.
  2. Add a link to `/pages/orders` in the header/footer menu (Navigation).
- **Theme editor settings (section "THCM My Orders"):** heading, subheading, orders per page (10-50), show summary chips, show filter tabs, empty state text, shop button label, shop button link.

### 2. Daily Orders Export (admin only)

- **What:** table of the nightly (12:00 AM) exports: Date, Orders, Total amount, Status, Download; date range filter (client side), row expand for the day's orders, pagination, "Access denied" on 404. Non-admins (or logged-out) only see "This page is only for administrators." + Home link and **no API call is made**.
- **Behaviour notes:** the first API response is logged with `console.debug`. Parsing tries `data`, `data.items`, `data.exports`, `data.rows` (and the same keys at top level). Columns only appear when the data has the field; if none of the known fields exist, the first scalar fields of the first row are shown. Pagination is server-side (`after` / `before`) when the response has `pageInfo` cursors, otherwise client-side.
- **Files**
  - `sections/dailyorderssheet.liquid` (was empty, now complete): markup, schema, presets, static sample table for the editor.
  - `snippets/thcm-daily-orders-js.liquid` (new): all client logic.
  - `templates/page.daily-orders.json` (new): page template.
  - `assets/tata.css` (edited): block `Daily Orders` (plus shared block).
- **API endpoint:** `GET /api/sap/daily-exports` (JWT). Cursor pages add `?limit=<n>&after=<cursor>|before=<cursor>`.
- **Shopify admin**
  1. Pages > Add page: title "Daily Orders", handle `daily-orders`, Theme template `page.daily-orders`.
  2. The existing footer link points to `/pages/daily-orders-sheet`; either change it to `/pages/daily-orders` or keep that page and assign it the `page.daily-orders` template.
- **Theme editor settings (section "THCM Daily Orders"):** heading, note, rows per page (5-50), show download column, access denied text.

### 3. Admin-only links (footer + header)

- **What:** header and footer links whose URL is in the "Admin-only link URLs" list are hidden unless `MAP_AUTH.isAdmin()`. They get `data-thcm-admin-link` (together with their `li` / `p` / heading wrapper if the link is the only content). `assets/tata.css` hides them immediately (no flash); for non-admins they are also removed from the DOM, including menus injected later (mobile drawer). Not active in the theme editor.
- **Employee Management:** `snippets/map-admin-employees.liquid` already stays hidden and makes no API call unless `isAdmin()`; no change needed.
- **Files**
  - `snippets/thcm-admin-links.liquid` (new): marking / removal script.
  - `config/settings_schema.json` (edited): new group "THCM Portal" with the textarea `thcm_admin_only_urls`.
  - `assets/tata.css` (edited): block `Admin-only links`.
  - `layout/theme.liquid` (edited): render tag (see section 0).
- **Shopify admin:** Customize > Theme settings > THCM Portal > Admin-only link URLs, one URL per line. Default: `/pages/daily-orders`, `/pages/daily-orders-sheet`, `/pages/employee-management` (the last two were added so the links that exist in the footer today are covered).
- **Theme editor settings:** `Admin-only link URLs` (theme setting, not per section).

### 4. FAQ page design

- **What:** 820px centered column, 72px / 40px vertical spacing, centered 36px / 28px heading with a 48x3px #C94F0C line, premium accordion (1px #E5E7EB rows, 17px semibold questions, round 32px "+" / "-" icon, hover and open in orange, smooth 200ms open, #4B5563 answers at 1.75 line height), mobile rules under 750px, visible orange focus ring. The duplicate page title "FAQ" is visually hidden (still read by screen readers). FAQ content and `templates/page.faq.json` were not touched.
- **Files:** `assets/tata.css` (edited): block scoped to `[data-template='page.faq']`.
- **Shopify admin:** nothing.
- **Note:** an earlier copy of this CSS had been lost (it was stuck in a `git stash` after a failed `git stash pop`); it was restored from the stash before this work.

### Test result

Playwright run against `shopify theme dev` (127.0.0.1:9292), desktop 1440 and mobile 390: **58 of 58 checks passed**. Screenshots are in `design-check/screenshots/` (`portal-*.png`).

**Important - what was and was not real:**
- `MAP_TEST_EMP_ID`, `MAP_TEST_EMP_PASSWORD`, `MAP_TEST_ADMIN_ID` and `MAP_TEST_ADMIN_PASSWORD` were **not set** in the environment, so no real login happened. The test script set the `map_token` (fake JWT) and `map_employee` cookies itself (employee and admin) and **mocked the backend** with Playwright route interception. So the UI logic is verified, but the real API responses are not.
- Because the API was mocked, the **cancel flow was only tested against the mock**: the POST went out to `/api/map/orders/<id>/cancel` with the `x-api-key` header, and no real order was touched.
- `/pages/orders` and `/pages/daily-orders` do not exist in the store yet (404), so the templates were tested with `/pages/faq?view=orders` and `?view=daily-orders`.
- The **theme editor placeholder views could not be tested** (the editor needs a Shopify admin session). The sample markup in both sections is plain static HTML behind `request.design_mode` and was reviewed by reading only.

Checks that passed (desktop and mobile):
- My Orders: own email in the list call with `x-api-key`; `after` / `before` never sent together; Next uses `after=<cursor>`, Previous uses `before=<cursor>`; Cancel button only on the order with `canCancel` (none on shipped / delivered / cancelled); Shipped tab filter; Track link opens in a new tab; confirm dialog, cancel POST and toast; empty state with Shop now; error state with Retry; chips 5 / 1 / 1 / 1 / 1; API text containing `<b>` is shown as plain text.
- Daily Orders: employee sees "This page is only for administrators." and no `/api/sap` request is made; admin sees the table (Bearer JWT, no api key), row expand, date filter (IST date handling), 404 -> "Access denied".
- Admin-only links: employee has 0 admin links in header and footer; admin sees them.
- Console: only Shopify CDN CORS errors from the local dev origin (`cdn.shopify.com ... origin_trials`) and the existing `shop.app` framing error. Nothing from the new code.

Not fixed / open: see "Known risks", plus the empty `sections/Orders.liquid` to delete by hand, and the Shopify admin steps above (pages and menu links).

---

## 2026-10-08 - Global API loader

### What

One global loader for every call to the MAP backend (`window.MAP_API_BASE`), instead of a loader per feature.
- **Top progress bar** (3px, #C94F0C, indeterminate): default for page-load data. The existing skeletons / inline states stay; the bar is added on top.
- **Full-screen overlay** (spinner + "Please wait...", `aria-live="polite"`, `aria-busy`): for user actions. The overlay is a `popover="manual"` element, so it sits above an open modal `<dialog>` and blocks background clicks.
- `window.fetch` is wrapped once and tracks **only** requests whose URL starts with `MAP_API_BASE`. Shopify `/cart/*.js`, analytics and CDN requests are untouched; the original response / errors are passed through unchanged.
- Pending counter: the loader hides only when the last parallel call finishes. It appears only after a call takes longer than 200ms and then stays for at least 300ms (fast calls never show it). A call that never finishes is released after 30s (`console.warn`). Errors always release the loader.
- Not shown in the theme editor (the snippet outputs only a no-op `THCM_LOADER` stub there, so callers do not break).

### MAP API call sites found

| Where | Calls | Loader |
| --- | --- | --- |
| `snippets/map-login.liquid` | `POST /api/auth/login` (own `fetch`) | overlay |
| `snippets/thcm-api.liquid` (`THCM_API`) | every `keyRequest` / `jwtRequest` | bar by default, per-call `options` |
| `snippets/thcm-orders-js.liquid` | orders list (bar), orders summary walk (**silent**), `POST .../cancel` (overlay) | see left |
| `snippets/thcm-daily-orders-js.liquid` | `GET /api/sap/daily-exports` | bar |
| `snippets/map-admin-employees.liquid` | own `fetch`: list GET (bar), POST / PUT / DELETE (overlay) | see left |
| `snippets/map-auth-head.liquid` | only `/cart/update.js` (Shopify, not tracked); no `MAP_API_BASE` call | none |

No other file calls `MAP_API_BASE` (the `fetch(` calls in `assets/*.js` are Shopify theme requests).

### Files

- `snippets/thcm-loader.liquid` (new): markup, `THCM_LOADER`, fetch wrapper.
- `layout/theme.liquid` (edited): `{% render 'thcm-loader' %}` right after `<body>`, before `map-login`.
- `assets/tata.css` (edited): block `THCM Loader` (overlay, spinner, bar, `.is-loading` button state). It also keeps the loader visible while `html.map-locked` hides every other body child (login screen).
- `snippets/thcm-api.liquid` (edited): optional 4th argument `options` on `keyRequest` / `jwtRequest`.
- `snippets/map-login.liquid` (edited): overlay header on the login fetch, button -> "Please wait..." + `.is-loading`, guard against a second submit. Auth / cookie logic untouched.
- `snippets/map-admin-employees.liquid` (edited): non-GET calls ask for the overlay; Save and Delete buttons show "Please wait..." + `.is-loading`. Existing error handling untouched.
- `snippets/thcm-orders-js.liquid` (edited): cancel uses the overlay; the summary walk is silent; confirm button shows "Please wait..." and ignores a second click.

### How to use

- Normal calls need nothing: any `fetch` to `MAP_API_BASE` shows the top bar automatically.
- User action (overlay): `THCM_API.keyRequest('POST', path, body, { mode: 'overlay' })`, or for a plain fetch add the headers from `THCM_LOADER.headers({ mode: 'overlay' })`. Also disable the button, set its text to "Please wait..." and add `.is-loading`.
- Background call (no loader): `THCM_API.keyRequest('GET', path, null, { silent: true })`, or `THCM_LOADER.headers({ silent: true })` on a plain fetch.
- Wrapping any promise: `THCM_LOADER.track(promise, { mode: 'overlay' | 'bar', label: 'Saving...' })` returns the same promise.
- Manual: `THCM_LOADER.show('Label')` / `THCM_LOADER.hide()` (overlay, counted).
- The wrapper reads the two hint headers (`x-thcm-loader`, `x-thcm-silent`) and **removes them before the request is sent**, so the backend and CORS preflight never see them. Always build them with `THCM_LOADER.headers(...)`: it returns `{}` in the theme editor, where there is no wrapper.

### Test result (Global API loader)

Playwright against `shopify theme dev`, backend mocked with route interception and a controllable delay (the same limitation as the portal tests: no `MAP_TEST_*` credentials, so no real login / backend). Desktop 1440: 36/36 checks. Mobile 390: 33/33 (the 30s timeout check runs on desktop only).

- Login (1.5s delay): overlay shows over the login card, button disabled with "Please wait..." + spinner, overlay hides after the response.
- My Orders load: top bar + the existing skeleton, overlay never shown. Daily Orders load: bar only. Admin employees list: bar only.
- Cancel order: overlay shows above the open confirm dialog; clicking "Keep order" behind it does nothing; only one cancel request is sent.
- Admin add (POST) and delete (DELETE): overlay, Save / Delete buttons show "Please wait...".
- 50ms responses: loader never appears. 500 response: error message shown, loader hidden.
- Two parallel calls (0.8s and 2.2s): loader stays until both finish.
- `{ silent: true }`: no loader. `/cart/update.js` (1.5s delay): no loader.
- `x-thcm-loader` / `x-thcm-silent` never reach the backend (checked on every request and every CORS preflight).
- A call that hangs forever: loader released after 30s with a `console.warn`.
- No console errors from the loader code.
- Screenshots (loader visible): `design-check/screenshots/loader-*-desktop.png` and `loader-*-mobile.png` (login overlay, orders bar, cancel overlay, daily bar, admin add overlay).

Notes:
- The theme editor was not tested (needs a Shopify admin session). In the editor the snippet only outputs the no-op `THCM_LOADER` stub and no markup, by design.
- While testing I found that an open modal `<dialog>` keeps the page inert, which let clicks through the overlay to the dialog. The loader now marks open dialogs `inert` while the overlay is visible and restores them afterwards.
- One mobile run once reported "fast calls: loader never appeared" as failed; it passed 33/33 on the rerun after I added a settle wait before measuring. I think that was a measurement race in my test (the page-load list call itself had just shown the loader), but I did not reproduce the failure to prove it.
- The loader hides when response headers arrive, not when the body has been read; the body is read right after, so the gap is a few milliseconds.

---

## 2026-10-08 - Admin state fix

### Problem
After logging in, the header name appeared at once but admin-only things (footer links, Employee Management panel, Daily Orders data) only showed after a reload. Every admin script reads `isAdmin()` once at page load, and login only removed the `map-locked` class (no reload, no event). `thcm-admin-links` also deleted the admin links from the DOM while logged out, so they could never come back without a reload. The employee name only showed because the login button's text change happened to trigger the menu's MutationObserver.

### Changes
- `snippets/map-login.liquid`: after `saveLogin` the page now reloads (`window.location.reload()`); the button stays disabled and reads "Signing you in..." until the page unloads.
- `snippets/map-auth-head.liquid`: sets `html.map-logged-in` and (admins only) `html.map-admin` synchronously in `<head>`. Skipped in the theme editor, as before.
- `snippets/thcm-admin-links.liquid`: admin-only links are no longer removed from the DOM; they get the class `thcm-admin-only`. The old `thcm-is-admin` / `data-thcm-admin-link` logic is gone. The MutationObserver stays (it tags links as they are parsed and menus injected later, e.g. the mobile drawer) but it no longer purges.
- `assets/tata.css`: `html:not(.map-admin) .thcm-admin-only { display: none !important; }`.
- `snippets/map-employee-menu.liquid`: the observer is only created when logged in, watches `body`, and only runs `init()` when an added node is / contains an uninitialised menu (was: whole document, every mutation, 50 ms timer).
- `map-admin-employees` and `thcm-daily-orders-js` check admin once at load; unchanged for this fix, they now run after the reload with the cookie present.

### Test result
Code and JS syntax checked. Not yet browser-tested: the test credentials (`MAP_TEST_*`) were not visible to the session (see Daily Orders fix).

---

## 2026-10-08 - Daily Orders fix

### Real API response shape
**Not captured yet.** The `MAP_TEST_*` environment variables were not visible to the Claude session (set after it started), so `POST /api/auth/login` could not be run and `GET /api/sap/daily-exports` has not been called. Fill this section in from the browser console line `THCM daily exports: raw response` (or rerun the check from a shell that has the variables).

### Changes (no dependency on the response shape)
- First call now sends `?limit=<rows per page>`; Next/Previous follow `after` / `before` cursors. Next is enabled when `pageInfo.nextCursor` OR `pageInfo.hasNextPage`; Previous likewise (`previousCursor` / `hasPreviousPage`). If the API gives `hasNextPage` without a cursor, the code falls back to `&page=N` (unverified guess).
- Download: relative paths (with or without leading slash) are joined to `MAP_API_BASE`. Files on the backend are fetched with `Authorization: Bearer` + `ngrok-skip-browser-warning` and saved as a blob; links to other hosts (e.g. pre-signed S3) remain normal links.
- Status pill: whole-word match. "incomplete" is grey, "broken" no longer counts as "ok". Red is checked before green.
- `snippets/thcm-api.liquid`: a 404 is "Access denied" only for `/api/admin/` routes or when the body message mentions access/permission/forbidden/admin; every other 404 rejects with "Not found (404)..." (shown with Retry). Network failure message is now "Server not reachable...".
- `snippets/map-admin-employees.liquid`: same 404 rule (a 404 with no message still counts as denied, since `/api/admin/*` answers 404 to non-admins); network error "Server not reachable".
- Parser keys (array path, date, count, amount, status, file, pageInfo) are **unchanged** until the real response is known.

### Backend conditions
Not assessed yet (no real response).

- Desktop dropdown custom CSS hata di (hover pe white strip issue). Ab Horizon ka default header menu chalega, styling Customizer se hogi.
