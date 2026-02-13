// commands/history.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const {
  recordTopup,
  getTopupHistory,
  updateTopupHistory,
  deleteTopupHistory,
} = require("../bank/base");

function parseTimestamp(raw) {
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function formatEntry(entry, index) {
  const amount = Number(entry?.amount || 0).toFixed(2);
  const method = entry?.method || "Unknown";
  const timestamp = entry?.timestamp || "-";
  return `${index}. ${amount} | ${method} | ${timestamp}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("จัดการประวัติการเติมเงิน")
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("ดูประวัติการเติมเงิน")
        .addUserOption((opt) => opt.setName("user").setDescription("ผู้ใช้").setRequired(true))
        .addIntegerOption((opt) =>
          opt.setName("limit").setDescription("จำนวนรายการที่แสดง (1-50)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("เพิ่มประวัติการเติมเงิน")
        .addUserOption((opt) => opt.setName("user").setDescription("ผู้ใช้").setRequired(true))
        .addNumberOption((opt) => opt.setName("amount").setDescription("จำนวนเงิน").setRequired(true))
        .addStringOption((opt) => opt.setName("method").setDescription("ช่องทางเติมเงิน").setRequired(false))
        .addStringOption((opt) => opt.setName("timestamp").setDescription("เวลา (ISO หรือ YYYY-MM-DD HH:mm)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("update")
        .setDescription("แก้ไขประวัติการเติมเงินตามลำดับล่าสุด")
        .addUserOption((opt) => opt.setName("user").setDescription("ผู้ใช้").setRequired(true))
        .addIntegerOption((opt) => opt.setName("index").setDescription("ลำดับ (ล่าสุด = 1)").setRequired(true))
        .addNumberOption((opt) => opt.setName("amount").setDescription("จำนวนเงินใหม่").setRequired(true))
        .addStringOption((opt) => opt.setName("method").setDescription("ช่องทางเติมเงินใหม่").setRequired(false))
        .addStringOption((opt) => opt.setName("timestamp").setDescription("เวลาใหม่").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("ลบประวัติการเติมเงินตามลำดับล่าสุด")
        .addUserOption((opt) => opt.setName("user").setDescription("ผู้ใช้").setRequired(true))
        .addIntegerOption((opt) => opt.setName("index").setDescription("ลำดับ (ล่าสุด = 1)").setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user");

    if (sub === "list") {
      const rawLimit = interaction.options.getInteger("limit");
      const limit = Math.max(1, Math.min(50, Number(rawLimit) || 10));
      const data = await getTopupHistory(user.id, limit);

      if (!data || !Array.isArray(data.history) || data.history.length === 0) {
        return interaction.editReply(`❌ ไม่พบประวัติของ <@${user.id}>`);
      }

      const history = [...data.history].reverse();
      const lines = history.map((entry, idx) => formatEntry(entry, idx + 1));
      const total = Number(data.totalAmount || 0).toFixed(2);

      return interaction.editReply(
        `📜 ประวัติของ <@${user.id}> (ล่าสุด ${history.length} รายการ)\n` +
          `รวมทั้งหมด: ${data.count || 0} ครั้ง, ${total} THB\n\n` +
          "```\n" +
          lines.join("\n") +
          "\n```"
      );
    }

    if (sub === "add") {
      const amount = interaction.options.getNumber("amount");
      const method = interaction.options.getString("method") || "Unknown";
      const rawTimestamp = interaction.options.getString("timestamp");
      const timestamp = parseTimestamp(rawTimestamp);
      if (rawTimestamp && !timestamp) {
        return interaction.editReply("❌ รูปแบบเวลาผิด ต้องเป็น ISO หรือ YYYY-MM-DD HH:mm");
      }

      const entry = await recordTopup(user.id, amount, method, timestamp);
      return interaction.editReply(
        `✅ เพิ่มประวัติให้ <@${user.id}> แล้ว: ${formatEntry(entry, 1)}`
      );
    }

    if (sub === "update") {
      const index = interaction.options.getInteger("index");
      const amount = interaction.options.getNumber("amount");
      const method = interaction.options.getString("method");
      const rawTimestamp = interaction.options.getString("timestamp");
      const timestamp = parseTimestamp(rawTimestamp);
      if (rawTimestamp && !timestamp) {
        return interaction.editReply("❌ รูปแบบเวลาผิด ต้องเป็น ISO หรือ YYYY-MM-DD HH:mm");
      }

      const result = await updateTopupHistory(user.id, index, amount, method, timestamp);
      if (!result) {
        return interaction.editReply("❌ ไม่พบรายการที่ต้องการแก้ไข");
      }

      return interaction.editReply(
        "✅ แก้ไขเรียบร้อย\n" +
          `ก่อน: ${formatEntry(result.before, index)}\n` +
          `หลัง: ${formatEntry(result.after, index)}`
      );
    }

    if (sub === "delete") {
      const index = interaction.options.getInteger("index");
      const removed = await deleteTopupHistory(user.id, index);
      if (!removed) {
        return interaction.editReply("❌ ไม่พบรายการที่ต้องการลบ");
      }

      return interaction.editReply(`🗑️ ลบรายการ: ${formatEntry(removed, index)}`);
    }

    return interaction.editReply("❌ คำสั่งไม่ถูกต้อง");
  },
};
