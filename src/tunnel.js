import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import mongoose from "mongoose";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
const mongoUri = process.env.MONGODB_URI;
const localCloudflared = join(
  homedir(),
  "AppData",
  "Local",
  "Programs",
  "cloudflared",
  "cloudflared.exe",
);
const cloudflaredCommand =
  process.env.CLOUDFLARED_PATH ??
  (process.platform === "win32" && existsSync(localCloudflared)
    ? localCloudflared
    : "cloudflared");

if (!mongoUri) {
  console.error("MONGODB_URI is required. Copy .env.example to .env and configure it.");
  process.exit(1);
}

let tunnelProcess;
let publicUrl;
let server;
let shuttingDown = false;

try {
  await mongoose.connect(mongoUri);
  server = await new Promise((resolve, reject) => {
    const listener = createApp({
      baseUrl: () => publicUrl ?? `http://localhost:${port}`,
    }).listen(port, () => resolve(listener));
    listener.once("error", reject);
  });

  tunnelProcess = spawn(
    cloudflaredCommand,
    ["tunnel", "--url", `http://127.0.0.1:${port}`],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  tunnelProcess.stdout.on("data", reportTunnelOutput);
  tunnelProcess.stderr.on("data", reportTunnelOutput);
  tunnelProcess.once("error", (error) => {
    console.error("Could not start cloudflared. Install it with: winget install --id Cloudflare.cloudflared");
    console.error(error);
    void shutdown(1);
  });
  tunnelProcess.once("exit", (code) => {
    if (!shuttingDown) {
      console.error(`Public tunnel exited${code === null ? "" : ` with code ${code}`}.`);
      void shutdown(code || 1);
    }
  });

  process.once("SIGINT", () => void shutdown(0));
  process.once("SIGTERM", () => void shutdown(0));
} catch (error) {
  console.error("Could not start the public URL shortener:", error);
  await shutdown(1);
}

async function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  tunnelProcess?.kill();
  if (server?.listening) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
  process.exit(exitCode);
}

function reportTunnelOutput(chunk) {
  const output = chunk.toString();
  const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (match && !publicUrl) {
    publicUrl = match[0];
    console.log(`Public short links are available at ${publicUrl}`);
    console.log("Keep this terminal open while you use the public links.");
  }
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    if (!line.includes("trycloudflare.com")) console.log(line);
  }
}
