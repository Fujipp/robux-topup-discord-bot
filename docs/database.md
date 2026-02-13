# Cloud Database (Free) Setup

This repo can store balances and topup history in a free cloud Postgres database.
Recommended free providers:
- Supabase (free Postgres + SQL editor)
- Neon (free Postgres)

The schema is in `db/schema.sql` and the migration script is `scripts/migrate_to_postgres.js`.

## Option A: Supabase (free)
1. Create a Supabase project (free tier is fine).
2. Open the SQL editor and run `db/schema.sql`.
3. Copy the **connection string** from Settings -> Database.

## Option B: Neon (free)
1. Create a Neon project.
2. Open the SQL editor and run `db/schema.sql`.
3. Copy the connection string from the dashboard.

## Migrate existing JSON data
1. Install the pg client:
   - `npm install pg`
2. Run the migration:
   - `DATABASE_URL="<your-connection-string>" node scripts/migrate_to_postgres.js`

## Connect the bot to Supabase
Set `DATABASE_URL` in your runtime environment to enable Postgres storage:
- `DATABASE_URL="<your-connection-string>"`

Optional env vars:
- `PROJECT_ID` (default: `discord-bot-topup`)
- `PROJECT_NAME` (default: same as PROJECT_ID)
- `NEWDATA_PATH` (default: `data/newdata.json`)
- `TOPUP_HISTORY_PATH` (default: `data/topup_history.json`)

## RLS (Row Level Security)
If you enable RLS on the tables and the bot starts failing with "DB init failed",
apply a permissive policy for the role used by `DATABASE_URL`.

Quick fix (uses the current DB role unless `RLS_ROLE` is set):
- `DATABASE_URL="<your-connection-string>" node scripts/apply_rls_policies.js`

Optional env vars:
- `RLS_ROLE` (default: current_user)
- `RLS_POLICY_PREFIX` (default: `bot_all`)

## Notes
- Discord user IDs are stored as text to avoid precision issues.
- `total_accumulated_topup` from `data/newdata.json` is stored as-is in `wallets`.
- Topup history is stored in `topup_transactions`.
