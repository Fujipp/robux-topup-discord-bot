// update/submit_update.js
// Modal submit handlers for configuration (Top-up Only - No Roblox)

const fs = require("fs");
const path = require("path");
const { MessageFlags } = require("discord.js");
const ConfigManager = require("../utils/configManager");

const SAVE_PATH = path.resolve(__dirname, "./logdata.json");
const truthy = (v) => v !== undefined && v !== null && String(v).trim() !== "";
const load = () => {
  try {
    return JSON.parse(fs.readFileSync(SAVE_PATH, "utf8"));
  } catch {
    return {};
  }
};
const save = (o) => fs.writeFileSync(SAVE_PATH, JSON.stringify(o, null, 2));

module.exports = {
  name: "interactionCreate",
  async execute(_client, interaction) {
    try {
      if (!interaction.isModalSubmit()) return;
      const data = load();

      // 1) SlipOK (ธนาคาร/พร้อมเพย์)
      if (interaction.customId === "topup_modal_bank") {
        let branchId = interaction.fields.getTextInputValue("slipok_branch_id");
        const slipokKey =
          interaction.fields.getTextInputValue("slipok_api_key");
        const ppPhone = interaction.fields.getTextInputValue("promptpay_phone");
        const minAmt = interaction.fields.getTextInputValue("min_amount_bank");

        // sanitize: รับได้ทั้ง "12345" หรือ "https://.../apikey/12345"
        if (truthy(branchId)) {
          branchId = branchId.trim().replace(/\/+$/, "");
          if (/^https?:\/\//i.test(branchId))
            branchId = branchId.split("/").pop();
          ConfigManager.set("SLIPOK_BRANCH_ID", branchId);
        }
        if (truthy(slipokKey))
          ConfigManager.set("API_SLIPOK_KEY", slipokKey.trim());
        if (truthy(ppPhone))
          ConfigManager.set("เบอร์รับเงินพ้อมเพย์", ppPhone.trim());
        if (truthy(minAmt))
          ConfigManager.set("เติมเงินขั้นต่ำของธนาคาร", minAmt.trim());

        return interaction.reply({
          content: "✅ บันทึกค่าธนาคาร (SlipOK) แล้ว",
          flags: MessageFlags.Ephemeral,
        });
      }

      // 2) TrueMoney Wallet (Voucher)
      if (interaction.customId === "topup_modal_wallet") {
        const walletPhone =
          interaction.fields.getTextInputValue("wallet_phone");
        const walletKeyId =
          interaction.fields.getTextInputValue("wallet_key_id");
        const walletBase =
          interaction.fields.getTextInputValue("wallet_base_url");

        if (truthy(walletPhone))
          ConfigManager.set("เบอร์รับเงินวอเลท", walletPhone.trim());
        if (truthy(walletKeyId))
          ConfigManager.set("API_TRUEMONEY_KEY_ID", walletKeyId.trim());
        if (truthy(walletBase))
          ConfigManager.set("TRUEMONEY_BASE", walletBase.trim());

        return interaction.reply({
          content: "✅ บันทึกค่าบัญชีวอเลต (TrueMoney) แล้ว",
          flags: MessageFlags.Ephemeral,
        });
      }

      // 3) ช่อง/ยศ/เวลา (ธนาคาร)
      if (interaction.customId === "channel_modal_bank") {
        const fields = {
          ไอดีช่องเช็คสลิป: "channel_check",
          ไอดีช่องแจ้งเตือนเติมเงิน: "channel_notify",
          ยศไอดีเช็คสลิป: "check_slipid",
          ไอดียศได้รับเมื่อเติมเงิน: "role_success",
          ปรับกำหนดเวลาเช็คสลิป: "check_sliptime",
        };
        for (const [key, id] of Object.entries(fields)) {
          const v = interaction.fields.getTextInputValue(id);
          if (truthy(v)) ConfigManager.set(key, v.trim());
        }
        return interaction.reply({
          content: "✅ บันทึกช่อง/ยศ/เวลา แล้ว",
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (err) {
      console.error("submit_update error:", err);
      if (
        interaction.isRepliable?.() &&
        !interaction.replied &&
        !interaction.deferred
      ) {
        await interaction
          .reply({
            content: "❌ เกิดข้อผิดพลาด",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
  },
};
