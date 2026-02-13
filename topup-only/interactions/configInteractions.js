// interactions/configInteractions.js
// จัดการปุ่ม/modal/select menu สำหรับ config
const {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const ConfigManager = require("../utils/configManager");
const ConfigEmbed = require("../utils/configEmbed");

// Modal builders
function createBankModal() {
  const modal = new ModalBuilder()
    .setCustomId("topup_modal_bank")
    .setTitle("⚙️ ตั้งค่า SlipOK");

  const branchIdInput = new TextInputBuilder()
    .setCustomId("slipok_branch_id")
    .setLabel("🆔 Branch ID")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("52931")
    .setValue(ConfigManager.get("SLIPOK_BRANCH_ID") || "");

  const apiKeyInput = new TextInputBuilder()
    .setCustomId("slipok_api_key")
    .setLabel("🔑 API Key")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("SLIPOK...")
    .setValue(ConfigManager.get("API_SLIPOK_KEY") || "");

  const ppPhoneInput = new TextInputBuilder()
    .setCustomId("promptpay_phone")
    .setLabel("📱 เบอร์ PromptPay")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("0612345678")
    .setValue(ConfigManager.get("เบอร์รับเงินพ้อมเพย์") || "");

  const minAmtInput = new TextInputBuilder()
    .setCustomId("min_amount_bank")
    .setLabel("💵 จำนวนต่ำสุดที่เติมได้ (บาท)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("5")
    .setValue(ConfigManager.get("เติมเงินขั้นต่ำของธนาคาร") || "");

  modal.addComponents(
    new ActionRowBuilder().addComponents(branchIdInput),
    new ActionRowBuilder().addComponents(apiKeyInput),
    new ActionRowBuilder().addComponents(ppPhoneInput),
    new ActionRowBuilder().addComponents(minAmtInput)
  );

  return modal;
}

function createWalletModal() {
  const modal = new ModalBuilder()
    .setCustomId("topup_modal_wallet")
    .setTitle("🧧 ตั้งค่า TrueMoney");

  const phoneInput = new TextInputBuilder()
    .setCustomId("wallet_phone")
    .setLabel("📱 เบอร์ TrueMoney Wallet")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("0648525074")
    .setValue(ConfigManager.get("เบอร์รับเงินวอเลท") || "");

  const keyIdInput = new TextInputBuilder()
    .setCustomId("wallet_key_id")
    .setLabel("🔑 API Key ID")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("ak_live_...")
    .setValue(ConfigManager.get("API_TRUEMONEY_KEY_ID") || "");

  const baseUrlInput = new TextInputBuilder()
    .setCustomId("wallet_base_url")
    .setLabel("🌐 Base URL (optional)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("https://true-wallet-...")
    .setValue(ConfigManager.get("TRUEMONEY_BASE") || "")
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(phoneInput),
    new ActionRowBuilder().addComponents(keyIdInput),
    new ActionRowBuilder().addComponents(baseUrlInput)
  );

  return modal;
}

function createChannelModal() {
  const modal = new ModalBuilder()
    .setCustomId("channel_modal_bank")
    .setTitle("📢 ตั้งค่าช่อง/ยศ");

  const inputs = [
    {
      customId: "channel_check",
      label: "📝 Channel ID เช็คสลิป",
      placeholder: "1234567890",
      key: "ไอดีช่องเช็คสลิป",
    },
    {
      customId: "channel_notify",
      label: "📢 Channel ID แจ้งเตือน",
      placeholder: "1234567890",
      key: "ไอดีช่องแจ้งเตือนเติมเงิน",
    },
    {
      customId: "check_slipid",
      label: "👑 Role ID เช็คสลิป",
      placeholder: "1234567890",
      key: "ยศไอดีเช็คสลิป",
    },
    {
      customId: "role_success",
      label: "🎖️ Role ID สมาชิก",
      placeholder: "1234567890",
      key: "ไอดียศได้รับเมื่อเติมเงิน",
    },
  ];

  for (const input of inputs) {
    const textInput = new TextInputBuilder()
      .setCustomId(input.customId)
      .setLabel(input.label)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(input.placeholder)
      .setValue(ConfigManager.get(input.key) || "");

    modal.addComponents(new ActionRowBuilder().addComponents(textInput));
  }

  return modal;
}

function createAllowedUsersModal() {
  const modal = new ModalBuilder()
    .setCustomId("allowed_users_modal")
    .setTitle("🛂 กำหนดผู้ใช้ที่ใช้คำสั่งได้");

  const rawValue = ConfigManager.get("allowedUserIds") ?? ConfigManager.get("ไอดีผู้ใช้งานที่ใช้คำสั่งได้") ?? "";
  const currentValue = Array.isArray(rawValue)
    ? rawValue.join("\n")
    : String(rawValue || "");

  const allowedUsersInput = new TextInputBuilder()
    .setCustomId("allowed_users_list")
    .setLabel("รายการ User ID (คั่นด้วย , หรือบรรทัดใหม่)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("123,456\n789")
    .setRequired(false)
    .setValue(currentValue);

  modal.addComponents(new ActionRowBuilder().addComponents(allowedUsersInput));

  return modal;
}

module.exports = {
  name: "interactionCreate",
  async execute(_client, interaction) {
    try {
      // === BUTTON INTERACTIONS ===
      if (interaction.isButton()) {
        const customId = interaction.customId;

        // Modal handlers (เปิด modal)
        // หมายเหตุ: update_modals.js จัดการ customId เก่า (setting_topup)
        // ส่วนนี้จัดการ customId ใหม่ (modal_topup_bank)
        if (customId === "modal_topup_bank") {
          await interaction.showModal(createBankModal());
          return;
        }

        if (customId === "modal_topup_wallet") {
          await interaction.showModal(createWalletModal());
          return;
        }

        if (customId === "modal_channel_bank") {
          await interaction.showModal(createChannelModal());
          return;
        }

        if (customId === "modal_allowed_users") {
          await interaction.showModal(createAllowedUsersModal());
          return;
        }

        if (customId === "view_all_config") {
          const embed = ConfigEmbed.buildStatusEmbed();
          
          // เพิ่ม select menu สำหรับดูแยกหมวดหมู่
          const categorySelect = new StringSelectMenuBuilder()
            .setCustomId("view_category")
            .setPlaceholder("📂 ดูการตั้งค่าแยกตามหมวดหมู่")
            .addOptions([
              {
                label: "SlipOK (ธนาคาร/QR)",
                description: "ดูการตั้งค่า SlipOK",
                emoji: "🏦",
                value: "slipok",
              },
              {
                label: "TrueMoney Wallet",
                description: "ดูการตั้งค่า TrueMoney",
                emoji: "🧧",
                value: "truemoney",
              },
              {
                label: "Discord Channels",
                description: "ดูการตั้งค่าช่อง",
                emoji: "📢",
                value: "channels",
              },
              {
                label: "Discord Roles",
                description: "ดูการตั้งค่ายศ",
                emoji: "👥",
                value: "roles",
              },
              {
                label: "ตั้งค่าระบบ",
                description: "ดูการตั้งค่าทั่วไป",
                emoji: "⚙️",
                value: "system",
              },
            ]);

          await interaction.reply({
            embeds: [embed],
            components: [
              new ActionRowBuilder().addComponents(categorySelect),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (customId === "reset_config") {
          await interaction.deferReply({ ephemeral: true });
          // ขอยืนยัน
          const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("confirm_reset")
              .setLabel("✅ ยืนยันการรีเซ็ต")
              .setStyle("Danger"),
            new ButtonBuilder()
              .setCustomId("cancel_reset")
              .setLabel("❌ ยกเลิก")
              .setStyle("Secondary")
          );

          await interaction.editReply({
            content: "⚠️ คุณแน่ใจว่าต้องการรีเซ็ตการตั้งค่าทั้งหมดหรือ?",
            components: [confirmRow],
          });
          return;
        }

        if (customId === "confirm_reset") {
          ConfigManager.saveAll({});
          const embed = ConfigEmbed.buildErrorEmbed("✅ รีเซ็ตการตั้งค่าเรียบร้อย");
          await interaction.update({
            embeds: [embed],
            components: [],
          });
          return;
        }

        if (customId === "cancel_reset") {
          await interaction.update({
            content: "❌ ยกเลิกการรีเซ็ต",
            components: [],
          });
          return;
        }
      }

      // === MODAL SUBMIT ===
      if (interaction.isModalSubmit()) {
        if (interaction.customId === "allowed_users_modal") {
          const rawInput = interaction.fields.getTextInputValue("allowed_users_list") || "";
          
          // Parse comma-separated or newline-separated IDs
          const userIds = rawInput
            .split(/[,\n]+/)
            .map(id => id.trim())
            .filter(id => /^\d+$/.test(id)); // ยอมรับแค่ตัวเลข
          
          // บันทึกลง ConfigManager ทั้งสองคีย์
          ConfigManager.set("allowedUserIds", userIds);
          ConfigManager.set("ไอดีผู้ใช้งานที่ใช้คำสั่งได้", userIds);
          
          const summary = userIds.length === 0 
            ? "ไม่มีผู้ใช้ที่จำกัด" 
            : `${userIds.length} คน: ${userIds.join(", ")}`;
          
          return interaction.reply({
            content: `✅ บันทึกผู้ใช้ที่ใช้คำสั่งได้แล้ว\n📝 รายการ: ${summary}`,
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      // === SELECT MENU ===
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === "refresh_config") {
          await interaction.deferUpdate();
          const embed = ConfigEmbed.buildStatusEmbed();
          
          const selectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("refresh_config")
              .setPlaceholder("🔄 รีเฟชร์สถานะการตั้งค่า")
              .addOptions([{ label: "รีเฟชร์ดูการอัปเดต", emoji: "🔄", value: "setup" }])
          );

          const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("modal_topup_bank")
              .setLabel("🏦 ตั้งค่า SlipOK")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("modal_topup_wallet")
              .setLabel("🧧 ตั้งค่า TrueMoney")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("modal_channel_bank")
              .setLabel("🆔 ตั้งค่าช่อง/ยศ")
              .setStyle(ButtonStyle.Success)
          );

          const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("modal_allowed_users")
              .setLabel("🛂 กำหนดผู้ใช้ที่สั่งได้")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("view_all_config")
              .setLabel("📋 ดูทั้งหมด")
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId("reset_config")
              .setLabel("🔄 รีเซ็ต")
              .setStyle(ButtonStyle.Secondary)
          );

          await interaction.editReply({
            embeds: [embed],
            components: [selectRow, row1, row2],
          });
          return;
        }

        if (interaction.customId === "view_category") {
          await interaction.deferReply({ ephemeral: true });
          const categoryKey = interaction.values[0];
          const embed = ConfigEmbed.buildCategoryEmbed(categoryKey);
          
          await interaction.editReply({
            embeds: [embed],
          });
          return;
        }
      }
    } catch (err) {
      console.error("configInteractions error:", err);
      if (interaction.isRepliable?.()) {
        const embed = ConfigEmbed.buildErrorEmbed(
          `❌ เกิดข้อผิดพลาด: ${err.message}`
        );
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => {});
        } else {
          await interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
        }
      }
    }
  },
};
