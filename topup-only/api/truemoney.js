// api/truemoney.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

function readConf() {
  try { return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../update/logdata.json'), 'utf8')); }
  catch { return {}; }
}

/**
 * Redeem TrueMoney Gift
 * @param {string} giftUrl - ลิงก์ https://gift.truemoney.com/campaign/?v=XXXX
 * @param {string} phone   - เบอร์ผู้รับเงิน 10 หลัก
 */
async function META_API(giftUrl, phone) {
  const cfg = readConf();
  // อ่านจาก .env ก่อน ถ้าไม่มีจึงอ่านจาก logdata.json (backward compatible)
  const KEY_ID = (process.env.API_TRUEMONEY_KEY_ID || cfg.API_TRUEMONEY_KEY_ID || '').trim();
  const BASE   = (process.env.TRUEMONEY_BASE || cfg.TRUEMONEY_BASE || 'https://true-wallet-voucher-production.up.railway.app').replace(/\/+$/,'');
  if (!KEY_ID) return { ok: false, error: { message: 'missing API_TRUEMONEY_KEY_ID' } };

  try {
    const res = await axios.post(
      `${BASE}/v1/redeem`,
      {
        phone: String(phone || '').trim(),
        gift_url: String(giftUrl || '').trim(),
        // idempotencyKey: uuid หรือสตริง ถ้าต้องการกันยิงซ้ำ (optional)
      },
      { headers: { 'Content-Type': 'application/json', 'X-Api-Key': KEY_ID } }
    );

    // 200 ทั้งกรณีสำเร็จและ failed จะแยกด้วยโค้ดข้อความฝั่ง service
    // สมมุติว่ารีสปอนส์เป็น { status: 'SUCCEEDED' | 'VERIFY_FAILED' | 'REDEEM_FAILED', amount, name_owner, ... }
    const data = res.data || {};
    if (String(data.status).toUpperCase() === 'SUCCEEDED') {
      return { ok: true, data };
    }
    return { ok: false, error: data };
  } catch (err) {
    const status = err?.response?.status;
    const data   = err?.response?.data;
    return { ok: false, error: { message: 'request failed', status, data } };
  }
}

module.exports = { META_API };
