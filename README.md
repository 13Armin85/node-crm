# Real Estate CRM

A MERN CRM for multilingual real-estate operations. The application supports English, Persian (RTL), and Turkish, dynamic admin-managed forms, partner customers, residences, properties, leads, activities, documents, quotes, and invoices.

## Requirements

- Node.js 18 or newer
- npm
- MongoDB 6 or newer

## Setup

Install the two applications:

```powershell
cd server
npm install
Copy-Item .env.example .env

cd ..\client
npm install
```

Edit `server/.env` before first startup. `JWT_SECRET` is required in production. Set `CORS_ORIGINS` to a comma-separated list of allowed client origins. If the database has no super administrator, set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`; these values are only used to create the first administrator.

Start the API and client in separate terminals:

```powershell
cd server
npm start
```

```powershell
cd client
npm start
```

The API listens on `http://localhost:5001` unless `PORT` is changed. Create React App serves the client on its usual development port.

For a local development database, create/reset the two local login accounts with:

```powershell
cd server
npm run seed:local-users
```

This command is disabled when `NODE_ENV=production`. Its defaults are `admin@gmail.com` / `admin123` and `user@gmail.com` / `user123`; override them with `LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_PASSWORD`, `LOCAL_USER_EMAIL`, and `LOCAL_USER_PASSWORD` environment variables.

## Estate data migration

The estate migration is additive and idempotent. It copies legacy Accounts into Partner Customers, maps recognizable legacy property values, creates form definitions, and updates role permissions. It never drops the legacy Accounts or Payments collections.

Always preview first:

```powershell
cd server
npm run migrate:estate
```

Review every reported unknown property type. Correct those source records or extend the explicit mapping in `server/scripts/migrate-estate.js`, run preview again, then apply:

```powershell
npm run migrate:estate -- --apply
```

Running `--apply` again is safe: migrated customers use `legacyAccountId`, definitions are upserted, and populated property fields are not overwritten.

## Dynamic forms

Super administrators can use **Form Builder** to manage custom fields and translated metadata for each main module. System fields can be reordered, enabled, and configured where allowed, but cannot be deleted or renamed internally. Supported field types include text, textarea, number, currency, select, multiselect, checkbox, radio, date, datetime, email, phone, file, and URL.

Property category, subtype, transaction type, currency, residence, and buyer relations use stable stored codes. Labels and option text are translated independently in English, Persian, and Turkish.

## Validation

```powershell
cd server
npm run check
npm test

cd ..\client
npm run lint
npm run build
```

Mongo-backed integration tests use a uniquely named temporary database and are opt-in:

```powershell
cd server
$env:ESTATE_INTEGRATION='1'
npm test
Remove-Item Env:ESTATE_INTEGRATION
```

## Security and storage

All estate endpoints require JWT authentication and enforce module/action permissions. Ordinary users are scoped to their own records; super administrators can access all records. Upload metadata is stored in MongoDB while files are written below `server/uploads`, which is excluded from version control. Use persistent protected storage for that directory in production.

## License

MIT
