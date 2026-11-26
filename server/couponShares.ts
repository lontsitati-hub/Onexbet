import type { Express, Request, Response } from "express";
import { getCouponShare, upsertCouponShare } from "./db";
import { sdk } from "./_core/sdk";

const MAX_PAYLOAD_LENGTH = 850_000;

function normalizeCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function isValidCouponCode(code: string): boolean {
  if (!/^[A-Z0-9]{5}$/.test(code)) return false;
  const letters = (code.match(/[A-Z]/g) || []).length;
  const digits = (code.match(/[0-9]/g) || []).length;
  return (letters === 3 && digits === 2) || (letters === 2 && digits === 3);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function requireFirebaseUser(req: Request) {
  return sdk.authenticateRequest(req);
}

export function registerCouponShareRoutes(app: Express) {
  app.get("/api/coupon-shares/:code", async (req: Request, res: Response) => {
    try {
      await requireFirebaseUser(req);
      const code = normalizeCode(req.params.code);
      if (!isValidCouponCode(code)) {
        res.status(400).json({ error: "Invalid coupon code" });
        return;
      }
      const share = await getCouponShare(code);
      if (!share) {
        res.status(404).json({ code: "coupon_not_found" });
        return;
      }
      res.json({ code: share.code, payload: share.payload });
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode ?? 401;
      res.status(status).json({ error: errorMessage(error, "Firebase authentication required") });
    }
  });

  app.put("/api/coupon-shares/:code", async (req: Request, res: Response) => {
    try {
      const user = await requireFirebaseUser(req);
      const code = normalizeCode(req.params.code);
      const payload = req.body?.payload;
      if (!isValidCouponCode(code)) {
        res.status(400).json({ error: "Invalid coupon code" });
        return;
      }
      if (typeof payload !== "string" || payload.length === 0 || payload.length > MAX_PAYLOAD_LENGTH) {
        res.status(400).json({ error: "Invalid coupon payload" });
        return;
      }
      await upsertCouponShare({ code, ownerUid: user.firebaseUid, payload });
      res.json({ code });
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode ?? 500;
      res.status(status).json({ error: errorMessage(error, "Unable to save coupon") });
    }
  });
}
