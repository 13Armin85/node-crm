# Backend security and performance

This change retains the CRM's forms, permissions, conversions, currencies and response structures. No business records are migrated or removed. The changes target measured database/reporting overhead and verified dependency vulnerabilities.

## Implementation

- Financial summaries aggregate commissions, outcomes and colleague totals in MongoDB. The API receives grouped results instead of every opportunity. Date matching uses separate indexed closing-date and creation-date branches, including legacy currencies and records without a closing date.
- Email/call/text charts aggregate by UTC day or Monday-based week. Empty buckets and sender/person/ownership filters remain intact. Dates must be valid calendar dates; each request supports up to 3,660 days. Longer history can be requested in separate windows.
- Nine additional indexes support opportunity date ranges, communication dates/senders and document descendants. Existing indexes are retained; `syncIndexes()` is not used.
- Shared-folder access loads granted folders and their descendants in batches. It preserves independent file grants, inherited access, legacy folders and immediate revocation, and terminates cycles without scanning unrelated trees.
- Form-definition reads run concurrently. User roles, session versions, permissions and record access remain freshly checked on each request; they are not cached between users.
- API responses send `Cache-Control: private, no-store` and vary by authorization and the administrator's person filter. Rate limiting runs before JSON decompression/parsing. CORS middleware is constructed once.
- JWT failures remain 401. Database/network/query-timeout failures return a safe 503 instead of falsely invalidating a valid session. Validation and malformed multipart errors retain safe client errors.
- Exchange-rate refreshes are shared by simultaneous requests. XML size is bounded to 512 KiB, refresh attempts have a 20-second overall budget, failures back off for 30 seconds, and cached rates retain the existing `stale` behavior.
- HTTP header limits, connection pooling and operational deadlines are explicit. SIGINT/SIGTERM stop accepting connections, drain requests and close MongoDB; forced socket closure is bounded by the shutdown deadline.
- Compatible dependency updates address the audit findings, including body-parser, Multer, Nodemailer and Puppeteer. Installed package versions are checked against the lockfile.

## Operational defaults

Optional environment overrides are documented in `server/.env.example` and validated at startup.

| Setting | Default |
| --- | --- |
| `DB_MAX_POOL_SIZE` | 50 connections |
| `DB_WAIT_QUEUE_TIMEOUT_MS` | 5,000 ms |
| `DB_SELECTION_TIMEOUT_MS` | 5,000 ms |
| `REPORT_QUERY_TIMEOUT_MS` | 30,000 ms |
| `HTTP_REQUEST_TIMEOUT_MS` | 300,000 ms, including uploads |
| `SHUTDOWN_TIMEOUT_MS` | 30,000 ms |

Header receipt is limited to 30 seconds and 16 KiB; keep-alive is 5 seconds. Deploy behind the existing IIS reverse proxy. Permission data is deliberately not cached. Rate-limit storage remains process-local, appropriate for the current single backend process; replicas would require a shared store.

## Verification

Run from `server` with local MongoDB available:

```powershell
npm run check:dependencies
npm run check
npm test
npm run test:integration
npm audit --omit=dev
```

`test:integration` enables every existing MongoDB-backed suite, including authorization, password/session revocation, uploads, conversions, imports, notes/profiles, dynamic forms, financial summaries, notifications and document sharing. The complete enabled run passed **218 tests, zero failures, zero skips**. Tests create uniquely named temporary databases and remove only those databases. Email delivery is stubbed where exercised. Historical sharing/visibility expectations were updated to the existing exclusive lead-assignment behavior, and opportunity fixtures now include all three required financial amounts; production authorization rules were not loosened.

The performance integration test compares the optimized financial result to the previous calculation across TRY/USD/EUR, rolling periods, legacy stage/currency/date values and user scopes. With 12,000 fixture opportunities, one isolated run previously materialized 4,601 raw opportunities in Node (1,163,011 serialized bytes); the equivalent grouped summary was 892 bytes, 99.92% smaller. This measures the reduction in raw data handled by the server, not a change in the browser's existing response contract. The measured calculation was 158.63 ms before and 67.22 ms after. These are local fixture measurements, not production latency guarantees; concurrent test load changes timings. Index selection is also checked with `explain`.

Evidence is retained under `layout-artifacts/backend-*.log`, `backend-audit-after.json`, `backend-live-results.json` and `backend-browser/`. The post-update npm audit returned zero known production dependency vulnerabilities. Audit results describe the registry's known advisories at the time of the check, rather than a guarantee against all security defects.

After restarting `NodeCRMBackend`, the read-only live check passed: HTTPS, backend security/private-cache headers, profile/notes/workspace APIs, properties/residences, all three financial currencies, the live exchange rate, reports and all nine indexes. Browser checks also passed against the existing dashboard build with the new backend in Persian, Turkish and English, including mobile widths. Frontend assets are unchanged by this backend release.

## Deployment and rollback

Install with `npm ci` from the committed lockfile, verify installed dependencies, run checks, then restart `NodeCRMBackend`. Ensure the service manager allows the configured shutdown interval before killing the process. New indexes are additive and built by Mongoose's existing initialization mechanism. Keep protected uploads and environment configuration in place.

The pre-change source/lockfile snapshot for this session is under `layout-artifacts/backend-baseline/source.tar`. A source rollback should retain patched compatible dependencies where possible, preserve `.env` and uploads, and restart the service. No database rollback or index deletion is required.

Design references: [MongoDB aggregation optimization](https://www.mongodb.com/docs/v7.0/core/aggregation-pipeline-optimization/), [Node HTTP server timeouts and shutdown](https://nodejs.org/api/http.html), [Express production security](https://expressjs.com/advanced/best-practice-security/).
