// index.js
// Discord Bot - Top-up System Only (SlipOK + TrueMoney Wallet)

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  ActivityType,
  Events,
} = require("discord.js");

// Check required env
if (!process.env.DISCORD_TOKEN) {
  console.error("❌ Missing DISCORD_TOKEN in environment.");
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Increase max listeners
client.setMaxListeners(50);

// Prevent duplicate event bindings
const boundEvents = new Set();

// Load commands from /commands/*.js
client.commands = new Collection();
const commandsDir = path.join(__dirname, "commands");
if (fs.existsSync(commandsDir)) {
  for (const file of fs.readdirSync(commandsDir)) {
    if (!file.endsWith(".js")) continue;
    const full = path.join(commandsDir, file);
    try {
      const cmd = require(full);
      if (cmd?.data?.name && typeof cmd.execute === "function") {
        client.commands.set(cmd.data.name, cmd);
        console.log(`✅ Command loaded: ${cmd.data.name}`);
      } else {
        console.warn(`⚠️ Skip command (invalid shape): ${file}`);
      }
    } catch (e) {
      console.error(`❌ Failed to load command ${file}:`, e);
    }
  }
}

// Bind events from directory
const bindEventsFromDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) return;
  for (const file of fs.readdirSync(dirPath)) {
    if (!file.endsWith(".js")) continue;
    const full = path.join(dirPath, file);
    try {
      const mod = require(full);
      if (mod?.name && typeof mod.execute === "function") {
        const key = `${mod.once ? "once" : "on"}:${mod.name}:${full}`;
        if (boundEvents.has(key)) continue;
        boundEvents.add(key);
        if (mod.once) {
          client.once(mod.name, (...args) => mod.execute(client, ...args));
        } else {
          client.on(mod.name, (...args) => mod.execute(client, ...args));
        }
        console.log(`🔗 Bound event: ${mod.name} <- ${file}`);
      }
    } catch (e) {
      console.error(`❌ Failed to bind events from ${full}:`, e);
    }
  }
};

// Load event handlers
bindEventsFromDir(path.join(__dirname, "bank"));
bindEventsFromDir(path.join(__dirname, "update"));
bindEventsFromDir(path.join(__dirname, "interactions"));

// Ready event
client.once(Events.ClientReady, () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  try {
    client.user.setActivity("Top-up Service", { type: ActivityType.Playing });
  } catch {}

  // Log registered commands
  (async () => {
    try {
      const globalCmds = await client.application.commands.fetch();
      console.log(`📝 Global commands: ${globalCmds.size}`);
      if (globalCmds.size) {
        console.log(
          "   Commands:",
          [...globalCmds.values()].map((c) => c.name).join(", "),
        );
      }
    } catch (err) {
      console.warn("⚠️ Failed to fetch commands:", err.message);
    }
  })();
});

// Slash command handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand?.()) return;
  console.log(
    `🪄 Command: /${interaction.commandName} by ${interaction.user.tag}`,
  );
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction, client);
  } catch (e) {
    console.error(`❌ Command error [/${interaction.commandName}]:`, e);
    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: "❌ มีข้อผิดพลาด", ephemeral: true })
        .catch(() => {});
    }
  }
});

// Error handlers
process.on("unhandledRejection", (err) =>
  console.error("🚨 UnhandledRejection:", err),
);
process.on("uncaughtException", (err) =>
  console.error("🚨 UncaughtException:", err),
);

// Graceful shutdown
const stop = async (signal) => {
  console.log(`⚠️ Received ${signal}, destroying Discord client...`);
  try {
    await client.destroy();
  } catch {}
};
process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));

// Login
if (process.env.DISCORD_TOKEN) {
  client.login(process.env.DISCORD_TOKEN).catch((e) => {
    console.error("❌ Discord login failed:", e);
  });
}

module.exports = client;
