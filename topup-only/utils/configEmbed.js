// utils/configEmbed.js
// สร้าง embed สำหรับแสดงผล Config Status
const { EmbedBuilder } = require('discord.js');
const ConfigManager = require('./configManager');

class ConfigEmbed {
  static buildStatusEmbed() {
    const grouped = ConfigManager.getConfigByCategory();
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('⚙️ สถานะการตั้งค่าระบบ')
      .setDescription('ดูการตั้งค่าแบ่งตามหมวดหมู่ • ใช้ปุ่มด้านล่างเพื่อแก้ไข')
      .setTimestamp();

    // กำหนดลำดับการแสดงผล
    const categoryOrder = ['slipok', 'truemoney', 'channels', 'roles', 'system'];

    for (const categoryKey of categoryOrder) {
      const category = grouped[categoryKey];
      if (!category || category.items.length === 0) continue;

      // เพิ่ม section header
      embed.addFields({
        name: `\n${category.label}`,
        value: '─────────────────────────',
        inline: false,
      });

      // เพิ่ม items
      for (const item of category.items) {
        const icon = item.configured ? '✅' : '❌';
        const envTag = item.fromEnv ? ' `[ENV]`' : '';
        
        let displayValue = item.value;
        
        // Format ตามประเภท
        if (item.type === 'secret') {
          displayValue = item.configured 
            ? '●●●●●●●● (ตั้งค่าแล้ว)' 
            : '(ยังไม่ได้ตั้ง)';
        } else if (item.type === 'boolean') {
          displayValue = item.value ? '🟢 เปิดอยู่' : '🔴 ปิดอยู่';
        } else if (item.type === 'list') {
          const list = Array.isArray(item.value)
            ? item.value
            : String(item.value || '')
                .split(/[,\n]/)
                .map(s => s.trim())
                .filter(Boolean);
          if (!list.length) displayValue = '(ยังไม่ได้ตั้ง)';
          else if (list.length <= 3) displayValue = list.join(', ');
          else displayValue = `${list.slice(0,3).join(', ')} … (+${list.length - 3})`;
        } else if (item.type === 'channel' && item.value && item.value.length > 15) {
          displayValue = `<#${item.value}>`;
        } else if (item.type === 'role' && item.value && item.value.length > 15) {
          displayValue = `<@&${item.value}>`;
        } else if (!item.value) {
          displayValue = '(ยังไม่ได้ตั้ง)';
        }

        embed.addFields({
          name: `${icon} ${item.label}${envTag}`,
          value: `\`\`\`${displayValue}\`\`\``,
          inline: true,
        });
      }
    }

    // === Summary ===
    const allItems = Object.values(grouped).flatMap(cat => cat.items);
    const configured = allItems.filter(item => item.configured).length;
    const total = allItems.length;
    const percent = Math.round((configured / total) * 100);

    // Progress bar
    const barLength = 20;
    const filled = Math.round((configured / total) * barLength);
    const empty = barLength - filled;
    const progressBar = '█'.repeat(filled) + '░'.repeat(empty);

    embed.addFields({
      name: '\n📊 ความสมบูรณ์',
      value: `\`${progressBar}\` **${percent}%**\n\`\`\`${configured}/${total} รายการ\`\`\``,
      inline: false,
    });

    embed.setFooter({
      text: 'คลิกปุ่มด้านล่างเพื่อแก้ไขการตั้งค่า',
      iconURL: 'https://cdn.discordapp.com/emojis/1234567890.png',
    });

    return embed;
  }

  // Embed สำหรับแสดงหลังอัพเดต
  static buildUpdateSuccessEmbed(key, oldValue, newValue) {
    const info = ConfigManager.getField(key);
    if (!info) return null;

    const embed = new EmbedBuilder()
      .setColor(0x57f287) // green
      .setTitle('✅ อัพเดตสำเร็จ')
      .setDescription(`**${info.label}** อัพเดตเรียบร้อย`)
      .addFields(
        {
          name: '📝 ค่าเดิม',
          value: `\`\`\`${oldValue || '(ไม่มีค่า)'}\`\`\``,
          inline: false,
        },
        {
          name: '✨ ค่าใหม่',
          value: `\`\`\`${newValue || '(เคลียร์แล้ว)'}\`\`\``,
          inline: false,
        }
      )
      .setTimestamp();

    return embed;
  }

  // Embed สำหรับแสดงข้อผิดพลาด
  static buildErrorEmbed(message) {
    return new EmbedBuilder()
      .setColor(0xed4245) // red
      .setTitle('❌ เกิดข้อผิดพลาด')
      .setDescription(message)
      .setTimestamp();
  }

  // Embed สำหรับแสดงข้อมูลเฉพาะ
  static buildDetailEmbed(key) {
    const status = ConfigManager.getConfigStatus();
    const info = status[key];

    if (!info) {
      return this.buildErrorEmbed('ไม่พบการตั้งค่านี้');
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`ℹ️ ${info.label}`)
      .setDescription(info.description)
      .addFields(
        {
          name: '📊 สถานะ',
          value: info.configured ? '✅ ได้ตั้งค่าแล้ว' : '❌ ยังไม่ได้ตั้ง',
          inline: true,
        },
        {
          name: '📍 ที่มา',
          value: info.fromEnv ? 'Environment Variable (.env)' : 'Config File',
          inline: true,
        },
        {
          name: '🔧 ประเภท',
          value: info.type,
          inline: true,
        },
        {
          name: '📂 หมวดหมู่',
          value: info.categoryLabel || 'อื่นๆ',
          inline: true,
        }
      )
      .setTimestamp();

    if (info.type !== 'secret' && info.value) {
      let display = info.value;
      if (info.type === 'list') {
        const list = Array.isArray(info.value)
          ? info.value
          : String(info.value || '')
              .split(/[,\n]/)
              .map(s => s.trim())
              .filter(Boolean);
        display = list.length ? list.join(', ') : '(ยังไม่ได้ตั้ง)';
      }

      embed.addFields({
        name: '📄 ค่า',
        value: `\`\`\`${display}\`\`\``,
        inline: false,
      });
    }

    return embed;
  }

  // Embed สำหรับแสดงเฉพาะหมวดหมู่
  static buildCategoryEmbed(categoryKey) {
    const grouped = ConfigManager.getConfigByCategory();
    const category = grouped[categoryKey];

    if (!category) {
      return this.buildErrorEmbed('ไม่พบหมวดหมู่นี้');
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(category.label)
      .setDescription('รายละเอียดการตั้งค่าในหมวดหมู่นี้')
      .setTimestamp();

    for (const item of category.items) {
      const icon = item.configured ? '✅' : '❌';
      const envTag = item.fromEnv ? ' `[ENV]`' : '';
      
      let displayValue = item.value;
      
      if (item.type === 'secret') {
        displayValue = item.configured ? '●●●●●●●● (ตั้งค่าแล้ว)' : '(ยังไม่ได้ตั้ง)';
      } else if (item.type === 'boolean') {
        displayValue = item.value ? '🟢 เปิดอยู่' : '🔴 ปิดอยู่';
      } else if (!item.value) {
        displayValue = '(ยังไม่ได้ตั้ง)';
      }

      embed.addFields({
        name: `${icon} ${item.label}${envTag}`,
        value: `${item.description}\n\`\`\`${displayValue}\`\`\``,
        inline: false,
      });
    }

    const configured = category.items.filter(item => item.configured).length;
    const total = category.items.length;
    const percent = Math.round((configured / total) * 100);

    embed.setFooter({
      text: `ความสมบูรณ์: ${configured}/${total} (${percent}%)`,
    });

    return embed;
  }
}

module.exports = ConfigEmbed;
