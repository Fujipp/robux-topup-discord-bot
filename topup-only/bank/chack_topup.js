// bank/chack_topup.js
const { EmbedBuilder, MessageFlags } = require("discord.js");
const { getBalance, loadBalances } = require("./base");

const COLOR = 15902662; // ตามที่ Dev ระบุ

module.exports = {
  name: "interactionCreate",
  async execute(client, interaction) {
    try {
      if (!interaction.isButton() || interaction.customId !== "chack_topup")
        return;

      const username = interaction.user.username;
      const avatarUrl =
        interaction.user.displayAvatarURL?.() ||
        interaction.user.displayAvatarURL;

      // Embed #1: กำลังโหลดข้อมูล...
      const loadingEmbed = new EmbedBuilder()
        .setTitle(`<:Ts_9_discord_member:1397694189575344298> ${username}`)
        .setDescription(
          `<a:Ts_22_discord_3loading:1397892630729461841> **กำลังโหลดข้อมูล...**`,
        )
        .setColor(COLOR)
        .setThumbnail(avatarUrl);

      await interaction.reply({
        embeds: [loadingEmbed],
        flags: MessageFlags.Ephemeral,
      });

      // โหลดข้อมูลและคำนวณยอด
      await loadBalances();
      const balance = Number(
        (await getBalance(interaction.user.id)) || 0,
      ).toFixed(2);

      // Embed #2: แสดงยอดเงินคงเหลือ
      const resultEmbed = new EmbedBuilder()
        .setTitle(`<:Ts_9_discord_member:1397694189575344298> ${username}`)
        .setDescription(
          `> <:Ts_19_discord_coin:1397694253676630066> : ยอดเงินคงเหลือ \n\`\`\`${balance} THB \`\`\``,
        ) // ตามฟอร์แมตที่ให้มา
        .setColor(COLOR)
        .setThumbnail(avatarUrl)
        .setFields([]); // เผื่อ future fields

      await interaction.editReply({ embeds: [resultEmbed] });
      client.setMaxListeners(15);
    } catch (err) {
      console.error("chack_topup error:", err);
      try {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("❌ ไม่สามารถเช็คยอดได้");
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: [errorEmbed] });
        } else {
          await interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch {}
    }
  },
};
