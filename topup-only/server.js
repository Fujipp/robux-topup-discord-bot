// server.js
// HTTP server + Discord bot starter for PaaS (Azure/Render/Railway)

const express = require("express");
const os = require("os");

const app = express();

// Trust reverse proxy (for some PaaS)
app.set("trust proxy", true);

// Health endpoints
app.get("/", (_req, res) => res.status(200).send("OK ✅"));
app.get("/healthz", (_req, res) => res.status(200).json({ status: "healthy" }));
app.get("/readyz", (_req, res) =>
  res.status(200).json({
    status: "ready",
    uptime: process.uptime(),
    pid: process.pid,
    hostname: os.hostname(),
    time: new Date().toISOString(),
  }),
);

// Start server
const PORT = Number(process.env.PORT) || 8080;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`🌐 HTTP server listening on ${HOST}:${PORT}`);
  // Start Discord bot after HTTP is ready
  try {
    require("./index.js");
  } catch (err) {
    console.error("❌ Failed to start Discord bot:", err);
  }
});

// Graceful shutdown
const graceful = (signal) => {
  console.log(`⚠️ Received ${signal}, shutting down...`);
  server.close(() => {
    console.log("✅ HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.once("SIGINT", () => graceful("SIGINT"));
process.once("SIGTERM", () => graceful("SIGTERM"));

// Error handlers
process.on("unhandledRejection", (err) => {
  console.error("🚨 UnhandledRejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("🚨 UncaughtException:", err);
});
