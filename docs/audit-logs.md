# Activity logs

The Logs page reads `/api/audit-logs`. Administrators can inspect all activity; ordinary users are scoped to their authenticated actor ID. Summary counts use the same filters and actor scope as the results, across all pages.

## Apply server changes on this installation

The API on port 5001 is managed by the Windows service `NodeCRMBackend` (NSSM). Updating source files does not reload this service. After backend changes have passed validation, restart it from an elevated PowerShell:

```powershell
Restart-Service -Name NodeCRMBackend
```

An unauthenticated GET to `/api/audit-logs?page=1&limit=25` must return HTTP 401 and JSON. HTTP 404 indicates that the running backend has not loaded the route. Verify through the IIS site as well as port 5001; successful authenticated requests return `items`, `total`, `summary`, `actors`, and `collections`.

Logs begin when the updated backend starts. The UI does not manufacture historical activity. Audit data cannot be edited or deleted through the generic forms, module configuration or import APIs.
