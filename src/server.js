import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
const baseUrl = () => process.env.BASE_URL ?? `http://localhost:${port}`;
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("MONGODB_URI is required. Copy .env.example to .env and configure it.");
  process.exit(1);
}

try {
  await mongoose.connect(mongoUri);
  const server = createApp({ baseUrl }).listen(port, () => {
    console.log(`URL Shortener API listening at ${baseUrl()}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch (error) {
  console.error("Could not connect to MongoDB:", error);
  process.exit(1);
}
