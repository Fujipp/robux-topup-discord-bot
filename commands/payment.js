// commands/payment.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const { getGroupInfo, getGroupFunds, getGroupConfigs } = require("../api/roblox");

const refreshIntervals = new Map();
const paymentGroupSelections = new Map();
const SELECTION_TTL_MS = 10 * 60 * 1000; // 10 นาที
const robuxCache = new Map();

function resolveGroupKey(preferredKey, groupConfigs) {
  if (!groupConfigs?.list?.length) return null;
  if (preferredKey && groupConfigs.map?.[preferredKey]) return preferredKey;
  if (groupConfigs.defaultKey && groupConfigs.map?.[groupConfigs.defaultKey]) {
    return groupConfigs.defaultKey;
  }
  return groupConfigs.list[0].key;
}

function setSelectedGroup(messageId, groupKey) {
  if (!messageId || !groupKey) return;
  paymentGroupSelections.set(messageId, { key: groupKey, ts: Date.now() });
}

function getSelectedGroup(messageId) {
  const entry = paymentGroupSelections.get(messageId);
  if (!entry) return null;
  if (Date.now() - entry.ts > SELECTION_TTL_MS) {
    paymentGroupSelections.delete(messageId);
    return null;
  }
  return entry.key || null;
}

/**
 * ดึงข้อมูล Roblox Groups ทั้งหมด (รองรับหลายกลุ่ม)
 */
async function fetchAllRobloxGroupData() {
  try {
    const groupConfigs = getGroupConfigs();
    if (!groupConfigs?.list?.length) return [];

    const results = await Promise.all(groupConfigs.list.map(async (group) => {
      const options = { groupKey: group.key };
      const [groupResult, fundsResult] = await Promise.all([
        getGroupInfo(options),
        getGroupFunds(options),
      ]);

      let robux = 0;
      if (fundsResult.ok && Number.isFinite(fundsResult.robux)) {
        robux = fundsResult.robux;
        robuxCache.set(group.key, { value: robux, ts: Date.now() });
      } else if (robuxCache.has(group.key)) {
        robux = robuxCache.get(group.key).value;
      }

      return {
        groupKey: group.key,
        groupId: groupResult.ok ? groupResult.data?.id : (group.groupId || group.key),
        name: groupResult.ok ? groupResult.data?.name : (group.name || `Group ${group.groupId || group.key}`),
        robux,
      };
    }));

    return results;
  } catch (err) {
    console.error('[Roblox] Error fetching group data:', err.message);
    return [];
  }
}

/**
 * สร้าง Embed สำหรับ Payment
 */
function buildPaymentEmbed(groups) {
  const imageUrl = "https://img5.pic.in.th/file/secure-sv1/Roblox_Rate3.5.png";
  const numberEmojis = [
    { id: "1465109778371182846", name: "emj_no_01" },
    { id: "1465109782078689310", name: "emj_no_02" },
    { id: "1465109784335355998", name: "emj_no_03" },
  ];

  const fields = (groups || []).slice(0, 3).map((group, index) => {
    const label = "Robux กลุ่ม";
    const emoji = numberEmojis[index];
    const emojiText = emoji ? ` <:${emoji.name}:${emoji.id}>` : "";
    return {
      name: `${label}${emojiText}`,
      value: `\`\`\`${Number(group.robux || 0).toLocaleString()}\`\`\``,
      inline: true,
    };
  });

  const description = [
    "> <:Ts_5_discord_book:1397694174488297552> คู่มือการใช้งาน",
    "```เลือกกลุ่มที่ต้องการซื้อก่อน | กดเติมเงิน | กดซื้อสินค้า ```",
    "> <:Ts_12_discord_abane:1397694204863315998> หมายเหตุ",
    "```เติมเงินให้เพียงพอ ก่อนซื้อแพ็คที่ต้องการ```",
  ].join("\n");

  return new EmbedBuilder()
    .setColor(15902662)
    .setTitle("❥・ 　Roblox Auto 24 hrs.")
    .setDescription(description)
    .setImage(imageUrl)
    .addFields(fields);
}

/**
 * สร้าง Rows สำหรับ Payment (รองรับหลายกลุ่ม)
 */
function buildGroupSelectRow(groupConfigs, groups, selectedKey) {
  if (!groupConfigs?.list?.length || groupConfigs.list.length < 2) return null;

  const numberEmojis = [
    { id: "1465109778371182846", name: "emj_no_01" },
    { id: "1465109782078689310", name: "emj_no_02" },
    { id: "1465109784335355998", name: "emj_no_03" },
  ];

  const groupDataByKey = new Map((groups || []).map((group) => [group.groupKey, group]));

  const options = groupConfigs.list.slice(0, 25).map((group, index) => {
    const data = groupDataByKey.get(group.key);
    const emoji = numberEmojis[index];
    return {
      label: String(group.name || `Robux กลุ่ม ${index + 1}`),
      value: String(group.key),
      description: `ยอดคงเหลือ ${Number(data?.robux || 0).toLocaleString()}`,
      emoji: emoji ? { id: emoji.id, name: emoji.name } : undefined,
      default: group.key === selectedKey,
    };
  });

  options.push({
    label: "รีโหลดตัวเลือก",
    value: "reload",
    emoji: { id: "1397892630729461841", name: "Ts_22_discord_3loading", animated: true },
  });

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("payment_group_select")
      .setPlaceholder("เลือกกลุ่มที่ต้องการซื้อ")
      .addOptions(options)
  );
}

function buildPaymentComponents(group, groupConfigs, selectedKey, groups, showGroupLink = false) {
  const rows = [];
  const selectRow = buildGroupSelectRow(groupConfigs, groups, selectedKey);
  if (selectRow) rows.push(selectRow);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('buy_topup')
      .setLabel('เติมเงิน')
      .setEmoji('<:Ts_0_discord_bank:1398972893416914965>')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('roblox_check')
      .setLabel('ซื้อสินค้า')
      .setEmoji('<:Ts_20_discord_shop:1397694256067514622>')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('chack_topup')
      .setLabel('เช็คยอดเงิน')
      .setEmoji('<:Ts_19_discord_coin:1397694253676630066>')
      .setStyle(ButtonStyle.Primary)
  );

  if (showGroupLink && group?.groupId) {
    row1.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('ลิ้งกลุ่ม')
        .setEmoji('<:Icon_Square_roblox_1:1397902874809204767>')
        .setURL(`https://www.roblox.com/groups/${group.groupId}`)
    );
  }

  rows.push(row1);
  return rows;
}

async function buildPaymentPayload(groupKey = null, opts = {}) {
  const { explicitSelection = false } = opts;
  const groupConfigs = getGroupConfigs();
  const resolvedKey = resolveGroupKey(groupKey, groupConfigs);
  const groups = await fetchAllRobloxGroupData();
  if (!groups.length) return null;

  const selected = groups.find((g) => g.groupKey === resolvedKey) || groups[0];
  const embed = buildPaymentEmbed(groups);
  const menuSelectedKey = explicitSelection ? (resolvedKey || selected.groupKey) : null;
  const components = buildPaymentComponents(
    selected,
    groupConfigs,
    menuSelectedKey,
    groups,
    explicitSelection
  );
  return { embed, components, groupKey: resolvedKey || selected.groupKey, group: selected, groups };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("payment")
    .setDescription("ส่ง embed สำหรับจ่ายเงินไปที่ห้อง (ไม่ใส่ channelId = ส่งในห้องนี้)")
    .addStringOption(o => o.setName("channelid").setDescription("ID ห้องปลายทาง").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const channelId = interaction.options.getString("channelid") || interaction.channelId;
    const channel = client.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased?.()) {
      return interaction.editReply("❌ ไม่พบห้องปลายทางหรือส่งข้อความไม่ได้");
    }

    const payload = await buildPaymentPayload(null, { explicitSelection: false });
    if (!payload) {
      // Fallback - ถ้าดึงข้อมูลไม่ได้
      const embed = new EmbedBuilder()
        .setColor('#EFFCFF')
        .setTitle('<:Icon_Square_roblox_1:1397902874809204767> ระบบตรวจสอบสิทธิ์รับ Robux')
        .setDescription('❌ ไม่สามารถดึงข้อมูลกลุ่มได้ กรุณาลองใหม่ภายหลัง')
        .setFooter({ text: '© discord.gg/snowwhite | All Rights Reserved.' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('buy_topup')
          .setLabel('เติมเงิน')
          .setEmoji('<:Ts_19_discord_coin:1397694253676630066>')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('chack_topup')
          .setLabel('เช็คยอดเงิน')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('roblox_check')
          .setLabel('ซื้อ Robux')
          .setEmoji('<:Ts_20_discord_shop:1397694256067514622>')
          .setStyle(ButtonStyle.Primary)
      );

      await channel.send({ embeds: [embed], components: [row] });
      return interaction.editReply(`✅ ส่ง embed ไปที่ <#${channelId}> แล้ว`);
    }

    // สร้างและส่ง embed
    const sentMessage = await channel.send({
      embeds: [payload.embed],
      components: payload.components,
    });
    // ตั้ง auto-refresh ทุก 10 วินาที
    const REFRESH_INTERVAL = 10000; // 10 วินาที

    const intervalId = setInterval(async () => {
      try {
        // ตรวจสอบว่า message ยังอยู่หรือไม่
        const msg = await channel.messages.fetch(sentMessage.id).catch(() => null);
        if (!msg) {
          // Message ถูกลบแล้ว - หยุด refresh
          clearInterval(intervalId);
          refreshIntervals.delete(sentMessage.id);
          paymentGroupSelections.delete(sentMessage.id);
          console.log(`[Payment] Stopped refresh for deleted message ${sentMessage.id}`);
          return;
        }

        const selectedKey = getSelectedGroup(sentMessage.id);
        const explicitSelection = !!selectedKey;
        const refreshed = await buildPaymentPayload(
          selectedKey || payload.groupKey,
          { explicitSelection }
        );
        if (!refreshed) return;

        await msg.edit({
          embeds: [refreshed.embed],
          components: refreshed.components,
        });
        console.log(`[Payment] Refreshed Robux (${refreshed.groupKey}): ${refreshed.group?.robux ?? 0}`);
      } catch (err) {
        console.error('[Payment] Auto-refresh error:', err.message);
        // ถ้า error ซ้ำ ๆ ให้หยุด
        if (err.message.includes('Unknown Message') || err.message.includes('Missing Access')) {
          clearInterval(intervalId);
          refreshIntervals.delete(sentMessage.id);
          paymentGroupSelections.delete(sentMessage.id);
        }
      }
    }, REFRESH_INTERVAL);

    // เก็บ interval ID
    refreshIntervals.set(sentMessage.id, intervalId);

    await interaction.editReply(`✅ ส่ง embed ไปที่ <#${channelId}> แล้ว (อัพเดททุก 10 วินาที)`);
  },
  buildPaymentPayload,
  resolveGroupKey,
  setSelectedGroup,
  getSelectedGroup,
  paymentGroupSelections,
  refreshIntervals,
};
