#!/usr/bin/env node
const { Client } = require("pg");

const DATABASE_URL = (process.env.DATABASE_URL || "").trim();
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL env var.");
  process.exit(1);
}

const EXPLICIT_ROLE = (process.env.RLS_ROLE || "").trim();
const POLICY_PREFIX = (process.env.RLS_POLICY_PREFIX || "bot_all").trim();

const needsSsl =
  /sslmode=require/i.test(DATABASE_URL) || /supabase\.co/i.test(DATABASE_URL);

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  const roleRes = await client.query("select current_user as role");
  const role = EXPLICIT_ROLE || roleRes.rows[0]?.role;
  if (!role) {
    throw new Error("Unable to determine role. Set RLS_ROLE env var.");
  }

  const roleIdent = role.toLowerCase() === "public" ? "public" : quoteIdent(role);
  const tables = ["projects", "users", "wallets", "topup_transactions"];

  for (const table of tables) {
    const policyName = `${POLICY_PREFIX}_${table}`;
    await client.query(`alter table ${table} enable row level security`);
    await client.query(`drop policy if exists ${quoteIdent(policyName)} on ${table}`);
    await client.query(
      `create policy ${quoteIdent(policyName)}
       on ${table}
       for all
       to ${roleIdent}
       using (true)
       with check (true)`
    );
  }

  await client.end();
  console.log(`Applied RLS policies for role: ${role}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
