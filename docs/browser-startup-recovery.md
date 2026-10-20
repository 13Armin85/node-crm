# Browser startup recovery

A browser with a valid remembered session and an old `persist:image` value containing an API error object reproduced an empty React root with `filter is not a function`. Reloading and clearing HTTP cache do not remove this localStorage entry.

Server record lists now stay in memory. Startup removes only the four legacy Redux response caches (`persist:image`, `persist:route`, `persist:lead`, `persist:contact`). Authentication, language, theme and unrelated drafts are preserved. Startup thunks reject non-list/error responses; a 401 for the current token clears that session and its in-memory records. A late 401 for a previous token cannot sign out a new session.

The HTML shell loads an independent recovery script before the application bundle. Storage access failures use tab-local memory, failed application assets receive at most one automatic retry, and a persistent failure shows a retry control. React render failures have an independent error boundary. IIS revalidates the shell and startup script, caches versioned static assets, and returns 404 for missing assets instead of serving HTML as JavaScript.

Validation:

```powershell
cd client
npm test -- --watchAll=false --runInBand --testTimeout=30000
npm run lint
npm run build
cd ..
node scripts/check-startup-ui.cjs
```

Set `CRM_BUILD_ROOT` to verify a staged build, `CRM_UI_ORIGIN` to verify a deployed site, and `BROWSER_PATH` (or the existing `CHROME_PATH`) to select an installed browser. Set `CRM_BROWSER=firefox` and `BROWSER_PATH` to the Firefox executable to run the same checks using Firefox over WebDriver BiDi. The browser check intercepts all API requests and uses synthetic records, including its login request; it never changes live data. It covers poisoned caches across reloads, malformed session JSON, revoked sessions, malformed API responses, blocked Web Storage including login, an initially missing bundle, and a persistently unavailable bundle with a bounded retry.

Publish assets and `startup.js` before switching `web.config` and `index.html`. Keep the preceding index, configuration and asset files for rollback.

Firefox verification uses the same application files through WebDriver BiDi. Set `CRM_BROWSER=firefox` and `BROWSER_PATH` to a Firefox executable. The browser launcher uses the Firefox transport instead of Chromium pipes.

Asset failure scenarios use a local HTTP server reading the selected build directory (the deployed build by default). The server sends real 404 responses, then restores the asset for the manual retry. Their authenticated session is seeded in a dedicated same-origin fixture document before fault injection and survives the actual browser navigations. Retry limits count top-level document requests, excluding speculative script fetches and SPA history updates. With `CRM_UI_ORIGIN` set, the other five scenarios run directly against that site. All API calls, including login, remain synthetic fixtures.

Use `CRM_STARTUP_SCENARIOS=asset-unavailable` to run one scenario, or a comma-separated list to select several. `CRM_DEBUG_STARTUP=1` prints browser runtime error stacks.
