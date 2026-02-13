// bank/wallet.js (patched → handler เดียว)
const fs = require("fs");
const path = require("path");
const { addBalance, recordTopup } = require("./base");
const { META_API } = require("../api/truemoney");
const {
  TextInputBuilder, ActionRowBuilder, ModalBuilder, TextInputStyle,
  EmbedBuilder, MessageFlags
} = require("discord.js");
const ConfigManager = require("../utils/configManager");

function readLog() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "../update/logdata.json"), "utf8")); }
  catch { return {}; }
}

const COLOR_NORMAL = 15902662;
const COLOR_ERROR = 16222858;
const COLOR_SUCCESS = 9107360;

function tsDiscord(date = new Date()) {
  const unix = Math.floor(date.getTime() / 1000);
  return `<t:${unix}:f>`;
}

function tsReadable(date = new Date()) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function openWalletModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("wallet_modal")
    .setTitle("เติมเงินด้วยซองอั่งเปา")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("codeInput")
          .setLabel("🧧 กรอกลิงก์ซองอั่งเปา")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("https://gift.truemoney.com/campaign/?v=xxxxxxxxxxxxxxx")
          .setRequired(true)
      )
    );
  return interaction.showModal(modal);
}

/* ===== Embed templates (UI) ===== */
const buildLoading = (avatar, text = "กำลังตรวจสอบซองอั่งเปา...") => {
  const description = [
    "> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด",
    `\`\`\`${text}\`\`\``,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLOR_NORMAL)
    .setTitle("<a:Ts_22_discord_3loading:1397892630729461841> กำลังประมวลผล")
    .setDescription(description)
    .setThumbnail(avatar);
};

const buildSuccess = ({ username, avatar, amount, after, method, timestamp }) => {
  const total = Number(after || 0).toFixed(2);
  const description = [
    "> <:Ts_9_discord_member:1397694189575344298> : คนทำรายการ",
    `\`\`\`${username}\`\`\``,
    "> <:Ts_19_discord_coin:1397694253676630066> : จำนวณเงินที่เติม",
    `\`\`\`${amount.toFixed(2)}\`\`\``,
    "> <:Ts_19_discord_coin:1397694253676630066> : ยอดทั้งหมดที่มี",
    `\`\`\`${total}\`\`\``,
    "> <:Ts_0_discord_bank:1398972893416914965> : ช่องทางการเติม",
    `\`\`\`${method}\`\`\``,
    "> <:Ts_10_discord_Clock:1397694191429095675> : วันที่และเวลาทำรายการ",
    `\`\`\`${timestamp}\`\`\``,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLOR_SUCCESS)
    .setTitle("<:Ts_22_discord_1ture:1397892606209429584> เติมเงินสำเร็จ")
    .setDescription(description)
    .setThumbnail(avatar)
    .setImage("https://www.animatedimages.org/data/media/562/animated-line-image-0388.gif");
};

const buildFail = ({ avatar, reason, timestamp }) => {
  const description = [
    "> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด",
    `\`\`\`${reason}\`\`\``,
    "> <:Ts_10_discord_Clock:1397694191429095675> : วันที่และเวลาทำรายการ",
    `\`\`\`${timestamp}\`\`\``,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLOR_ERROR)
    .setTitle("<:Ts_22_discord_1false:1397892604040974479> เติมเงินไม่สำเร็จ")
    .setDescription(description)
    .setThumbnail(avatar)
    .setImage("https://www.animatedimages.org/data/media/562/animated-line-image-0378.gif");
};

const buildFatal = ({ avatar, reason }) => {
  const description = [
    "> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด",
    `\`\`\`${reason}\`\`\``,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLOR_ERROR)
    .setTitle("<:Ts_12_discord_abane:1397694204863315998> เกิดข้อผิดพลาด")
    .setDescription(description)
    .setThumbnail(avatar)
    .setImage("https://www.animatedimages.org/data/media/562/animated-line-image-0378.gif");
};

module.exports = {
  name: "interactionCreate",
  async execute(_client, interaction) {
    /* Trigger เปิด modal */
    try {
      const isClosed = !!readLog()?.เมนูระบบใช้งานธนาคาร; // true = ปิดธนาคาร → เปิด Wallet ตรงๆ
      if (interaction.isButton() && interaction.customId === "buy_topup" && isClosed) {
        return openWalletModal(interaction);
      }
      if (interaction.isStringSelectMenu() && interaction.customId === "teram_topup") {
        const choice = interaction.values?.[0];
        if (choice === "เติมวอเลต") return openWalletModal(interaction);
      }
    } catch (e) { console.error("wallet trigger error:", e); }

    /* Modal submit → โหลด → ยิง API → แสดงผล */
    if (!(interaction.isModalSubmit() && interaction.customId === "wallet_modal")) return;

    const failReply = async (embed) => {
      if (interaction.deferred || interaction.replied) return interaction.editReply({ embeds: [embed] });
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    };

    try {
      const avatar = interaction.user.displayAvatarURL();
      const username = interaction.user.username;

      // ส่ง “กำลังประมวลผล” ก่อน (Ephemeral)
      await interaction.reply({
        embeds: [buildLoading(avatar, "กำลังตรวจสอบซองอั่งเปา...")],
        flags: MessageFlags.Ephemeral,
      });

      const url = interaction.fields.getTextInputValue("codeInput").trim();
      if (!/^https:\/\/gift\.truemoney\.com\/campaign\/\?v=/.test(url)) {
        return failReply(buildFail({
          avatar,
          reason: "กรุณากรอกลิงก์ซองอั่งเปาให้ถูกต้อง (ต้องขึ้นต้นด้วย https://gift.truemoney.com/campaign/?v= )",
          timestamp: tsReadable(),
        }));
      }

      const s = readLog();
      // อ่านจาก .env ก่อน ถ้าไม่มีจึงอ่านจาก logdata.json (backward compatible)
      const phone = String(process.env.TRUEMONEY_PHONE || s?.เบอร์รับเงินวอเลท || "").replace(/\D/g, "");
      if (phone.length !== 10) {
        return failReply(buildFatal({ avatar, reason: "ยังไม่ได้ตั้งค่าเบอร์รับเงิน TrueMoney Wallet (ต้องมี 10 หลัก)" }));
      }

      const res = await META_API(url, phone);

      // แสดงข้อความสำหรับผู้ใช้เท่านั้น (ไม่โชว์รายละเอียดหลังบ้าน)
      if (!res.ok) {
        // map เหตุผลให้อ่านง่าย
        let reason = "ไม่สามารถแลกซองอั่งเปาได้ในขณะนี้ กรุณาตรวจสอบว่าลิงก์ถูกต้อง ซองยังไม่ถูกใช้ และยังไม่หมดอายุ";
        const msg = String(res?.error?.message || "").toLowerCase();
        if (msg.includes("expired")) reason = "ซองอั่งเปาหมดอายุแล้ว";
        else if (msg.includes("used") || msg.includes("redeemed")) reason = "ซองอั่งเปานี้ถูกใช้ไปแล้ว";
        else if (msg.includes("invalid")) reason = "ลิงก์ซองอั่งเปาไม่ถูกต้อง";
        else if (msg.includes("quota")) reason = "ซองอั่งเปาเกินโควต้าหรือมีปัญหาการใช้งาน";
        else if (msg.includes("insufficient")) reason = "ยอดในซองไม่เพียงพอ";
        else if (msg.includes("maintenance")) reason = "ระบบกำลังปิดปรับปรุง ชั่วคราว";

        return interaction.editReply({
          embeds: [buildFail({ avatar, reason, timestamp: tsReadable() })],
          components: [],
        });
      }

      const payload = res.data || {};
      const rawAmount = Number(payload.amount || 0);
      if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
        return interaction.editReply({
          embeds: [buildFail({ avatar, reason: "ตอบกลับไม่พบจำนวนเงินที่เติม", timestamp: tsReadable() })],
          components: [],
        });
      }

      // หักค่าธรรมเนียม TrueMoney (ค่า default 5 บาท)
      const truemoneyFee = Number(ConfigManager.get('TRUEMONEY_FEE', 5)) || 5;
      const amount = Math.max(0, rawAmount - truemoneyFee);

      console.log(`[TrueMoney] Raw: ${rawAmount}, Fee: ${truemoneyFee}, Net: ${amount}`);

      if (amount <= 0) {
        return interaction.editReply({
          embeds: [buildFail({
            avatar,
            reason: `ยอดเงินหลังหักค่าธรรมเนียม ${truemoneyFee} บาท ไม่เพียงพอ`,
            timestamp: tsReadable(),
          })],
          components: [],
        });
      }

      const after = await addBalance(interaction.user.id, amount);
      const tsText = tsReadable();

      // บันทึกประวัติการเติมเงิน (สำหรับ 2-layer protection)
      await recordTopup(interaction.user.id, amount, "TrueMoney");

      // แสดงผลสำเร็จ (Ephemeral)
      const successEmbed = buildSuccess({
        username, avatar, amount, after,
        method: "Wallet (TrueMoney)",
        timestamp: tsText,
      });

      await interaction.editReply({ embeds: [successEmbed], components: [] });

      // แจ้งห้อง notify (ถ้าตั้ง)
      const notifyId = s?.ไอดีช่องแจ้งเตือนเติมเงิน || "";
      if (notifyId) {
        const ch = interaction.guild.channels.cache.get(String(notifyId));
        if (ch?.isTextBased?.() || ch?.send) {
          await ch.send({
            embeds: [
              buildSuccess({
                username, avatar, amount, after,
                method: "Wallet (TrueMoney)",
                timestamp: tsText,
              })
            ],
            // optional: กัน ping
            // allowedMentions: { users: [] },
          });
        }
      }

    } catch (e) {
      console.error("wallet handler error:", e);
      return failReply(buildFatal({ avatar: interaction.user.displayAvatarURL(), reason: "เกิดข้อผิดพลาดไม่คาดคิด กรุณาลองใหม่อีกครั้ง" }));
    }
  }
};
