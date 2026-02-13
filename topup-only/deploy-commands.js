// deploy-commands.js
// Register slash commands to Discord

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // Optional: for guild-specific commands

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env");
  process.exit(1);
}

// Load all commands
const commands = [];
const commandsPath = path.join(__dirname, "commands");

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if (command?.data?.toJSON) {
        commands.push(command.data.toJSON());
        console.log(`📦 Loaded: ${command.data.name}`);
      } else {
        console.warn(`⚠️ Skipped (no data.toJSON): ${file}`);
      }
    } catch (err) {
      console.error(`❌ Failed to load ${file}:`, err.message);
    }
  }
}

if (commands.length === 0) {
  console.log("⚠️ No commands found to deploy.");
  process.exit(0);
}

// Deploy commands
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log(`\n🚀 Deploying ${commands.length} command(s)...`);

    let data;

    if (GUILD_ID) {
      // Guild-specific (faster for testing)
      data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commands,
      });
      console.log(`✅ Deployed ${data.length} guild command(s) to ${GUILD_ID}`);
    } else {
      // Global commands (takes up to 1 hour to propagate)
      data = await rest.put(Routes.applicationCommands(CLIENT_ID), {
        body: commands,
      });
      console.log(`✅ Deployed ${data.length} global command(s)`);
    }

    console.log("\n📝 Registered commands:");
    data.forEach((cmd) => console.log(`   - /${cmd.name}`));
  } catch (error) {
    console.error("❌ Failed to deploy commands:", error);
    process.exit(1);
  }
})();
