// utils/permissions.js
// Utility functions สำหรับตรวจสอบสิทธิ์คำสั่ง

const ConfigManager = require('./configManager');

/**
 * อ่าน allowed user IDs จาก ConfigManager (logdata.json) หรือ config.json
 */
function readAllowedUserIds() {
    try {
        // อ่านจาก ConfigManager ก่อน
        const configData = ConfigManager.get("allowedUserIds");
        if (configData) {
            return Array.isArray(configData) ? configData : [];
        }
        
        // Fallback ไปยัง alias key
        const aliasData = ConfigManager.get("ไอดีผู้ใช้งานที่ใช้คำสั่งได้");
        if (aliasData) {
            return Array.isArray(aliasData) ? aliasData : [];
        }
        
        // Fallback ไปยัง config.json (เพื่อความเข้ากันได้เดิม)
        const configFile = require('../config.json');
        if (Array.isArray(configFile?.['ไอดีผู้ใช้งานที่ใช้คำสั่งได้'])) {
            return configFile['ไอดีผู้ใช้งานที่ใช้คำสั่งได้'];
        }
        if (Array.isArray(configFile?.allowedUserIds)) {
            return configFile.allowedUserIds;
        }
    } catch {}
    return [];
}

/**
 * ตรวจสอบว่า user อยู่ใน allowed user list หรือไม่
 * @param {string} userId 
 * @returns {boolean}
 */
function isAllowedUser(userId) {
    const allowedUsers = readAllowedUserIds();
    return allowedUsers.length === 0 || allowedUsers.includes(userId);
}

/**
 * ตรวจสอบว่า member มียศที่อนุญาตหรือไม่
 * @param {GuildMember} member 
 * @param {string} configKey - key ใน config เช่น 'ALLOWED_ROLES_PAYMENT'
 * @returns {boolean}
 */
function hasAllowedRole(member, configKey) {
    const rolesConfig = ConfigManager.get(configKey);
    if (!rolesConfig) return true; // ถ้าไม่ได้ตั้งค่าไว้ = อนุญาตทุกคน

    // แปลง string เป็น array (รองรับ "id1,id2,id3" หรือ "id1, id2, id3")
    const allowedRoles = rolesConfig.split(',').map(r => r.trim()).filter(Boolean);
    if (allowedRoles.length === 0) return true;

    // ตรวจสอบว่า member มี role ใน list หรือไม่
    return member.roles.cache.some(role => allowedRoles.includes(role.id));
}

/**
 * ตรวจสอบสิทธิ์รวม - ผ่านได้ถ้า:
 * 1. เป็น User ที่อนุญาต หรือ
 * 2. มี Role ที่อนุญาต หรือ
 * 3. ไม่ได้ตั้งค่าการจำกัดไว้
 * 
 * @param {Interaction} interaction 
 * @param {string} roleConfigKey - key สำหรับ role config
 * @returns {Promise<boolean>}
 */
async function canExecuteCommand(interaction, roleConfigKey) {
    const userId = interaction.user.id;
    const member = interaction.member;

    // ตรวจสอบ user ID ก่อน
    if (isAllowedUser(userId)) {
        return true;
    }

    // ตรวจสอบ role
    if (member && hasAllowedRole(member, roleConfigKey)) {
        return true;
    }

    return false;
}

module.exports = {
    readAllowedUserIds,
    isAllowedUser,
    hasAllowedRole,
    canExecuteCommand,
};
