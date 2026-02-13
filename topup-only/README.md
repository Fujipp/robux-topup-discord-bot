# Discord Bot Top-up System

ระบบเติมเงินอัตโนมัติสำหรับ Discord Bot รองรับ SlipOK (QR/ธนาคาร) และ TrueMoney Wallet (ซองอั่งเปา)

## ✨ Features

- 🏦 **SlipOK Integration** - เติมเงินผ่าน QR Code พร้อมเพย์ ตรวจสลิปอัตโนมัติ
- 🧧 **TrueMoney Wallet** - เติมเงินผ่านซองอั่งเปา เงินเข้าทันที
- 💰 **ระบบ Balance** - จัดการยอดเงินผู้ใช้
- 📜 **ประวัติการเติม** - เก็บบันทึกทุกรายการ
- ⚙️ **ตั้งค่าง่าย** - ตั้งค่าผ่าน Discord ได้เลย

## 📦 Installation

```bash
# Clone หรือ copy โฟลเดอร์นี้
cd topup-only

# ติดตั้ง dependencies
npm install

# สร้างไฟล์ .env (copy จาก env.example)
cp env.example .env

# แก้ไขค่าใน .env ตามต้องการ

# Deploy slash commands
npm run deploy

# รันบอท
npm start
```

## ⚙️ Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Discord Bot Token | ✅ |
| `DISCORD_CLIENT_ID` | Discord Application ID | ✅ |
| `DISCORD_GUILD_ID` | Guild ID (สำหรับ dev) | ❌ |
| `PORT` | HTTP Server Port | ❌ (default: 8080) |
| `DATABASE_URL` | PostgreSQL URL | ❌ (ใช้ JSON ถ้าไม่มี) |
| `SLIPOK_BRANCH_ID` | SlipOK Branch ID | ❌ |
| `API_SLIPOK_KEY` | SlipOK API Key | ❌ |
| `TRUEMONEY_PHONE` | เบอร์รับเงิน TrueMoney | ❌ |
| `API_TRUEMONEY_KEY_ID` | TrueMoney API Key | ❌ |

## 📝 Slash Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/setup` | เปิดหน้าตั้งค่าระบบ | Administrator |
| `/payment` | ส่ง embed เติมเงินไปที่ห้อง | Manage Guild |
| `/user add` | เพิ่มเครดิตให้ผู้ใช้ | Manage Guild |
| `/user get` | ดูยอดเงินผู้ใช้ | Manage Guild |
| `/user update` | อัปเดตยอดเงินผู้ใช้ | Manage Guild |
| `/user delete` | ลบข้อมูลผู้ใช้ | Manage Guild |
| `/history list` | ดูประวัติการเติมเงิน | Manage Guild |
| `/history add` | เพิ่มประวัติการเติมเงิน | Manage Guild |
| `/history update` | แก้ไขประวัติ | Manage Guild |
| `/history delete` | ลบประวัติ | Manage Guild |

## 🏗️ Project Structure

```
topup-only/
├── api/                    # External API integrations
│   └── truemoney.js        # TrueMoney Wallet API
├── bank/                   # Payment handlers
│   ├── base.js             # Balance & storage system
│   ├── bank_slipOk.js      # PromptPay QR handler
│   ├── chack_topup.js      # Check balance button
│   ├── check_slip.js       # Slip verification (SlipOK)
│   ├── menu_topup.js       # Top-up menu selection
│   └── wallet.js           # TrueMoney wallet handler
├── commands/               # Slash commands
│   ├── history.js          # /history command
│   ├── payment.js          # /payment command
│   ├── setup.js            # /setup command
│   └── user.js             # /user command
├── data/                   # JSON data storage
├── db/                     # Database schema
│   └── schema.sql          # PostgreSQL schema
├── interactions/           # Button/Modal handlers
│   ├── autocomplete.js     # Autocomplete handlers
│   └── configInteractions.js
├── update/                 # Config panel
│   ├── home_update.js      # Config refresh
│   ├── submit_update.js    # Modal submit
│   ├── update_modals.js    # Modal builders
│   └── logdata.json        # Runtime config
├── utils/                  # Utilities
│   ├── configEmbed.js      # Config embed builder
│   ├── configManager.js    # Config management
│   └── permissions.js      # Permission checks
├── index.js                # Discord bot main
├── server.js               # HTTP server
├── deploy-commands.js      # Deploy slash commands
├── config.json             # Static config
├── package.json
└── env.example             # Environment template
```

## 💾 Data Storage

### JSON Mode (Default)
- ไฟล์ `data/balances.json` - เก็บยอดเงินผู้ใช้
- ไฟล์ `data/topup_history.json` - เก็บประวัติการเติมเงิน

### PostgreSQL Mode
ตั้งค่า `DATABASE_URL` ใน `.env` เพื่อใช้ PostgreSQL
ดู schema ได้ที่ `db/schema.sql`

## 🔧 Configuration

### ผ่าน Discord
1. ใช้คำสั่ง `/setup` เพื่อเปิดหน้าตั้งค่า
2. กดปุ่มเพื่อตั้งค่าแต่ละส่วน

### ผ่าน Environment Variables
ตั้งค่าผ่าน `.env` ไฟล์ (มี priority สูงกว่า config file)

### ผ่าน Config File
แก้ไขไฟล์ `update/logdata.json` โดยตรง

## 🚀 Deployment

### Local Development
```bash
npm run dev  # ใช้ nodemon auto-restart
```

### Production
```bash
npm start
```

### PaaS (Railway/Render/Azure)
- ตั้ง Environment Variables ใน dashboard
- ตั้ง Start Command: `npm start`
- ต้องมี health endpoint `/healthz`

## 📄 License

MIT License

## 🙏 Credits

- [discord.js](https://discord.js.org/) - Discord API library
- [SlipOK](https://slipok.com/) - Slip verification service
- [promptpay-qr](https://www.npmjs.com/package/promptpay-qr) - QR code generator