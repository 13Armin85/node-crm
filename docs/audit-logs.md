# Activity logs

The Logs page reads `/api/audit-logs`. Administrators can inspect all activity; ordinary users are scoped to their authenticated actor ID. Summary counts use the same filters and actor scope as the results, across all pages.

## Apply server changes on this installation

The API on port 5001 is managed by the Windows service `NodeCRMBackend` (NSSM). Updating source files does not reload this service. After backend changes have passed validation, restart it from an elevated PowerShell:

```powershell
Restart-Service -Name NodeCRMBackend
```

An unauthenticated GET to `/api/audit-logs?page=1&limit=25` must return HTTP 401 and JSON. HTTP 404 indicates that the running backend has not loaded the route. Verify through the IIS site as well as port 5001; successful authenticated requests return `items`, `total`, `summary`, `actors`, and `collections`.

Logs begin when the updated backend starts. The UI does not manufacture historical activity. Audit data cannot be edited or deleted through the generic forms, module configuration or import APIs.

## Readable confirmed actions

Each successful mutation request now creates at most one summary for its primary section. Repeated writes, relationship synchronization and notification creation within the same save do not create separate activity rows. Reads, failed requests and no-op saves are not recorded. Batch saves keep an affected-record count. New events store action, actor, target label and count rather than field values; existing field details are excluded from the read API.

The administrator selector includes every active account, including people with no activity, and retains historical actors whose accounts were removed. Selecting someone applies immediately. The user list also links directly to `/audit-logs?actorId=<user ID>`. Ordinary users cannot change their actor scope.

## Excel export

The Logs header offers an XLSX download of every matching page, using the applied filters and selected user. Unsaved filter edits do not change the export. Requests use the same authenticated, permission-scoped audit endpoint; ordinary users export only their own history. The workbook includes localized date/time, actor, username, section, action and the readable activity sentence. Technical IDs and legacy field values are omitted. Persian workbooks use a right-to-left sheet; headers are frozen and filterable. Failed or incomplete requests show an export error instead of downloading partial data.

## Automatic retention

Activity logs are retained for 14 days from `createdAt`. MongoDB's `audit_log_retention_14_days` TTL index expires older entries automatically for every user, including existing history. Recent entries remain available on the Logs page and in Excel exports. Cleanup runs in MongoDB even while the API is stopped; no application timer or scheduled task is required. The API waits for audit index initialization during database startup.

TTL cleanup is asynchronous (normally within about a minute after expiration, potentially longer under load). Deleted storage can be reused by MongoDB; database files do not necessarily shrink on disk. This policy only affects the `AuditLog` collection.
