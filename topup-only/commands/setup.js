// commands/setup.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const ConfigManager = require("../utils/configManager");
const ConfigEmbed = require("../utils/configEmbed");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("เปิดหน้าตั้งค่าระบบหลังบ้าน")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    // กัน timeout 3 วิ
    await interaction.deferReply({ ephemeral: true });

    const embed = ConfigEmbed.buildStatusEmbed();

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("refresh_config")
        .setPlaceholder("🔄 รีเฟชร์สถานะการตั้งค่า")
        .addOptions([{ label: "รีเฟชร์ดูการอัปเดต", emoji: "🔄", value: "setup" }])
    );

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("modal_topup_bank").setLabel("🏦 ตั้งค่า SlipOK").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("modal_topup_wallet").setLabel("🧧 ตั้งค่า TrueMoney").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("modal_channel_bank").setLabel("🆔 ตั้งค่าช่อง/ยศ").setStyle(ButtonStyle.Success),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("modal_allowed_users").setLabel("🛂 กำหนดผู้ใช้ที่สั่งได้").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("view_all_config").setLabel("📋 ดูการตั้งค่าทั้งหมด").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("reset_config").setLabel("🔄 รีเซ็ต").setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({
      embeds: [embed],
      components: [selectRow, row1, row2],
      flags: MessageFlags.Ephemeral,
    });
  }
};
