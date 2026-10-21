# Mobile and PWA

The app is served as a responsive web app and an installable PWA. The manifest provides 192px/512px launcher icons, a maskable Android icon, an Apple touch icon, standalone display and shortcuts. The profile menu includes **Install the application**; Android/desktop uses the native install prompt when offered, and iOS shows Safari / Share / Add to Home Screen instructions.

Only production builds on secure origins register a service worker. Private API responses, CRM records, documents, authentication tokens and authenticated HTML are never added to Cache Storage. Only the public offline screen and its logo are cached. Navigations use the network; connection failure shows a localized offline screen and reconnecting reloads the original route. Data entry requires a live server connection; writes are not queued.

Builds run `scripts/prepare-pwa.cjs` automatically after CRA to stamp the worker from the asset manifest and public PWA sources. New workers wait; the app offers an explicit update action with a reminder to save edits first. First installation and background updates do not reload active forms. Old PWA caches are removed on activation; unrelated caches remain untouched.

## HTTPS for this installation

The public endpoint is `https://37.148.206.74/`. Browser page visits to the public HTTP IP redirect to HTTPS; API requests and ACME validation retain their own routes. Standard installation is unavailable on the old HTTP origin. The IP certificate uses Let's Encrypt's short-lived profile, issued and renewed by Posh-ACME 4.35.0; no domain name is required.

`scripts/configure-crm-https.ps1 -Staging` provisions a separate public ACME challenge virtual directory and tests issuance. Run without `-Staging` after validation to enable the production certificate, HTTPS binding and inbound TCP 443 rule. The source renewal script is copied outside the deployed client build.

The `NodeCRMHTTPS-Renewal` scheduled task runs as SYSTEM four times daily. It respects the CA renewal window and updates the IIS binding after successful renewal. Keys and account state are under `C:\ProgramData\NodeCRM\Acme` with access restricted to SYSTEM and Administrators. Only the separate `AcmeChallenges` folder is readable by IIS/IUSR. Rebuilding the client does not remove renewal state or challenge routing. Status is written to `production-result.json` in the protected state directory; check task result, certificate expiration and HTTPS connectivity when operating the server.

Browser storage belongs to each origin. Users opening HTTPS for the first time sign in again; tokens are not copied from the HTTP origin.

## Verification

Run `node scripts/check-mobile-pwa.cjs` after a production build. It uses an isolated server and synthetic API responses, covering 20 main routes across 320px, 390px, 430px and landscape viewports, three languages and administrative/user roles. It checks page overflow, mobile drawer scroll locking, dialogs with reduced keyboard height, valid manifest, public-only offline caches, explicit worker updates and offline recovery. No live CRM records are written. Set `CRM_MOBILE_FOCUSED=1` to rerun only interactions and PWA lifecycle, or `CRM_MOBILE_AUDIT_ONLY=1` for layout diagnostics.

For deployment without interrupting installed clients, build into a separate `BUILD_PATH`, test that directory with `CRM_BUILD_ROOT`, then run `scripts/deploy-client-build.ps1` to copy assets before replacing `index.html` and `service-worker.js`. Retain the previous hashed assets so active tabs can finish loading their existing version. The postbuild PWA stamp supports both the default and a custom build directory.


## Mobile record tables

Below 768px, shared record lists, property/residence/partner lists and the dashboard sales table show each record as a labeled card. The original cells and controls are reused, including selection, permissions, sharing, actions and column preferences. Shared tables provide a native mobile sort selector; estate list sorting stays in Filters. Desktop tables and editable invoice line items retain their table layout.

Dashboard card headers use stable child classes for the icon, title, subtitle, count and actions. Phone headers keep a compact title and move action buttons to their own row; the header cannot shrink around its controls. Generated Emotion class names are not used as selectors.

The responsive browser check also verifies card labels, touch target sizes, sorting, row selection, action menus, hidden columns, dark mode and desktop table layout. Screenshots are saved under `layout-artifacts/mobile-pwa/`.


Record lists use the shared `RecordMenuButton` for a labeled mobile Actions menu with a horizontal ellipsis. `RecordPagination` is shared by client-paged tables, estate lists and audit history. It shows the current page, record range, nearby page buttons, previous/next controls, a page-size selector and direct page entry for larger result sets. Client-paged lists initially show five records; estate and audit requests use their selected page size. Changing the page size returns to page one. The pager remains visible for one-page, nonempty lists.

Set `CRM_PAGINATION_CHECK=1` and `CRM_MOBILE_ROUTE=/contacts` when running `scripts/check-mobile-pwa.cjs` to verify numbered pages, real row changes, size changes, the final partial page and action menus using 43 isolated records across phone and desktop widths.


## Responsive dialogs

All Chakra modal and drawer surfaces use the visible viewport bounds, safe-area margins, a constrained header/footer and a scrolling body. `ModalViewport` updates shared CSS variables on visual viewport resize/scroll, so a keyboard that only reduces the visual viewport still leaves controls inside the visible screen. The browser retains focus trapping and scroll locking. Form wrappers inside a dialog participate in the same flex layout.

Advanced search dialogs scroll internally. The shared search form uses a single column on phones and stacks date-range inputs on narrow screens. Search, clear and close controls remain outside the scrolling body. Legacy advanced search variants use the same responsive surface and labels follow the current color theme.

Run `CRM_MODAL_CHECK=1 node scripts/check-mobile-pwa.cjs` against a built client to check tall search forms, help, contact drawers, column selection, imports, delete confirmation, estate/user/task forms and nested password forms across phone, landscape and desktop viewports. The fixtures also exercise visual-only keyboard resizing with an offset and phone safe areas. No live records are changed.


Advanced search now uses a compact filter surface capped at 500px wide and the smaller of 540px or 76% of the visible viewport height. The shared form keeps date filters collapsed initially; opening or closing that section retains its values until Clear, close or apply resets them. Applying uses form submission, including Enter from text inputs. Legacy search dialogs share the compact dimensions and field/button spacing.

`CRM_COMPACT_FILTER_CHECK=1 node scripts/check-mobile-pwa.cjs` checks default and expanded filter sizes, date criteria, Enter submission, and user/task/call filters against isolated records in phone, landscape and desktop viewports.


Creation/editing forms use the `crm-record-form` class to share the filter dialog dimensions: at most 500px wide, and the smaller of 540px or 76% of the visual viewport height. Legacy drawers are centered with an automatic content height. Field spacing and entity sections are smaller, while the footer stays outside the scrolling body. Document/folder creation, estate entries, users, tasks and the older module forms share this treatment. Read-only estate details keep their separate layout.

Use `CRM_COMPACT_RECORD_CHECK=1 node scripts/check-mobile-pwa.cjs` to check centered create dialogs and visible actions for the main record modules, tasks, folders and document uploads across phone and desktop widths using isolated API fixtures.
