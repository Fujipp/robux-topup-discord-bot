#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

let Client;
try {
  ({ Client } = require("pg"));
} catch (err) {
  console.error("Missing dependency 'pg'. Run: npm install pg");
  process.exit(1);
}

const DATABASE_URL = (process.env.DATABASE_URL || "").trim();
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL env var.");
  process.exit(1);
}

const projectId = (process.env.PROJECT_ID || "discord-bot-topup").trim();
const projectName = (process.env.PROJECT_NAME || projectId).trim();
const dataPath = path.resolve(process.cwd(), process.env.NEWDATA_PATH || "data/newdata.json");
const historyPath = path.resolve(process.cwd(), process.env.TOPUP_HISTORY_PATH || "data/topup_history.json");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8") || "{}");
  } catch (err) {
    console.error(`Failed to read JSON: ${filePath}`);
    throw err;
  }
}

function toAmount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

async function main() {
  const newData = readJson(dataPath);
  const historyData = readJson(historyPath);
  const userIds = new Set([...Object.keys(newData), ...Object.keys(historyData)]);

const needsSsl = /sslmode=require/i.test(DATABASE_URL) || /supabase\.co/i.test(DATABASE_URL);
const client = new Client({
  connectionString: DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});
  await client.connect();

  await client.query(
    `insert into projects (id, name)
     values ($1, $2)
     on conflict (id) do update set name = excluded.name`,
    [projectId, projectName]
  );

  let walletCount = 0;
  let txCount = 0;

  for (const discordUserId of userIds) {
    const row = newData[discordUserId] || {};
    const balance = toAmount(row.balance);
    const totalAccumulated = toAmount(row.total_accumulated_topup);
    const truemoneyTopup = toAmount(row.truemoney_topup);

    const userRes = await client.query(
      `insert into users (discord_user_id)
       values ($1)
       on conflict (discord_user_id)
       do update set discord_user_id = excluded.discord_user_id
       returning id`,
      [discordUserId]
    );
    const userId = userRes.rows[0].id;

    const walletRes = await client.query(
      `insert into wallets (user_id, project_id, balance, total_accumulated_topup, truemoney_topup)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, project_id)
       do update set
         balance = excluded.balance,
         total_accumulated_topup = excluded.total_accumulated_topup,
         truemoney_topup = excluded.truemoney_topup,
         updated_at = now()
       returning id`,
      [userId, projectId, balance, totalAccumulated, truemoneyTopup]
    );
    const walletId = walletRes.rows[0].id;
    walletCount += 1;

    const history = historyData[discordUserId]?.history || [];
    for (const item of history) {
      const amount = toAmount(item?.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const method = String(item?.method || "Unknown");
      const occurredAt = item?.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString();

      await client.query(
        `insert into topup_transactions (wallet_id, amount, method, occurred_at)
         values ($1, $2, $3, $4)
         on conflict (wallet_id, occurred_at, amount, method) do nothing`,
        [walletId, amount, method, occurredAt]
      );
      txCount += 1;
    }
  }

  await client.end();

  console.log(`Upserted wallets: ${walletCount}`);
  console.log(`Inserted topup history rows: ${txCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
