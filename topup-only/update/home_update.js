// update/home_update.js
// Config panel refresh handler (Top-up Only - No Roblox)

const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const ConfigManager = require("../utils/configManager");

function getAllowedUserIds() {
  try {
    // อ่านจาก ConfigManager ก่อน
    const configData = ConfigManager.get("allowedUserIds");
    if (configData) {
      return Array.isArray(configData) ? configData : [];
    }

    // Fallback ไปยัง alias key
    const aliasData = ConfigManager.get("ไอดีผู้ใช้งานที่ใช้คำสั่งได้");
    if (aliasData) {
      return Array.isArray(aliasData) ? aliasData : [];
    }

    // Fallback ไปยัง config.json
    const cfg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../config.json"), "utf8"),
    );
    if (Array.isArray(cfg?.allowedUserIds)) return cfg.allowedUserIds;
    if (Array.isArray(cfg?.["ไอดีผู้ใช้งานที่ใช้คำสั่งได้"]))
      return cfg["ไอดีผู้ใช้งานที่ใช้คำสั่งได้"];
    return [];
  } catch {
    return [];
  }
}

function getPanelData() {
  const serverPath = path.resolve(__dirname, "./logdata.json");
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(serverPath, "utf8"));
  } catch {}

  return {
    slipokBranch: data?.SLIPOK_BRANCH_ID || "ยังไม่ได้ตั้ง",
    slipokKey: data?.API_SLIPOK_KEY ? "✅ ตั้งค่าแล้ว" : "❌ ยังไม่ได้ตั้ง",
    ppPhone: data?.เบอร์รับเงินพ้อมเพย์ || "ยังไม่ได้ตั้ง",
    walletPhone: data?.เบอร์รับเงินวอเลท || "ยังไม่ได้ตั้ง",
    walletKey: data?.API_TRUEMONEY_KEY_ID
      ? "✅ ตั้งค่าแล้ว"
      : "❌ ยังไม่ได้ตั้ง",
    checkChannel: data?.ไอดีช่องเช็คสลิป || "ยังไม่ได้ตั้ง",
    notifyChannel: data?.ไอดีช่องแจ้งเตือนเติมเงิน || "ยังไม่ได้ตั้ง",
  };
}

module.exports = {
  name: "interactionCreate",
  async execute(client, interaction) {
    try {
      // จับเฉพาะ select menu refresh เท่านั้น
      const isRefresh =
        interaction.isStringSelectMenu?.() &&
        interaction.customId === "refresh" &&
        interaction.values?.[0] === "setup";
      if (!isRefresh) return;

      const allowed = getAllowedUserIds();
      if (allowed.length && !allowed.includes(interaction.user.id)) {
        return interaction.update({
          content: "``❌ เอ้ะ! คำสั่งสำหรับผู้ที่มีสิทธิ์เท่านั้น ``",
          components: [],
          flags: MessageFlags.Ephemeral,
        });
      }

      const {
        slipokBranch,
        slipokKey,
        ppPhone,
        walletPhone,
        walletKey,
        checkChannel,
        notifyChannel,
      } = getPanelData();

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("⚙️ ตั้งค่าระบบเติมเงิน")
        .setDescription("ระบบเติมเงินอัตโนมัติ (SlipOK + TrueMoney Wallet)")
        .addFields(
          {
            name: "🏦 SlipOK (ธนาคาร/QR)",
            value: `Branch ID: \`${slipokBranch}\`\nAPI Key: ${slipokKey}\nเบอร์พร้อมเพย์: \`${ppPhone}\``,
            inline: true,
          },
          {
            name: "🧧 TrueMoney Wallet",
            value: `เบอร์วอเลท: \`${walletPhone}\`\nAPI Key: ${walletKey}`,
            inline: true,
          },
          {
            name: "📢 ช่องทาง Discord",
            value: `ช่องเช็คสลิป: \`${checkChannel}\`\nช่องแจ้งเตือน: \`${notifyChannel}\``,
            inline: false,
          },
        )
        .setFooter({ text: "กดปุ่มด้านล่างเพื่อตั้งค่า" })
        .setTimestamp();

      const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("refresh")
          .setPlaceholder("🔄 รีเฟชร์หน้าต่าง")
          .addOptions([
            { label: "รีเฟชร์ดูการอัปเดต", emoji: "🔄", value: "setup" },
          ]),
      );

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("setting_topup")
          .setLabel("🏛️ ตั้งค่า SlipOK")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("setting_topup_wallet")
          .setLabel("🧧 ตั้งค่า TrueMoney")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("setting_channel_bank")
          .setLabel("🆔 ตั้งค่าช่อง/ยศ")
          .setStyle(ButtonStyle.Success),
      );

      await interaction.update({
        embeds: [embed],
        components: [selectRow, row1],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("home_update error", error);
    }
  },
};
