// interactions/autocomplete.js
const MAX_CHOICES = 25;

// helper: normalize string เพื่อให้ค้นหาแบบไม่สนเคส/เว้นวรรคแปลก ๆ
function norm(s) {
  return (s || "").toLowerCase().normalize("NFKC").trim();
}

// จัดอันดับผลลัพธ์: startsWith มาก่อน includes
function rankAndSlice(items, query, pickLabel, pickValue) {
  const q = norm(query);
  if (!q) return items.slice(0, MAX_CHOICES).map(x => ({ name: pickLabel(x), value: pickValue(x) }));

  const starts = [];
  const contains = [];
  for (const it of items) {
    const label = norm(pickLabel(it));
    if (label.startsWith(q)) starts.push(it);
    else if (label.includes(q)) contains.push(it);
  }
  const ranked = [...starts, ...contains].slice(0, MAX_CHOICES);
  return ranked.map(x => ({ name: pickLabel(x), value: pickValue(x) }));
}

module.exports = {
  name: "interactionCreate",
  async execute(client, interaction) {
    if (!interaction.isAutocomplete()) return;

    const focused = interaction.options.getFocused(true);
    const q = focused.value ?? "";

    // ---------- /payment channel ----------
    if (interaction.commandName === "payment" && focused.name === "channel") {
      try {
        // ดึง channel ที่ "ส่งข้อความได้" เท่านั้น (Text/Announcement/Thread)
        const guild = interaction.guild;

        // ดึงแคชช่องมาตรฐาน
        const baseChannels = guild.channels?.cache?.toJSON?.() || [];
        // พยายามดึง active threads เพิ่ม (เผื่อยังไม่อยู่ในแคช)
        let threads = [];
        try {
          const active = await guild.channels.fetchActiveThreads();
          threads = active?.threads?.toJSON?.() || [];
        } catch { /* เงียบไว้ได้ ไม่ถือเป็น error */ }

        const all = [...baseChannels, ...threads]
          .filter((ch) => {
            // discord.js v14: ใช้ isTextBased() ถ้ามี
            try {
              if (typeof ch.isTextBased === "function") return ch.isTextBased();
              // fallback สำหรับบางชนิด
              return ["GUILD_TEXT","GUILD_NEWS","GUILD_PUBLIC_THREAD","GUILD_PRIVATE_THREAD"].includes(ch.type);
            } catch { return false; }
          });

        // label สวย ๆ (#ชื่่อ | หมวดหมู่ ถ้ามี)
        const choices = rankAndSlice(
          all,
          q,
          (ch) => {
            const category = ch.parent?.name ? ` | ${ch.parent.name}` : "";
            const prefix = ch.isThread?.() ? "🧵 " : "#";
            return `${prefix}${ch.name}${category}`;
          },
          (ch) => ch.id
        );

        return interaction.respond(choices);
      } catch (e) {
        // ถ้าพัง ให้ตอบว่าง ๆ กัน error
        return interaction.respond([]);
      }
    }

    // ---------- /user ... userid ----------
    if (interaction.commandName === "user" && focused.name === "userid") {
      try {
        const guild = interaction.guild;
        // ดึงสมาชิกให้แคชมากขึ้น (ต้องเปิด Privileged Intent: SERVER MEMBERS)
        if (guild?.members?.fetch) {
          // ป้องกันรัวเกินไป: ไม่ต้องดึงทั้งหมดทุกครั้ง—แต่ครั้งแรกของกิลด์จะช่วย autocomplete มาก
          await guild.members.fetch({ withPresences: false }).catch(() => {});
        }

        const members = guild?.members?.cache?.toJSON?.() || [];

        const choices = rankAndSlice(
          members,
          q,
          (m) => {
            const nick = m.displayName || m.user?.globalName || m.user?.username || m.user?.tag || m.id;
            return `${nick} (${m.id})`;
          },
          (m) => m.id
        );

        return interaction.respond(choices);
      } catch (e) {
        return interaction.respond([]);
      }
    }
  }
};
