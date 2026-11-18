import { createHash, randomBytes, randomInt } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { nanoid } from "nanoid";
import { Click } from "./models/click.js";
import { Url } from "./models/url.js";
import { validateDestination, validateShortCode } from "./validation.js";

const ownerTokenHeader = "x-owner-token";

export function createApp({ baseUrl = "http://localhost:4000" } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(resolve(dirname(fileURLToPath(import.meta.url)), "../public")));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post("/api/urls", async (request, response, next) => {
    const destination = validateDestination(request.body?.url);
    if (destination.error) {
      return response.status(400).json({ error: destination.error });
    }

    const customCode = validateShortCode(request.body?.customCode);
    if (customCode.error) {
      return response.status(400).json({ error: customCode.error });
    }

    const ownerToken = randomBytes(32).toString("base64url");
    const maxCodeAttempts = customCode.value ? 1 : 5;

    try {
      for (let attempt = 0; attempt < maxCodeAttempts; attempt += 1) {
        const code = customCode.value ?? createRelatedCode(destination.value);

        try {
          const url = await Url.create({
            code,
            destination: destination.value,
            ownerTokenHash: hashToken(ownerToken),
          });

          return response.status(201).json({
            code: url.code,
            shortUrl: `${(typeof baseUrl === "function" ? baseUrl() : baseUrl).replace(/\/$/, "")}/${url.code}`,
            destination: url.destination,
            createdAt: url.createdAt,
            ownerToken,
          });
        } catch (error) {
          if (error?.code !== 11000) throw error;
          if (customCode.value) {
            return response.status(409).json({ error: "short code is already in use" });
          }
        }
      }

      return response.status(503).json({
        error: "could not generate a unique short code; please try again",
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/urls/:code/stats", async (request, response, next) => {
    try {
      const url = await Url.findOne({ code: request.params.code }).lean();
      if (!url) return response.status(404).json({ error: "short link not found" });

      const [totalClicks, clicksByDay] = await Promise.all([
        Click.countDocuments({ code: url.code }),
        Click.aggregate([
          { $match: { code: url.code } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$clickedAt", timezone: "UTC" },
              },
              clicks: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, date: "$_id", clicks: 1 } },
        ]),
      ]);

      return response.json({
        code: url.code,
        destination: url.destination,
        createdAt: url.createdAt,
        totalClicks,
        clicksByDay,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/urls/:code", async (request, response, next) => {
    const ownerToken = request.get(ownerTokenHeader);
    if (!ownerToken) {
      return response.status(401).json({ error: `provide ${ownerTokenHeader} to delete this link` });
    }

    try {
      const url = await Url.findOne({ code: request.params.code })
        .select("+ownerTokenHash")
        .exec();
      if (!url) return response.status(404).json({ error: "short link not found" });
      if (url.ownerTokenHash !== hashToken(ownerToken)) {
        return response.status(403).json({ error: "invalid owner token" });
      }

      await Promise.all([
        Url.deleteOne({ _id: url._id }),
        Click.deleteMany({ code: url.code }),
      ]);
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  app.get("/:code", async (request, response, next) => {
    try {
      const url = await Url.findOne({ code: request.params.code }).lean();
      if (!url) return response.status(404).json({ error: "short link not found" });

      await Click.create({
        code: url.code,
        referrer: request.get("referer") || null,
        userAgent: request.get("user-agent") || null,
      });
      return response.redirect(302, url.destination);
    } catch (error) {
      return next(error);
    }
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "route not found" });
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && "body" in error) {
      return response.status(400).json({ error: "request body must be valid JSON" });
    }
    if (error?.type === "entity.too.large") {
      return response.status(413).json({ error: "request body is too large" });
    }
    console.error("Request failed:", error);
    return response.status(500).json({ error: "internal server error" });
  });

  return app;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRelatedCode(destination) {
  const hostname = new URL(destination).hostname.replace(/^www\./, "");
  const label = hostname.split(".")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
  return `${label || "link"}-${nanoid(3)}`;
}
