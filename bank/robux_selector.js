// bank/robux_selector.js
// Handler สำหรับปุ่ม "เช็คสิทธิ์รับ Robux" พร้อม Modal กรอก username, ยืนยันการซื้อ, queue และ notification
const fs = require("fs");
const path = require("path");
const {
    EmbedBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const ConfigManager = require("../utils/configManager");
const { getBalance, hasTopupHistory, getTopupHistory, deductBalance } = require("./base");
const {
    checkRobloxEligibility,
    makeOneTimePayout,
    getUserAvatarUrl,
    getGroupFunds,
    getGroupConfigs,
} = require("../api/roblox");
const payment = require("../commands/payment");

const COLOR = 3618621;
const COLOR_NORMAL = 15902662;
const COLOR_ERROR = 16222858;
const ERROR_IMAGE = "https://www.animatedimages.org/data/media/562/animated-line-image-0378.gif";

// ===== Payout Stats Tracking =====
const STATS_PATH = path.resolve(process.cwd(), "update/payout_stats.json");

function loadPayoutStats() {
    try {
        if (fs.existsSync(STATS_PATH)) {
            return JSON.parse(fs.readFileSync(STATS_PATH, "utf8"));
        }
    } catch (e) { }
    return { totalRobux: 0, payoutCount: 0 };
}

function savePayoutStats(stats) {
    try {
        fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
    } catch (e) {
        console.error("[Stats] Failed to save:", e);
    }
}

function recordPayoutStats(robuxAmount) {
    const stats = loadPayoutStats();
    stats.totalRobux = (stats.totalRobux || 0) + robuxAmount;
    stats.payoutCount = (stats.payoutCount || 0) + 1;
    savePayoutStats(stats);
    return stats;
}

// Export สำหรับ payment.js
module.exports.getPayoutStats = loadPayoutStats;

function tsReadable(date = new Date()) {
    return new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(date);
}

function buildLoadingEmbed(text = "กำลังตรวจสอบข้อมูล", avatarUrl) {
    const description = "\n" + [
        "> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด",
        `\`\`\`${text}\`\`\``,
    ].join("\n");

    const embed = new EmbedBuilder()
        .setColor(COLOR_NORMAL)
        .setTitle("<a:Ts_22_discord_3loading:1397892630729461841> กำลังประมวลผล")
        .setDescription(description);
    if (avatarUrl) embed.setThumbnail(avatarUrl);
    return embed;
}

function buildErrorEmbed({ reason, robloxUsername, timestamp, avatarUrl } = {}) {
    const description = [
        "> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด",
        `\`\`\`${reason || "เกิดข้อผิดพลาด"}\`\`\``,
        "> <:Ts_9_discord_member:1397694189575344298> : Roblox Username",
        `\`\`\`${robloxUsername || "-"}\`\`\``,
        "> <:Ts_10_discord_Clock:1397694191429095675> : วันที่และเวลาทำรายการ",
        `\`\`\`${timestamp || tsReadable()}\`\`\``,
    ].join("\n");

    const embed = new EmbedBuilder()
        .setColor(COLOR_ERROR)
        .setTitle("<:Ts_12_discord_bbane:1397694208969543720> เกิดข้อผิดพลาด")
        .setDescription(description)
        .setImage(ERROR_IMAGE);
    if (avatarUrl) embed.setThumbnail(avatarUrl);
    return embed;
}

// ===== Fixed Packages สำหรับแต่ละเรท =====
const PACKAGES_RATE_3_5 = [
    { robux: 200, price: 58 },
    { robux: 300, price: 86 },
    { robux: 350, price: 100 },
    { robux: 400, price: 115 },
    { robux: 500, price: 143 },
    { robux: 600, price: 172 },
    { robux: 800, price: 229 },
    { robux: 1000, price: 286 },
    { robux: 1200, price: 343 },
    { robux: 1400, price: 400 },
    { robux: 1600, price: 455 },
    { robux: 2000, price: 570 },
    { robux: 3000, price: 855 },
    { robux: 4000, price: 1140 },
    { robux: 5000, price: 1425 },
    { robux: 7000, price: 2000 },
    { robux: 10000, price: 2850 },
    { robux: 20000, price: 5700 },
];

const PACKAGES_RATE_4 = [
    { robux: 200, price: 50 },
    { robux: 300, price: 75 },
    { robux: 400, price: 100 },
    { robux: 500, price: 125 },
    { robux: 600, price: 150 },
    { robux: 800, price: 200 },
    { robux: 1200, price: 300 },
    { robux: 1400, price: 350 },
    { robux: 1600, price: 400 },
    { robux: 2000, price: 500 },
    { robux: 3000, price: 750 },
    { robux: 4000, price: 1000 },
    { robux: 5000, price: 1250 },
    { robux: 7000, price: 1750 },
    { robux: 10000, price: 2500 },
    { robux: 20000, price: 4900 },
];

// ===== Payout Queue System =====
const payoutQueue = [];
let isProcessingQueue = false;

/**
 * เพิ่ม payout เข้า queue
 */
function addToQueue(payoutData) {
    payoutQueue.push(payoutData);
    processQueue();
}

/**
 * ประมวลผล queue
 */
async function processQueue() {
    if (isProcessingQueue || payoutQueue.length === 0) return;

    isProcessingQueue = true;
    const cooldown = Number(ConfigManager.get('ROBUX_PAYOUT_COOLDOWN', 5)) * 1000;

    while (payoutQueue.length > 0) {
        const payout = payoutQueue.shift();
        try {
            await processPayout(payout);
        } catch (err) {
            console.error('[PayoutQueue] Error processing payout:', err);
        }

        // Cooldown ระหว่าง payout
        if (payoutQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, cooldown));
        }
    }

    isProcessingQueue = false;
}

/**
 * ประมวลผล payout จริง
 */
async function processPayout(payoutData) {
    const { interaction, purchaseId, robloxUserId, pkg, discordUserId, groupKey, client } = payoutData;

    try {
        // ทำ Payout
        const payoutResult = await makeOneTimePayout(
            robloxUserId,
            pkg.robux,
            groupKey ? { groupKey } : null
        );

        const avatarUrl = interaction.user?.displayAvatarURL() || '';
        const username = interaction.user?.username || 'Unknown';
        const newBalance = Number(await getBalance(discordUserId));

        if (!payoutResult.ok) {
            // Payout ล้มเหลว - คืนเงิน (เพราะหักไปแล้วตอน confirm)
            console.log(`[Payout] Failed for ${username}, refunding ${pkg.price} baht`);
            const { addBalance } = require('./base');
            await addBalance(discordUserId, pkg.price);

            await sendNotification(client, {
                success: false,
                username,
                robloxUserId,
                robux: pkg.robux,
                price: pkg.price,
                error: payoutResult.error?.message || 'Unknown error',
            });
            return;
        }

        // Payout สำเร็จ - เงินหักไปแล้วตอน confirm
        recordPayoutStats(pkg.robux); // บันทึกสถิติ

        await sendNotification(client, {
            success: true,
            username,
            robloxUserId,
            robux: pkg.robux,
            price: pkg.price,
            newBalance,
        });

    } catch (err) {
        console.error('[PayoutQueue] processPayout error:', err);
    }
}

/**
 * ส่งแจ้งเตือนไปช่องที่กำหนด (พร้อม Roblox Avatar)
 */
async function sendNotification(client, data) {
    const channelId = ConfigManager.get('ROBUX_NOTIFY_CHANNEL');
    if (!channelId || !client) return;

    try {
        const channel = client.channels.cache.get(String(channelId));
        if (!channel?.isTextBased?.()) return;

        // ดึง Roblox Avatar
        let avatarUrl = null;
        if (data.robloxUserId) {
            const avatarResult = await getUserAvatarUrl(data.robloxUserId);
            if (avatarResult.ok) {
                avatarUrl = avatarResult.avatarUrl;
            }
        }

        const embed = new EmbedBuilder();
        if (avatarUrl) {
            embed.setThumbnail(avatarUrl);
        }

        if (data.success) {
            const description = [
                "> <:Ts_9_discord_member:1397694189575344298> : Discord Username",
                `\`\`\`${data.username}\`\`\``,
                "> <:Ts_7_discord_id:1397694178846310520> : Roblox ID",
                `\`\`\`${data.robloxUserId}\`\`\``,
                "> <:Icon_Square_robux_1:1397902872146083861> : Robux",
                `\`\`\`${data.robux} R$\`\`\``,
                "> <:Ts_19_discord_coin:1397694253676630066> : ราคา",
                `\`\`\`${data.price} บาท\`\`\``,
                "> <:Ts_10_discord_Clock:1397694191429095675> : วันที่และเวลาทำรายการ",
                `\`\`\`${tsReadable()}\`\`\``,
            ].join("\n");

            embed
                .setColor(15902662)
                .setTitle("<:Ts_22_discord_1ture:1397892606209429584> ทำรายการสำเร็จ")
                .setDescription(description)
                .setImage("https://pixelsafari.neocities.org/dividers/more/cat8.gif");
        } else {
            const description = [
                "> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด",
                `\`\`\`${data.error || "เกิดข้อผิดพลาด"}\`\`\``,
                "> <:Ts_9_discord_member:1397694189575344298> : Discord Username",
                `\`\`\`${data.username || "-"}\`\`\``,
                "> <:Ts_7_discord_id:1397694178846310520> : Roblox ID",
                `\`\`\`${data.robloxUserId || "-"}\`\`\``,
                "> <:Ts_10_discord_Clock:1397694191429095675> : วันที่และเวลาทำรายการ",
                `\`\`\`${tsReadable()}\`\`\``,
            ].join("\n");

            embed
                .setColor(COLOR_ERROR)
                .setTitle("<:Ts_12_discord_bbane:1397694208969543720> เกิดข้อผิดพลาด")
                .setDescription(description)
                .setImage(ERROR_IMAGE);
        }

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[Notification] Failed to send:', err);
    }
}

/**
 * ดึง Robux packages ตามเรทที่เลือก
 */
function getRobuxPackages() {
    const rate = String(ConfigManager.get('ROBUX_RATE', '3.5'));

    if (rate === '4') {
        return PACKAGES_RATE_4.map(pkg => ({
            ...pkg,
            label: `${pkg.robux} Robux`,
        }));
    }

    // Default: rate 3.5
    return PACKAGES_RATE_3_5.map(pkg => ({
        ...pkg,
        label: `${pkg.robux} Robux`,
    }));
}

/**
 * สร้าง Modal สำหรับกรอก Roblox username
 */
function createUsernameModal(group) {
    const groupKey = group?.key ? String(group.key) : '';
    const groupLabel = group?.name ? ` (${group.name})` : '';
    return new ModalBuilder()
        .setCustomId(groupKey ? `roblox_username_modal:${groupKey}` : 'roblox_username_modal')
        .setTitle(`เช็คสิทธิ์รับ Robux${groupLabel}`.slice(0, 45))
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('roblox_username_input')
                    .setLabel('🎮 กรอก Username Roblox ของคุณ')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('เช่น builderman')
                    .setRequired(true)
                    .setMinLength(3)
                    .setMaxLength(20)
            )
        );
}

function getRobloxGroups() {
    return getGroupConfigs().list || [];
}

function getGroupByKey(groupKey) {
    const groups = getGroupConfigs();
    return groups.map?.[groupKey] || groups.list?.find((group) => group.key === groupKey) || null;
}

function getDefaultGroup() {
    const groups = getGroupConfigs();
    const key = groups.defaultKey || groups.list?.[0]?.key;
    if (!key) return null;
    return groups.map?.[key] || groups.list?.find((group) => group.key === key) || null;
}

// Cache สำหรับเก็บข้อมูล pending purchase
const pendingPurchases = new Map();

module.exports = {
    name: "interactionCreate",
    async execute(client, interaction) {
        try {
            // ===== Handle button click: roblox_check - แสดง Modal =====
            if (interaction.isButton() && interaction.customId === "roblox_check") {
                // ตรวจสอบว่าระบบ Robux เปิดอยู่หรือไม่
                const isEnabled = ConfigManager.get('ROBUX_ENABLED');
                if (isEnabled === false || isEnabled === 'false') {
                    return interaction.reply({
                        embeds: [buildErrorEmbed({
                            reason: "ขณะนี้ระบบเติม Robux ปิดให้บริการชั่วคราว กรุณาติดต่อ Admin หากมีข้อสงสัย",
                            avatarUrl: interaction.user.displayAvatarURL(),
                        })],
                        flags: MessageFlags.Ephemeral,
                    });
                }
                const groups = getRobloxGroups();
                if (groups.length === 0) {
                    return interaction.reply({
                        embeds: [buildErrorEmbed({
                            reason: "ยังไม่ได้ตั้งค่า Roblox Group สำหรับระบบ Robux",
                            avatarUrl: interaction.user.displayAvatarURL(),
                        })],
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const selectedKey = payment.getSelectedGroup(interaction.message?.id);
                const selectedGroup = selectedKey ? getGroupByKey(selectedKey) : null;
                const defaultGroup = selectedGroup || getDefaultGroup();
                if (!defaultGroup) {
                    return interaction.reply({
                        embeds: [buildErrorEmbed({
                            reason: "ไม่พบกลุ่ม Roblox ที่ตั้งค่าไว้",
                            avatarUrl: interaction.user.displayAvatarURL(),
                        })],
                        flags: MessageFlags.Ephemeral,
                    });
                }
                return interaction.showModal(createUsernameModal(defaultGroup));
            }

            // ===== Handle select menu: roblox_group_select =====
            if (interaction.isStringSelectMenu() && interaction.customId === "roblox_group_select") {
                const groupKey = interaction.values?.[0];
                const group = getGroupByKey(groupKey);
                if (!group) {
                    return interaction.reply({
                        embeds: [buildErrorEmbed({
                            reason: "ไม่พบกลุ่มที่เลือก",
                            avatarUrl: interaction.user.displayAvatarURL(),
                        })],
                        flags: MessageFlags.Ephemeral,
                    });
                }
                return interaction.showModal(createUsernameModal(group));
            }

            // ===== Handle Modal Submit: roblox_username_modal =====
            if (interaction.isModalSubmit() && interaction.customId.startsWith("roblox_username_modal")) {
                const groupKey = interaction.customId.split(":")[1] || null;
                const selectedGroup = groupKey ? getGroupByKey(groupKey) : null;
                const username = interaction.fields.getTextInputValue('roblox_username_input').trim();
                const avatarUrl = interaction.user.displayAvatarURL();

                await interaction.reply({
                    embeds: [buildLoadingEmbed("กำลังตรวจสอบข้อมูล", avatarUrl)],
                    flags: MessageFlags.Ephemeral,
                });

                const result = await checkRobloxEligibility(username, groupKey ? { groupKey } : null);

                if (!result.ok || !result.eligible) {
                    return interaction.editReply({
                        embeds: [buildErrorEmbed({
                            reason: result.message || "ไม่สามารถตรวจสอบสิทธิ์ได้",
                            robloxUsername: username,
                            avatarUrl,
                        })],
                    });
                }

                // ดึงยอด Robux ในกลุ่มเพื่อเช็คว่าพอไหม
                const fundsResult = await getGroupFunds(groupKey ? { groupKey } : null);
                const groupRobux = fundsResult.ok ? fundsResult.robux : 0;

                // มีสิทธิ์ - แสดง packages (จำกัดแค่ 25 options)
                const packages = getRobuxPackages().slice(0, 25);
                const balance = Number(await getBalance(interaction.user.id));
                const rate = String(ConfigManager.get('ROBUX_RATE', '3.5'));

                const options = packages.map((pkg, index) => {
                    const canAfford = balance >= pkg.price;
                    const groupHasEnough = groupRobux >= pkg.robux;
                    const canSelect = canAfford && groupHasEnough;

                    let description = '';
                    if (!groupHasEnough) {
                        description = '❌ ยอดในกลุ่มไม่พอ';
                    } else if (!canAfford) {
                        description = '❌ ยอดเงินไม่พอ';
                    } else {
                        description = '✅';
                    }

                    return {
                        label: `${pkg.robux} Robux (${pkg.price} บาท)`,
                        value: `robux_pkg:${index}:${result.userId}:${groupKey || 'default'}:${encodeURIComponent(result.username)}`,
                        description: description,
                        emoji: { id: "1397902872146083861", name: "Icon_Square_robux_1" },
                        default: false,
                    };
                });

                // Filter out options where group doesn't have enough (disabled = not in list)
                const selectableOptions = options.filter((opt, index) => {
                    const pkg = packages[index];
                    return groupRobux >= pkg.robux;
                });

                const successEmbed = new EmbedBuilder()
                    .setColor(9107360)
                    .setTitle('<:Ts_22_discord_1ture:1397892606209429584> สามารถซื้อ Robux ได้แล้ว')
                    .setDescription(
                        `> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด \n\`\`\`${result.message}\`\`\`\n` +
                        `> <:Ts_9_discord_member:1397694189575344298> : Roblox Username\n\`\`\`${result.username}\`\`\`\n` +
                        `> <:Ts_19_discord_coin:1397694253676630066> : ยอดคงเหลือ\n\`\`\`${balance.toFixed(2)} บาท\`\`\`\n` +
                        `> <:Ts_19_discord_coin:1397694253676630066> : เรทปัจจุบัน\n\`\`\`1 บาท = ${rate} Robux\`\`\`\n` +
                        `> <:Icon_Square_robux_1:1397902872146083861> : Robux ในกลุ่ม\n\`\`\`${groupRobux.toLocaleString()} R$\`\`\`\n` +
                        `> <:Ts_7_discord_id:1397694178846310520> : กลุ่มที่เลือก\n\`\`\`${selectedGroup?.name || "-"}\`\`\`\n`
                    )
                    .setThumbnail(avatarUrl)
                    .setImage("https://www.animatedimages.org/data/media/562/animated-line-image-0388.gif")
                    .setFields();

                // ถ้าไม่มี package ที่เลือกได้เลย
                if (selectableOptions.length === 0) {
                    return interaction.editReply({
                        embeds: [buildErrorEmbed({
                            reason: "ขณะนี้ยอด Robux ในกลุ่มไม่เพียงพอสำหรับทุก Package กรุณารอสักครู่แล้วลองใหม่อีกครั้ง",
                            robloxUsername: result.username,
                            avatarUrl,
                        })],
                        components: [],
                    });
                }

                const selectRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("robux_package_select")
                        .setPlaceholder("🎮 เลือก Robux Package")
                        .addOptions(selectableOptions)
                );

                return interaction.editReply({ embeds: [successEmbed], components: [selectRow] });
            }

            // ===== Handle select menu: robux_package_select =====
            if (interaction.isStringSelectMenu() && interaction.customId === "robux_package_select") {
                const selected = interaction.values?.[0];
                if (!selected?.startsWith('robux_pkg:')) return;

                const parts = selected.split(':');
                const pkgIndex = parseInt(parts[1], 10);
                const robloxUserId = parts[2] || null;
                const groupKey = parts[3] || 'default';
                const robloxUsername = parts[4] ? decodeURIComponent(parts[4]) : null;

                const packages = getRobuxPackages();
                const pkg = packages[pkgIndex];

                if (!pkg) {
                    return interaction.reply({
                        embeds: [buildErrorEmbed({
                            reason: "ไม่พบ package ที่เลือก",
                            avatarUrl: interaction.user.displayAvatarURL(),
                        })],
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const balance = Number(await getBalance(interaction.user.id));
                const avatarUrl = interaction.user.displayAvatarURL();
                const selectedGroup = getGroupByKey(groupKey);

                if (balance < pkg.price) {
                    return interaction.reply({
                        embeds: [buildErrorEmbed({
                            reason: `ยอดเงินไม่เพียงพอ (ขาดอีก ${(pkg.price - balance).toFixed(2)} บาท)`,
                            avatarUrl,
                        })],
                        flags: MessageFlags.Ephemeral,
                    });
                }

                // เก็บ pending purchase
                const purchaseId = `${interaction.user.id}_${Date.now()}`;
                pendingPurchases.set(purchaseId, {
                    discordUserId: interaction.user.id,
                    robloxUserId,
                    robloxUsername,
                    pkg,
                    balance,
                    groupKey,
                    timestamp: Date.now(),
                });

                // ลบ pending เก่า (หมดอายุ 5 นาที)
                for (const [key, val] of pendingPurchases.entries()) {
                    if (Date.now() - val.timestamp > 5 * 60 * 1000) pendingPurchases.delete(key);
                }

                const confirmEmbed = new EmbedBuilder()
                    .setColor(16247178)
                    .setTitle("<:Icon_Square_robux_1:1397902872146083861>  ยืนยันการซื้อ Robux")
                    .setDescription(
                        `> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด \n\`\`\`ตรวจสอบข้อมูลก่อนยืนยัน\`\`\`\n` +
                        `> <:Ts_7_discord_id:1397694178846310520> : Roblox ID\n\`\`\`${robloxUserId || "N/A"}\`\`\`\n` +
                        `> <:Ts_12_discord_abane:1397694204863315998> : เงื่อนไขการใช้บริการ\n\`\`\`เมื่อกดยืนยัน ระบบจะหักเงินและโอน Robux ทันที\`\`\``
                    )
                    .setThumbnail(avatarUrl)
                    .addFields(
                        { name: "<:Icon_Square_robux_1:1397902872146083861> : Package", value: `\`\`\`${pkg.robux}\`\`\``, inline: true },
                        { name: "<:Ts_19_discord_coin:1397694253676630066> : ราคา", value: `\`\`\`${pkg.price} บาท\`\`\``, inline: true },
                        { name: "<:Ts_19_discord_coin:1397694253676630066> : ยอดเงินหลังการซื้อ", value: `\`\`\`${(balance - pkg.price).toFixed(2)} บาท\`\`\``, inline: false }
                    );

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`confirm_robux_${purchaseId}`).setEmoji('<:Ts_22_discord_1ture:1397892606209429584>').setLabel('ยืนยัน').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel_robux_purchase').setEmoji('<:Ts_22_discord_1false:1397892604040974479>').setLabel('ยกเลิก').setStyle(ButtonStyle.Danger)
                );

                return interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], flags: MessageFlags.Ephemeral });
            }

            // ===== Handle confirm button =====
            if (interaction.isButton() && interaction.customId.startsWith('confirm_robux_')) {
                const purchaseId = interaction.customId.replace('confirm_robux_', '');
                const purchase = pendingPurchases.get(purchaseId);

                if (!purchase || purchase.discordUserId !== interaction.user.id) {
                    return interaction.update({
                        content: null,
                        embeds: [buildErrorEmbed({
                            reason: "รายการหมดอายุหรือไม่พบ",
                            avatarUrl: interaction.user.displayAvatarURL(),
                        })],
                        components: [],
                    });
                }

                const balance = Number(await getBalance(interaction.user.id));
                if (balance < purchase.pkg.price) {
                    pendingPurchases.delete(purchaseId);
                    return interaction.update({
                        content: null,
                        embeds: [buildErrorEmbed({
                            reason: "ยอดเงินไม่พอ กรุณาเติมเงินก่อน",
                            robloxUsername: purchase.robloxUsername,
                            avatarUrl: interaction.user.displayAvatarURL(),
                        })],
                        components: [],
                    });
                }

                // อัพเดทข้อความเป็น embed กำลังดำเนินการ
                await interaction.update({
                    content: null,
                    embeds: [buildLoadingEmbed("กำลังดำเนินการ...", interaction.user.displayAvatarURL())],
                    components: [],
                });

                // หักเงินก่อน แล้วเพิ่มเข้า queue
                const deducted = await deductBalance(interaction.user.id, purchase.pkg.price);
                if (!deducted) {
                    return interaction.editReply({
                        content: null,
                        embeds: [buildErrorEmbed({
                            reason: "ไม่สามารถหักเงินได้",
                            robloxUsername: purchase.robloxUsername,
                            avatarUrl: interaction.user.displayAvatarURL(),
                        })],
                    });
                }

                const newBalance = Number(await getBalance(interaction.user.id));
                pendingPurchases.delete(purchaseId);

                // เพิ่มเข้า queue
                addToQueue({
                    interaction,
                    purchaseId,
                    robloxUserId: purchase.robloxUserId,
                    pkg: purchase.pkg,
                    discordUserId: interaction.user.id,
                    groupKey: purchase.groupKey,
                    client,
                });

                const queuePos = payoutQueue.length;
                const successEmbed = new EmbedBuilder()
                    .setColor(9107360)
                    .setTitle('<:Ts_22_discord_1ture:1397892606209429584> กำลังดำเนินการ...')
                    .setDescription(
                        `> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด \n\`\`\`หักเงินเรียบร้อย! กำลังโอน Robux... (คิว #${queuePos})\`\`\`\n` +
                        `> <:Icon_Square_robux_1:1397902872146083861> : Robux\n\`\`\`${purchase.pkg.robux} R$\`\`\`\n` +
                        `> <:Ts_19_discord_coin:1397694253676630066> : ราคา\n\`\`\`${purchase.pkg.price} บาท\`\`\`\n` +
                        `> <:Ts_19_discord_coin:1397694253676630066> : ยอดคงเหลือ\n\`\`\`${newBalance.toFixed(2)} บาท\`\`\`\n`
                    )
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .setImage("https://www.animatedimages.org/data/media/562/animated-line-image-0388.gif")
                    .setFields();

                // ลบข้อความเดิมหลังจากแสดงผลสำเร็จ (5 วินาที)
                setTimeout(async () => {
                    try {
                        await interaction.deleteReply();
                    } catch (e) { }
                }, 5000);

                return interaction.editReply({ embeds: [successEmbed], components: [] });
            }

            // ===== Handle cancel button =====
            if (interaction.isButton() && interaction.customId === 'cancel_robux_purchase') {
                // ลบข้อความยืนยัน
                return interaction.update({
                    content: null,
                    embeds: [buildErrorEmbed({
                        reason: "ยกเลิกการซื้อ Robux แล้ว",
                        avatarUrl: interaction.user.displayAvatarURL(),
                    })],
                    components: [],
                });
            }

        } catch (e) {
            console.error("robux_selector error:", e);
        }
    }
};
