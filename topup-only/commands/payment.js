// commands/payment.js
// ส่ง Embed สำหรับระบบเติมเงิน (SlipOK + TrueMoney Wallet)

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

/**
 * สร้าง Embed สำหรับ Payment
 */
function buildPaymentEmbed() {
  const description = [
    "> <:Ts_5_discord_book:1397694174488297552> คู่มือการใช้งาน",
    "```กดปุ่ม เติมเงิน เพื่อเลือกช่องทางเติมเงิน | กดปุ่ม เช็คยอด เพื่อดูยอดคงเหลือ```",
    "",
    "> <:Ts_0_discord_bank:1398972893416914965> ช่องทางเติมเงิน",
    "```• พร้อมเพย์ธนาคาร (QR Code + SlipOK)```",
    "```• ซองอั่งเปา TrueMoney Wallet```",
    "",
    "> <:Ts_12_discord_abane:1397694204863315998> หมายเหตุ",
    "```• เติมผ่านซอง TrueMoney หัก 5 บาท/ซอง```",
    "```• เติมผ่าน QR ไม่มีค่าธรรมเนียม```",
  ].join("\n");

  return new EmbedBuilder()
    .setColor(15902662)
    .setTitle("<:Ts_19_discord_coin:1397694253676630066> ระบบเติมเงินอัตโนมัติ")
    .setDescription(description)
    .setImage("https://www.animatedimages.org/data/media/562/animated-line-image-0388.gif")
    .setFooter({ text: "© Top-up System | เติมเงินอัตโนมัติ 24 ชั่วโมง" })
    .setTimestamp();
}

/**
 * สร้าง Components (ปุ่ม) สำหรับ Payment
 */
function buildPaymentComponents() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("buy_topup")
      .setLabel("เติมเงิน")
      .setEmoji("<:Ts_0_discord_bank:1398972893416914965>")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("chack_topup")
      .setLabel("เช็คยอดเงิน")
      .setEmoji("<:Ts_19_discord_coin:1397694253676630066>")
      .setStyle(ButtonStyle.Secondary),
  );

  return [row];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("payment")
    .setDescription("ส่ง embed ระบบเติมเงินไปที่ห้อง")
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("ช่องที่จะส่ง (ไม่ใส่ = ส่งในห้องนี้)")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    // หาช่องที่จะส่ง
    const targetChannel =
      interaction.options.getChannel("channel") || interaction.channel;

    // ตรวจสอบว่าส่งข้อความได้
    if (!targetChannel || !targetChannel.isTextBased?.()) {
      return interaction.editReply("❌ ไม่พบห้องปลายทางหรือส่งข้อความไม่ได้");
    }

    // ตรวจสอบสิทธิ์ส่งข้อความ
    const permissions = targetChannel.permissionsFor(client.user);
    if (!permissions?.has("SendMessages")) {
      return interaction.editReply(
        `❌ บอทไม่มีสิทธิ์ส่งข้อความในห้อง <#${targetChannel.id}>`,
      );
    }

    try {
      // สร้าง embed และ components
      const embed = buildPaymentEmbed();
      const components = buildPaymentComponents();

      // ส่งไปยังห้องเป้าหมาย
      await targetChannel.send({
        embeds: [embed],
        components: components,
      });

      await interaction.editReply(
        `✅ ส่ง embed ระบบเติมเงินไปที่ <#${targetChannel.id}> แล้ว`,
      );
    } catch (err) {
      console.error("Payment command error:", err);
      await interaction.editReply(`❌ เกิดข้อผิดพลาด: ${err.message}`);
    }
  },
};
