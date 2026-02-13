// interactions/paymentInteractions.js
const { MessageFlags } = require("discord.js");
const payment = require("../commands/payment");

module.exports = {
  name: "interactionCreate",
  async execute(_client, interaction) {
    try {
      if (!interaction.isStringSelectMenu()) return;
      if (interaction.customId !== "payment_group_select") return;

      const value = interaction.values?.[0] || null;
      const currentSelected = payment.getSelectedGroup(interaction.message.id);
      const explicitSelection = value !== "reload" && !!value;
      const groupKey = value === "reload"
        ? currentSelected
        : value;
      await interaction.deferUpdate();

      const payload = await payment.buildPaymentPayload(groupKey, {
        explicitSelection: explicitSelection || !!currentSelected,
      });
      if (!payload) {
        return interaction.followUp({
          content: "❌ ไม่สามารถโหลดข้อมูลกลุ่มได้",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (explicitSelection) {
        payment.setSelectedGroup(interaction.message.id, payload.groupKey);
      }

      await interaction.editReply({
        embeds: [payload.embed],
        components: payload.components,
      });
    } catch (err) {
      console.error("paymentInteractions error:", err);
      if (interaction.isRepliable?.()) {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "❌ เกิดข้อผิดพลาด", flags: MessageFlags.Ephemeral }).catch(() => {});
        } else {
          await interaction.followUp({ content: "❌ เกิดข้อผิดพลาด", flags: MessageFlags.Ephemeral }).catch(() => {});
        }
      }
    }
  },
};
