// commands/top.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

// ===== Role IDs =====
// ยศอันดับ
const ROLE_TOP_1_PRIMARY = "1397689928015417344";   // อันดับ 1 เท่านั้น
const ROLE_TOP_10 = "1397689924110520422";          // อันดับ 1-10

// ยศตามยอดสะสม
const MILESTONE_ROLES = [
    { threshold: 10000, roleId: "1468224082054090846" },
    { threshold: 5000, roleId: "1468224091730481344" },
    { threshold: 1000, roleId: "1468224095316611103" },
    { threshold: 500, roleId: "1468224098357350412" },
];

// รวมทุกยศที่ command นี้จัดการ (สำหรับลบออกก่อน reset)
const ALL_MANAGED_ROLES = [
    ROLE_TOP_1_PRIMARY,
    ROLE_TOP_10,
    ...MILESTONE_ROLES.map(m => m.roleId),
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("top")
        .setDescription("รีเซ็ตยศตามลำดับยอดเติมเงินสะสม")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild;

            // ดึง leaderboard จาก database
            const leaderboard = await getTopupLeaderboard(50);

            if (!leaderboard || leaderboard.length === 0) {
                return interaction.editReply("❌ ไม่พบข้อมูล leaderboard");
            }

            // Fetch ทุก members ที่ online หรือ cached
            await guild.members.fetch();

            let updated = 0;
            let errors = [];

            // ลบยศเก่าจากทุกคนที่มียศเหล่านี้ก่อน
            for (const roleId of ALL_MANAGED_ROLES) {
                const role = guild.roles.cache.get(roleId);
                if (!role) continue;

                for (const member of role.members.values()) {
                    try {
                        await member.roles.remove(role);
                    } catch (e) {
                        // ข้ามถ้าลบไม่ได้
                    }
                }
            }

            // แจกยศใหม่ตาม leaderboard
            for (let i = 0; i < leaderboard.length; i++) {
                const entry = leaderboard[i];
                const rank = i + 1;

                try {
                    const member = guild.members.cache.get(entry.discord_user_id);
                    if (!member) continue;

                    const rolesToAdd = [];
                    const totalTopup = Number(entry.total_accumulated_topup) || 0;

                    // ยศอันดับ
                    if (rank === 1) {
                        rolesToAdd.push(ROLE_TOP_1_PRIMARY);
                        rolesToAdd.push(ROLE_TOP_10);
                    } else if (rank <= 10) {
                        rolesToAdd.push(ROLE_TOP_10);
                    }

                    // ยศตามยอดสะสม (เพิ่มทุกยศที่ถึง threshold)
                    for (const milestone of MILESTONE_ROLES) {
                        if (totalTopup >= milestone.threshold) {
                            rolesToAdd.push(milestone.roleId);
                        }
                    }

                    // เพิ่มยศ
                    for (const roleId of rolesToAdd) {
                        const role = guild.roles.cache.get(roleId);
                        if (role && !member.roles.cache.has(roleId)) {
                            await member.roles.add(role);
                        }
                    }

                    if (rolesToAdd.length > 0) updated++;

                } catch (e) {
                    errors.push(`<@${entry.discord_user_id}>: ${e.message}`);
                }
            }

            // สร้าง Embed แสดง Leaderboard
            const top10 = leaderboard.slice(0, 10);
            const leaderboardText = top10.map((entry, i) => {
                const rank = i + 1;
                const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
                const total = Number(entry.total_accumulated_topup || 0).toFixed(2);
                return `${emoji} <@${entry.discord_user_id}> — **${total}** บาท`;
            }).join("\n");

            const embed = new EmbedBuilder()
                .setColor(15902662)
                .setTitle("<:Ts_22_discord_1ture:1397892606209429584> รีเซ็ตยศสำเร็จ")
                .setDescription(
                    `> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด\n\`\`\`อัปเดตยศให้ ${updated} คน\`\`\`\n` +
                    `> <:Ts_14_discord_pointg:1397694229333016647> : Top 10 ยอดเติมสะสม\n${leaderboardText}`
                )
                .setTimestamp();

            if (errors.length > 0) {
                embed.addFields({
                    name: "⚠️ Errors",
                    value: errors.slice(0, 5).join("\n") + (errors.length > 5 ? `\n...และอีก ${errors.length - 5} รายการ` : ""),
                });
            }

            return interaction.editReply({ embeds: [embed] });

        } catch (e) {
            console.error("Top command error:", e);
            return interaction.editReply(`❌ เกิดข้อผิดพลาด: ${e.message}`);
        }
    }
};

// ===== Helper: ดึง leaderboard จาก database =====
async function getTopupLeaderboard(limit = 50) {
    const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();

    if (!DATABASE_URL) {
        // Fallback to JSON storage
        return getTopupLeaderboardFromJson(limit);
    }

    try {
        const { Pool } = require("pg");
        const pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        });

        const PROJECT_ID = String(process.env.PROJECT_ID || "discord-bot-topup").trim();

        const result = await pool.query(
            `SELECT u.discord_user_id, w.total_accumulated_topup
       FROM wallets w
       JOIN users u ON w.user_id = u.id
       WHERE w.project_id = $1 AND w.total_accumulated_topup > 0
       ORDER BY w.total_accumulated_topup DESC
       LIMIT $2`,
            [PROJECT_ID, limit]
        );

        await pool.end();
        return result.rows;

    } catch (e) {
        console.error("getTopupLeaderboard DB error:", e);
        return getTopupLeaderboardFromJson(limit);
    }
}

// ===== Fallback: ดึงจาก JSON =====
function getTopupLeaderboardFromJson(limit = 50) {
    try {
        const fs = require("fs");
        const path = require("path");
        const historyPath = path.resolve(process.cwd(), "data/topup_history.json");

        if (!fs.existsSync(historyPath)) return [];

        const data = JSON.parse(fs.readFileSync(historyPath, "utf8"));

        const entries = Object.entries(data).map(([discordUserId, info]) => ({
            discord_user_id: discordUserId,
            total_accumulated_topup: info?.totalAmount || 0,
        }));

        return entries
            .filter(e => e.total_accumulated_topup > 0)
            .sort((a, b) => b.total_accumulated_topup - a.total_accumulated_topup)
            .slice(0, limit);

    } catch (e) {
        console.error("getTopupLeaderboardFromJson error:", e);
        return [];
    }
}
