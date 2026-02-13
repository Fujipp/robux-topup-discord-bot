// bank/menu_topup.js
const fs = require("fs");
const path = require("path");
const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, MessageFlags } = require("discord.js");

// ✅ อ่านค่าคอนฟิก (ใช้รูปจาก logdata.json ถ้ามี)
function readLog() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "../update/logdata.json"), "utf8")); }
  catch { return {}; }
}

const COLOR = 3618621; // โทนสีที่ Dev ใช้ประจำ (#3758F9 ประมาณนี้)
const COLOR_SELECT = 9090807;
const IMAGE_FALLBACK = "https://www.animatedimages.org/data/media/562/animated-line-image-0124.gif";
const IMAGE_SELECT = "https://pixelsafari.neocities.org/dividers/more/sparkles3.gif";

module.exports = {
  name: "interactionCreate",
  async execute(_client, interaction) {
    try {
      const isClosed = !!readLog()?.เมนูระบบใช้งานธนาคาร; // false=เปิดใช้งาน PromptPay

      if (!isClosed && interaction.isButton() && interaction.customId === "buy_topup") {
        const cfg = readLog();
        const imageUrl = String(cfg?.["ภาพเมนูเติมเงิน"] || IMAGE_SELECT);

        // ✅ ปรับเฉพาะหน้าตา: สี + รูปภาพ (logic เดิมทั้งหมดคงไว้)
        const embed = new EmbedBuilder()
          .setColor(COLOR_SELECT)
          .setTitle("<:Ts_0_discord_bank:1398972893416914965> เลือกช่องทางเติมเงิน")
          .setDescription("\n> <:Ts_12_discord_abane:1397694204863315998> เงื่อนไขการเติมเงิน\n```เติมเงินผ่านซอง Truemoney wallet หัก 5 บาท/ 1 ซอง```")
          .setImage(imageUrl);


        // ⚠️ คง customId / values เดิมทั้งหมดไว้ตามที่ Dev ใช้อยู่
        const select = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("teram_topup")
            .setPlaceholder("กดตรงนี้เพื่อเลือกประเภทช่องทางเติมเงิน")
            .addOptions(
              {
                label: "พร้อมเพย์ธนาคาร",
                value: "เติมสแกนจ่าย",
                description: "สแกน QR เช็คสลิปเงินเข้าทันที",
                emoji: { id: "1397902895390785558", name: "Cash_bank_pp_1", animated: false },
              },
              {
                label: "ซองอั่งเปาวอเลต",
                value: "เติมวอเลต",
                description: "เติมด้วยลิงก์อั่งเปาเงินเข้าทันที",
                emoji: { id: "1397902890672197724", name: "Cash_bank_tn_1", animated: false },
              },
              {
                label: "ล้างตัวเลือกใหม่",
                value: "reset_memubank",
                emoji: { id: "1397892630729461841", name: "Ts_22_discord_3loading", animated: true },
              }
            )
        );

        return interaction.reply({
          embeds: [embed],
          components: [select],
          flags: MessageFlags.Ephemeral, // ให้เห็นเฉพาะผู้กด
        });
      }
    } catch (e) {
      console.error("menu_topup error:", e);
    }
  }
};
