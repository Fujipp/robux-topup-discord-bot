// bank/base.js
const fs = require("fs");
const path = require("path");

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const PROJECT_ID = String(process.env.PROJECT_ID || "discord-bot-topup").trim();
const PROJECT_NAME = String(process.env.PROJECT_NAME || PROJECT_ID).trim();
const USE_DB = DATABASE_URL.length > 0;

const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const formatBalance = (v) => {
  const num = Number(v);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
};
const normalizeTimestamp = (value) => {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return new Date().toISOString();
    return value.toISOString();
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return new Date().toISOString();
  return date.toISOString();
};
const isTrueMoneyMethod = (method) => String(method || "").toLowerCase().includes("truemoney");

function createJsonStorage() {
  function readCfg() {
    try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "config.json"), "utf8")); }
    catch { return {}; }
  }
  const CFG = readCfg();
  const CUSTOM_DB = CFG?.DATA_USERS && String(CFG.DATA_USERS).trim();
  const DB_PATH = path.resolve(process.cwd(), CUSTOM_DB || "data/balances.json");
  const TOPUP_HISTORY_PATH = path.resolve(process.cwd(), "data/topup_history.json");

  let balances = {};
  let topupHistory = {};

  function ensureFile() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
  }

  function ensureTopupHistoryFile() {
    const dir = path.dirname(TOPUP_HISTORY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(TOPUP_HISTORY_PATH)) fs.writeFileSync(TOPUP_HISTORY_PATH, JSON.stringify({}, null, 2));
  }

  async function loadBalances() {
    try { ensureFile(); balances = JSON.parse(fs.readFileSync(DB_PATH, "utf8") || "{}"); }
    catch { balances = {}; }
  }

  async function saveBalances() {
    try { ensureFile(); fs.writeFileSync(DB_PATH, JSON.stringify(balances, null, 2)); }
    catch (e) { console.error("saveBalances error:", e); }
  }

  async function loadTopupHistory() {
    try { ensureTopupHistoryFile(); topupHistory = JSON.parse(fs.readFileSync(TOPUP_HISTORY_PATH, "utf8") || "{}"); }
    catch { topupHistory = {}; }
  }

  async function saveTopupHistory() {
    try { ensureTopupHistoryFile(); fs.writeFileSync(TOPUP_HISTORY_PATH, JSON.stringify(topupHistory, null, 2)); }
    catch (e) { console.error("saveTopupHistory error:", e); }
  }

  async function setBalance(userId, amount) {
    balances[userId] = formatBalance(amount);
    await saveBalances();
    return balances[userId];
  }

  async function addBalance(userId, amount) {
    const cur = toNum(balances[userId]);
    const next = Math.round((cur + toNum(amount)) * 100) / 100;
    balances[userId] = next.toFixed(2);
    await saveBalances();
    return balances[userId];
  }

  async function deductBalance(userId, amount) {
    const cur = toNum(balances[userId]);
    const dec = toNum(amount);
    if (cur >= dec) {
      const next = Math.round((cur - dec) * 100) / 100;
      balances[userId] = next.toFixed(2);
      await saveBalances();
      return true;
    }
    return false;
  }

  async function getBalance(userId) {
    return typeof balances[userId] === "string" ? balances[userId] : "0.00";
  }

  async function removeBalance(userId) {
    if (userId in balances) {
      delete balances[userId];
      await saveBalances();
      return true;
    }
    return false;
  }

  async function recordTopup(userId, amount, method = "Unknown", timestamp = null) {
    if (!topupHistory[userId]) {
      topupHistory[userId] = { count: 0, totalAmount: 0, history: [] };
    }
    const entry = {
      amount: toNum(amount),
      method: String(method || "Unknown"),
      timestamp: normalizeTimestamp(timestamp),
    };
    topupHistory[userId].count = (topupHistory[userId].count || 0) + 1;
    topupHistory[userId].totalAmount = toNum(topupHistory[userId].totalAmount) + entry.amount;
    topupHistory[userId].history.push(entry);
    if (topupHistory[userId].history.length > 50) {
      topupHistory[userId].history = topupHistory[userId].history.slice(-50);
    }
    await saveTopupHistory();
    return entry;
  }

  async function hasTopupHistory(userId) {
    return topupHistory[userId]?.count > 0;
  }

  async function getTopupHistory(userId, limit = 50) {
    const data = topupHistory[userId];
    if (!data) return null;
    const history = Array.isArray(data.history) ? data.history.slice(-limit) : [];
    return {
      count: data.count || 0,
      totalAmount: toNum(data.totalAmount),
      history,
    };
  }

  async function updateTopupHistory(userId, index, amount, method = null, timestamp = null) {
    const data = topupHistory[userId];
    if (!data || !Array.isArray(data.history) || data.history.length === 0) return null;

    const len = data.history.length;
    const targetIndex = len - Number(index);
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= len) return null;

    const before = data.history[targetIndex];
    const nextAmount = toNum(amount);
    const nextMethod = method ? String(method) : String(before.method || "Unknown");
    const nextTimestamp = timestamp ? normalizeTimestamp(timestamp) : normalizeTimestamp(before.timestamp);

    data.history[targetIndex] = {
      amount: nextAmount,
      method: nextMethod,
      timestamp: nextTimestamp,
    };

    const delta = nextAmount - toNum(before.amount);
    data.totalAmount = toNum(data.totalAmount) + delta;
    await saveTopupHistory();

    return { before, after: data.history[targetIndex] };
  }

  async function deleteTopupHistory(userId, index) {
    const data = topupHistory[userId];
    if (!data || !Array.isArray(data.history) || data.history.length === 0) return null;

    const len = data.history.length;
    const targetIndex = len - Number(index);
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= len) return null;

    const [removed] = data.history.splice(targetIndex, 1);
    const countBase = Number.isFinite(Number(data.count)) ? Number(data.count) : len;
    data.count = Math.max(0, countBase - 1);
    data.totalAmount = Math.max(0, toNum(data.totalAmount) - toNum(removed?.amount));

    await saveTopupHistory();
    return removed || null;
  }

  return {
    loadBalances,
    saveBalances,
    setBalance,
    addBalance,
    deductBalance,
    getBalance,
    removeBalance,
    recordTopup,
    hasTopupHistory,
    getTopupHistory,
    updateTopupHistory,
    deleteTopupHistory,
    loadTopupHistory,
  };
}

function createDbStorage() {
  let Pool;
  try {
    ({ Pool } = require("pg"));
  } catch (err) {
    console.error("Missing dependency 'pg'. Run: npm install pg");
    return createJsonStorage();
  }

  const sslDisabled =
    /sslmode=disable/i.test(DATABASE_URL) ||
    /^(1|true)$/i.test(String(process.env.DB_SSL_DISABLE || ""));
  const sslStrict = /^(1|true)$/i.test(String(process.env.DB_SSL_STRICT || ""));

  let connectionString = DATABASE_URL;
  try {
    const parsed = new URL(DATABASE_URL);
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("sslrootcert");
    connectionString = parsed.toString();
  } catch {}

  const createPool = (rejectUnauthorized) =>
    new Pool({
      connectionString,
      ssl: sslDisabled ? undefined : { rejectUnauthorized },
    });

  let pool = createPool(sslStrict);
  let initPromise = null;

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        await pool.query("select 1");
      } catch (err) {
        if (!sslDisabled && err?.code === "SELF_SIGNED_CERT_IN_CHAIN") {
          console.warn("[DB] TLS chain issue detected, retrying with relaxed SSL.");
          try { await pool.end(); } catch {}
          pool = createPool(false);
          await pool.query("select 1");
        } else {
          throw err;
        }
      }
      await pool.query(
        `insert into projects (id, name)
         values ($1, $2)
         on conflict (id) do update set name = excluded.name`,
        [PROJECT_ID, PROJECT_NAME]
      );
      return true;
    })().catch((err) => {
      console.error("[DB] init failed:", err);
      return false;
    });
    return initPromise;
  }

  async function withClient(fn) {
    const ok = await init();
    if (!ok) throw new Error("DB init failed");
    const client = await pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  async function getUserId(client, discordUserId) {
    const res = await client.query(
      `insert into users (discord_user_id)
       values ($1)
       on conflict (discord_user_id)
       do update set discord_user_id = excluded.discord_user_id
       returning id`,
      [discordUserId]
    );
    return res.rows[0].id;
  }

  async function ensureWallet(client, userId) {
    const res = await client.query(
      `insert into wallets (user_id, project_id)
       values ($1, $2)
       on conflict (user_id, project_id)
       do update set user_id = excluded.user_id
       returning id, balance`,
      [userId, PROJECT_ID]
    );
    return res.rows[0];
  }

  async function findWalletId(client, discordUserId) {
    const res = await client.query(
      `select w.id
       from wallets w
       join users u on w.user_id = u.id
       where u.discord_user_id = $1 and w.project_id = $2`,
      [discordUserId, PROJECT_ID]
    );
    return res.rows[0]?.id || null;
  }

  async function getWalletId(client, discordUserId, createIfMissing = false) {
    if (!createIfMissing) {
      return findWalletId(client, discordUserId);
    }
    const uid = await getUserId(client, discordUserId);
    const row = await ensureWallet(client, uid);
    return row?.id || null;
  }

  async function loadBalances() {
    await init();
  }

  async function saveBalances() {
    return;
  }

  async function setBalance(userId, amount) {
    const next = await withClient(async (client) => {
      const uid = await getUserId(client, userId);
      const res = await client.query(
        `insert into wallets (user_id, project_id, balance)
         values ($1, $2, $3)
         on conflict (user_id, project_id)
         do update set balance = excluded.balance
         returning balance`,
        [uid, PROJECT_ID, toNum(amount)]
      );
      return res.rows[0]?.balance;
    });
    return formatBalance(next);
  }

  async function addBalance(userId, amount) {
    const next = await withClient(async (client) => {
      const uid = await getUserId(client, userId);
      const res = await client.query(
        `insert into wallets (user_id, project_id, balance)
         values ($1, $2, $3)
         on conflict (user_id, project_id)
         do update set balance = round(wallets.balance + excluded.balance, 2)
         returning balance`,
        [uid, PROJECT_ID, toNum(amount)]
      );
      return res.rows[0]?.balance;
    });
    return formatBalance(next);
  }

  async function deductBalance(userId, amount) {
    const dec = toNum(amount);
    if (dec <= 0) return false;

    return withClient(async (client) => {
      const uid = await getUserId(client, userId);
      await client.query(
        `insert into wallets (user_id, project_id)
         values ($1, $2)
         on conflict (user_id, project_id)
         do nothing`,
        [uid, PROJECT_ID]
      );
      const res = await client.query(
        `update wallets
         set balance = round(balance - $3, 2)
         where user_id = $1 and project_id = $2 and balance >= $3
         returning balance`,
        [uid, PROJECT_ID, dec]
      );
      return res.rowCount > 0;
    });
  }

  async function getBalance(userId) {
    const next = await withClient(async (client) => {
      const uid = await getUserId(client, userId);
      const row = await ensureWallet(client, uid);
      return row?.balance;
    });
    return formatBalance(next);
  }

  async function removeBalance(userId) {
    return withClient(async (client) => {
      const res = await client.query(
        `delete from wallets
         where user_id = (select id from users where discord_user_id = $1)
           and project_id = $2`,
        [userId, PROJECT_ID]
      );
      return res.rowCount > 0;
    });
  }

  async function recordTopup(userId, amount, method = "Unknown", timestamp = null) {
    const amt = toNum(amount);
    if (amt <= 0) return;

    const methodText = String(method || "Unknown");
    const isTrueMoney = isTrueMoneyMethod(methodText);
    const truemoneyDelta = isTrueMoney ? amt : 0;
    const occurredAt = normalizeTimestamp(timestamp);

    return withClient(async (client) => {
      await client.query("begin");
      try {
        const walletId = await getWalletId(client, userId, true);
        if (!walletId) throw new Error("wallet not found");

        await client.query(
          `insert into topup_transactions (wallet_id, amount, method, occurred_at)
           values ($1, $2, $3, $4)`,
          [walletId, amt, methodText, occurredAt]
        );

        await client.query(
          `update wallets
           set total_accumulated_topup = round(total_accumulated_topup + $2, 2),
               truemoney_topup = round(truemoney_topup + $3, 2)
           where id = $1`,
          [walletId, amt, truemoneyDelta]
        );

        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    });
  }

  async function hasTopupHistory(userId) {
    return withClient(async (client) => {
      const res = await client.query(
        `select 1
         from topup_transactions t
         join wallets w on t.wallet_id = w.id
         join users u on w.user_id = u.id
         where u.discord_user_id = $1 and w.project_id = $2
         limit 1`,
        [userId, PROJECT_ID]
      );
      return res.rowCount > 0;
    });
  }

  async function getTopupHistory(userId, limit = 50) {
    return withClient(async (client) => {
      const rowLimit = Math.max(1, Math.min(50, Number(limit) || 50));
      const walletId = await getWalletId(client, userId, false);
      if (!walletId) {
        return { count: 0, totalAmount: 0, history: [] };
      }

      const summaryRes = await client.query(
        `select count(*)::int as count,
                coalesce(sum(amount), 0) as total_amount
         from topup_transactions t
         where t.wallet_id = $1`,
        [walletId]
      );

      const historyRes = await client.query(
        `select id, amount, method, occurred_at
         from topup_transactions
         where wallet_id = $1
         order by occurred_at desc, id desc
         limit $2`,
        [walletId, rowLimit]
      );

      const history = historyRes.rows
        .map((row) => ({
          amount: toNum(row.amount),
          method: row.method,
          timestamp: new Date(row.occurred_at).toISOString(),
        }))
        .reverse();

      const count = summaryRes.rows[0]?.count || 0;
      const totalAmount = toNum(summaryRes.rows[0]?.total_amount || 0);

      return { count, totalAmount, history };
    });
  }

  async function updateTopupHistory(userId, index, amount, method = null, timestamp = null) {
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx <= 0) return null;

    return withClient(async (client) => {
      const walletId = await getWalletId(client, userId, false);
      if (!walletId) return null;

      const res = await client.query(
        `select id, amount, method, occurred_at
         from topup_transactions
         where wallet_id = $1
         order by occurred_at desc, id desc
         offset $2
         limit 1`,
        [walletId, idx - 1]
      );
      const row = res.rows[0];
      if (!row) return null;

      const before = {
        amount: toNum(row.amount),
        method: row.method,
        timestamp: new Date(row.occurred_at).toISOString(),
      };
      const nextAmount = toNum(amount);
      const nextMethod = method ? String(method) : String(before.method || "Unknown");
      const nextTimestamp = timestamp ? normalizeTimestamp(timestamp) : before.timestamp;

      const delta = nextAmount - before.amount;
      const deltaTrue =
        (isTrueMoneyMethod(nextMethod) ? nextAmount : 0) -
        (isTrueMoneyMethod(before.method) ? before.amount : 0);

      await client.query("begin");
      try {
        await client.query(
          `update topup_transactions
           set amount = $2, method = $3, occurred_at = $4
           where id = $1`,
          [row.id, nextAmount, nextMethod, nextTimestamp]
        );
        await client.query(
          `update wallets
           set total_accumulated_topup = greatest(0, round(total_accumulated_topup + $2, 2)),
               truemoney_topup = greatest(0, round(truemoney_topup + $3, 2))
           where id = $1`,
          [walletId, delta, deltaTrue]
        );
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      }

      return {
        before,
        after: {
          amount: nextAmount,
          method: nextMethod,
          timestamp: normalizeTimestamp(nextTimestamp),
        },
      };
    });
  }

  async function deleteTopupHistory(userId, index) {
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx <= 0) return null;

    return withClient(async (client) => {
      const walletId = await getWalletId(client, userId, false);
      if (!walletId) return null;

      const res = await client.query(
        `select id, amount, method, occurred_at
         from topup_transactions
         where wallet_id = $1
         order by occurred_at desc, id desc
         offset $2
         limit 1`,
        [walletId, idx - 1]
      );
      const row = res.rows[0];
      if (!row) return null;

      const before = {
        amount: toNum(row.amount),
        method: row.method,
        timestamp: new Date(row.occurred_at).toISOString(),
      };
      const deltaTrue = isTrueMoneyMethod(before.method) ? before.amount : 0;

      await client.query("begin");
      try {
        await client.query(`delete from topup_transactions where id = $1`, [row.id]);
        await client.query(
          `update wallets
           set total_accumulated_topup = greatest(0, round(total_accumulated_topup - $2, 2)),
               truemoney_topup = greatest(0, round(truemoney_topup - $3, 2))
           where id = $1`,
          [walletId, before.amount, deltaTrue]
        );
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      }

      return before;
    });
  }

  return {
    loadBalances,
    saveBalances,
    setBalance,
    addBalance,
    deductBalance,
    getBalance,
    removeBalance,
    recordTopup,
    hasTopupHistory,
    getTopupHistory,
    updateTopupHistory,
    deleteTopupHistory,
  };
}

const storage = USE_DB ? createDbStorage() : createJsonStorage();

// Avoid DB init on startup; connect only when a command calls into storage.
if (!USE_DB) {
  void storage.loadBalances();
  if (storage.loadTopupHistory) {
    void storage.loadTopupHistory();
  }
}

module.exports = {
  loadBalances: (...args) => storage.loadBalances(...args),
  saveBalances: (...args) => storage.saveBalances(...args),
  setBalance: (...args) => storage.setBalance(...args),
  addBalance: (...args) => storage.addBalance(...args),
  deductBalance: (...args) => storage.deductBalance(...args),
  getBalance: (...args) => storage.getBalance(...args),
  removeBalance: (...args) => storage.removeBalance(...args),
  recordTopup: (...args) => storage.recordTopup(...args),
  hasTopupHistory: (...args) => storage.hasTopupHistory(...args),
  getTopupHistory: (...args) => storage.getTopupHistory(...args),
  updateTopupHistory: (...args) => storage.updateTopupHistory(...args),
  deleteTopupHistory: (...args) => storage.deleteTopupHistory(...args),
};
