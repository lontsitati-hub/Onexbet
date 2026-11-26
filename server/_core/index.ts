import "dotenv/config";
import express, { type Request, type Response } from "express";
import path from "node:path";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { registerFirebaseAuthRoutes } from "./firebaseAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createCorsMiddleware } from "./cors";
import { registerCouponShareRoutes } from "../couponShares";

const API_FOOTBALL_RESOURCES = new Set(["leagues", "fixtures", "odds/live", "teams", "countries"]);
const API_FOOTBALL_QUERY_KEYS = new Set(["current", "live", "timezone", "date", "fixture", "search"]);
const API_FOOTBALL_QUERY_VALUE = /^[^\u0000-\u001F\u007F]{1,128}$/;

async function proxyApiFootball(req: Request, res: Response) {
  const resource = [req.params.resource, req.params.subresource].filter(Boolean).join("/");
  if (!API_FOOTBALL_RESOURCES.has(resource)) {
    res.status(404).json({ error: "API-Football endpoint not found" });
    return;
  }
  const apiKey = process.env.API_FOOTBALL_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: "API-Football is not configured" });
    return;
  }
  const upstreamUrl = new URL(resource, "https://v3.football.api-sports.io/");
  for (const [key, value] of Object.entries(req.query)) {
    if (!API_FOOTBALL_QUERY_KEYS.has(key) || typeof value !== "string" || !API_FOOTBALL_QUERY_VALUE.test(value)) {
      res.status(400).json({ error: "Invalid API-Football query" });
      return;
    }
    upstreamUrl.searchParams.set(key, value);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: "application/json", "x-apisports-key": apiKey },
      signal: controller.signal,
    });
    const body = await upstream.text();
    res.status(upstream.status).setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.send(body);
  } catch {
    res.status(502).json({ error: "API-Football unavailable" });
  } finally {
    clearTimeout(timeout);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(createCorsMiddleware());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerFirebaseAuthRoutes(app);
  registerCouponShareRoutes(app);
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, provider: "firebase", timestamp: Date.now() });
  });
  app.get("/api/sports/football/:resource", proxyApiFootball);
  app.get("/api/sports/football/:resource/:subresource", proxyApiFootball);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  const clientDirectory = path.resolve(process.cwd(), "dist/client");
  app.use(express.static(clientDirectory));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/manus-storage/")) return next();
    res.sendFile(path.join(clientDirectory, "index.html"), (error) => {
      if (error) next(error);
    });
  });
  const port = parseInt(process.env.PORT || "3000", 10);
  server.listen(port, "0.0.0.0", () => console.log(`[api] server listening on ${port}`));
}

startServer().catch((error) => {
  console.error("[api] server failed to start", error);
  process.exitCode = 1;
});
