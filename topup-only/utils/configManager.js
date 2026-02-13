// utils/configManager.js
// จัดการ Config ในแบบ centralized
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '../update/logdata.json');

class ConfigManager {
  // อ่านค่าจาก .env และ config file (priority: .env > config > default)
  static get(key, defaultValue = null) {
    const envKey = this._keyToEnv(key);
    if (process.env[envKey]) {
      return process.env[envKey];
    }
    const data = this.loadAll();
    return data[key] ?? defaultValue;
  }

  // เขียนค่าลง config file
  static set(key, value) {
    const data = this.loadAll();
    data[key] = value;
    this.saveAll(data);
    return true;
  }

  // ลบค่า
  static delete(key) {
    const data = this.loadAll();
    delete data[key];
    this.saveAll(data);
    return true;
  }

  // อ่านทั้งหมด
  static loadAll() {
    try {
      if (!fs.existsSync(CONFIG_PATH)) {
        return {};
      }
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) || {};
    } catch {
      return {};
    }
  }

  // เขียนทั้งหมด
  static saveAll(data) {
    try {
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
      return true;
    } catch (err) {
      console.error('ConfigManager.saveAll error:', err);
      return false;
    }
  }

  // แปลง Key ไทย เป็น ENV format
  static _keyToEnv(key) {
    // เช่น "API_SLIPOK_KEY" → "API_SLIPOK_KEY"
    //    "เบอร์รับเงินวอเลท" → "TRUEMONEY_PHONE"
    const mapping = {
      'API_SLIPOK_KEY': 'API_SLIPOK_KEY',
      'SLIPOK_BRANCH_ID': 'SLIPOK_BRANCH_ID',
      'API_TRUEMONEY_KEY_ID': 'API_TRUEMONEY_KEY_ID',
      'TRUEMONEY_BASE': 'TRUEMONEY_BASE',
      'เบอร์รับเงินวอเลท': 'TRUEMONEY_PHONE',
    };
    return mapping[key] || key.toUpperCase().replace(/\s+/g, '_');
  }

  // Schema: ข้อมูล config ทั้งหมดแบ่งตามหมวดหมู่
  static getSchema() {
    return {
      // === SlipOK (Bank Transfer / QR) ===
      'API_SLIPOK_KEY': {
        label: '🔑 API Key',
        description: 'API Key จาก SlipOK',
        category: 'slipok',
        categoryLabel: '🏦 SlipOK (ธนาคาร/QR)',
        type: 'secret',
        required: false,
        order: 1,
      },
      'SLIPOK_BRANCH_ID': {
        label: '🆔 Branch ID',
        description: 'รหัสท้ายลิงก์จาก SlipOK',
        category: 'slipok',
        categoryLabel: '🏦 SlipOK (ธนาคาร/QR)',
        type: 'text',
        required: false,
        order: 2,
      },
      'เบอร์รับเงินพ้อมเพย์': {
        label: '📱 เบอร์ PromptPay',
        description: 'เบอร์PromptPay สำหรับรับเงิน (10 หลัก)',
        category: 'slipok',
        categoryLabel: '🏦 SlipOK (ธนาคาร/QR)',
        type: 'phone',
        required: false,
        order: 3,
      },
      'เติมเงินขั้นต่ำของธนาคาร': {
        label: '💵 จำนวนเติมขั้นต่ำ',
        description: 'ยอดขั้นต่ำที่ต้องเติม (บาท)',
        category: 'slipok',
        categoryLabel: '🏦 SlipOK (ธนาคาร/QR)',
        type: 'number',
        required: false,
        order: 4,
      },

      // === TrueMoney Wallet ===
      'API_TRUEMONEY_KEY_ID': {
        label: '🔑 API Key',
        description: 'API Key สำหรับ TrueMoney Voucher',
        category: 'truemoney',
        categoryLabel: '🧧 TrueMoney Wallet',
        type: 'secret',
        required: false,
        order: 1,
      },
      'เบอร์รับเงินวอเลท': {
        label: '📱 เบอร์ Wallet',
        description: 'เบอร์รับเงินวอเลท (10 หลัก)',
        category: 'truemoney',
        categoryLabel: '🧧 TrueMoney Wallet',
        type: 'phone',
        required: false,
        order: 2,
      },
      'TRUEMONEY_BASE': {
        label: '🌐 Base URL',
        description: 'URL ของ TrueMoney API Service',
        category: 'truemoney',
        categoryLabel: '🧧 TrueMoney Wallet',
        type: 'text',
        required: false,
        order: 3,
      },
      'TRUEMONEY_FEE': {
        label: '💸 ค่าธรรมเนียม',
        description: 'จำนวนเงินที่หักจากการเติม TrueMoney (บาท)',
        category: 'truemoney',
        categoryLabel: '🧧 TrueMoney Wallet',
        type: 'number',
        required: false,
        order: 4,
        default: 5,
      },

      // === Discord Channels ===
      'ไอดีช่องเช็คสลิป': {
        label: '📝 Channel เช็คสลิป',
        description: 'ID ของช่องสำหรับส่งสลิป',
        category: 'channels',
        categoryLabel: '📢 Discord Channels',
        type: 'channel',
        required: false,
        order: 1,
      },
      'ไอดีช่องแจ้งเตือนเติมเงิน': {
        label: '🔔 Channel แจ้งเตือน',
        description: 'ID ของช่องแจ้งเตือนเติมเงินสำเร็จ',
        category: 'channels',
        categoryLabel: '📢 Discord Channels',
        type: 'channel',
        required: false,
        order: 2,
      },

      // === Discord Roles ===
      'ยศไอดีเช็คสลิป': {
        label: '👑 Role ผู้เช็คสลิป',
        description: 'Role ID ของผู้มีสิทธิ์เช็คสลิป',
        category: 'roles',
        categoryLabel: '👥 Discord Roles',
        type: 'role',
        required: false,
        order: 1,
      },
      'ไอดียศได้รับเมื่อเติมเงิน': {
        label: '🎖️ Role สมาชิก',
        description: 'Role ID ให้เมื่อเติมเงินสำเร็จ',
        category: 'roles',
        categoryLabel: '👥 Discord Roles',
        type: 'role',
        required: false,
        order: 2,
      },
      'ALLOWED_ROLES_PAYMENT': {
        label: '🎫 Role ใช้คำสั่ง /payment',
        description: 'Role IDs ที่มีสิทธิ์ใช้คำสั่ง /payment (คั่นด้วย , หลายยศ)',
        category: 'roles',
        categoryLabel: '👥 Discord Roles',
        type: 'text',
        required: false,
        order: 3,
      },
      'ALLOWED_ROLES_USER': {
        label: '👤 Role ใช้คำสั่ง /user',
        description: 'Role IDs ที่มีสิทธิ์ใช้คำสั่ง /user (คั่นด้วย , หลายยศ)',
        category: 'roles',
        categoryLabel: '👥 Discord Roles',
        type: 'text',
        required: false,
        order: 4,
      },

      // === System Settings ===
      'ปรับกำหนดเวลาเช็คสลิป': {
        label: '⏱️ เวลาเช็คสลิป',
        description: 'ระยะเวลาให้เช็คสลิป (วินาที)',
        category: 'system',
        categoryLabel: '⚙️ ตั้งค่าระบบ',
        type: 'number',
        required: false,
        order: 1,
      },
      'เมนูระบบใช้งานธนาคาร': {
        label: '🏦 สถานะระบบธนาคาร',
        description: 'เปิด/ปิดการใช้งานระบบธนาคาร',
        category: 'system',
        categoryLabel: '⚙️ ตั้งค่าระบบ',
        type: 'boolean',
        required: false,
        order: 2,
      },
      'allowedUserIds': {
        label: '🛂 ผู้ใช้ที่ใช้คำสั่งได้',
        description: 'User IDs ที่อนุญาตให้ใช้คำสั่งแอดมิน (คั่นด้วย , หรือบรรทัดใหม่)',
        category: 'system',
        categoryLabel: '⚙️ ตั้งค่าระบบ',
        type: 'list',
        required: false,
        order: 3,
      },
      'ไอดีผู้ใช้งานที่ใช้คำสั่งได้': {
        label: '🛂 ผู้ใช้ที่ใช้คำสั่งได้ (เดิม)',
        description: 'User IDs ที่อนุญาตให้ใช้คำสั่งแอดมิน (alias)',
        category: 'system',
        categoryLabel: '⚙️ ตั้งค่าระบบ',
        type: 'list',
        required: false,
        order: 4,
      },

      // === Roblox Robux Settings ===
      'ROBUX_RATE': {
        label: '💱 เรท Robux',
        description: 'เลือกเรท: 3.5 (1 บาท = 3.5 Robux) หรือ 4 (1 บาท = 4 Robux)',
        category: 'roblox',
        categoryLabel: '🎮 Roblox Robux',
        type: 'select',
        options: ['3.5', '4'],
        required: false,
        order: 1,
        default: '3.5',
      },
      'ROBUX_NOTIFY_CHANNEL': {
        label: '🔔 ช่องแจ้งเตือน Payout',
        description: 'ID ของช่อง Discord สำหรับแจ้งเตือนเมื่อ Payout สำเร็จ/ล้มเหลว',
        category: 'roblox',
        categoryLabel: '🎮 Roblox Robux',
        type: 'channel',
        required: false,
        order: 2,
      },
      'ROBUX_PAYOUT_COOLDOWN': {
        label: '⏱️ Cooldown (วินาที)',
        description: 'เวลารอระหว่างการ Payout แต่ละครั้ง (ป้องกัน rate limit)',
        category: 'roblox',
        categoryLabel: '🎮 Roblox Robux',
        type: 'number',
        required: false,
        order: 3,
        default: 5,
      },
    };
  }

  // ดึง field definition โดยชื่อ
  static getField(key) {
    const schema = this.getSchema();
    return schema[key] || null;
  }

  // ดึง all config ตามที่กำหนด ใน schema
  static getConfigStatus() {
    const schema = this.getSchema();
    const data = this.loadAll();
    const result = {};

    for (const [key, field] of Object.entries(schema)) {
      const value = this.get(key);
      const envKey = this._keyToEnv(key);
      const fromEnv = !!process.env[envKey];

      result[key] = {
        label: field.label,
        description: field.description,
        category: field.category,
        categoryLabel: field.categoryLabel,
        type: field.type,
        order: field.order || 999,
        value: field.type === 'secret' ? (value ? '✓ ตั้งค่าแล้ว' : '✗ ยังไม่ได้ตั้ง') : value,
        required: field.required,
        configured: !!value,
        fromEnv,
      };
    }

    return result;
  }

  // จัดกลุ่ม config ตาม category
  static getConfigByCategory() {
    const status = this.getConfigStatus();
    const grouped = {};

    for (const [key, info] of Object.entries(status)) {
      const category = info.category || 'other';
      if (!grouped[category]) {
        grouped[category] = {
          label: info.categoryLabel || 'อื่นๆ',
          items: [],
        };
      }
      grouped[category].items.push({ key, ...info });
    }

    // Sort items within each category by order
    for (const category of Object.keys(grouped)) {
      grouped[category].items.sort((a, b) => a.order - b.order);
    }

    return grouped;
  }
}

module.exports = ConfigManager;
