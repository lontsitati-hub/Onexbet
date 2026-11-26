import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";

function userResponse(user: Awaited<ReturnType<typeof sdk.authenticateRequest>>) {
  return {
    id: user.id,
    openId: user.firebaseUid,
    name: user.name,
    email: user.email,
    loginMethod: "firebase" as const,
    role: user.role,
    lastSignedIn: user.lastSignedIn.toISOString(),
  };
}

export function registerFirebaseAuthRoutes(app: Express) {
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: userResponse(user) });
    } catch {
      res.status(401).json({ error: "Firebase authentication required", user: null });
    }
  });

  // Sign-out is performed by the Firebase client SDK. This endpoint exists only
  // as an idempotent compatibility response and never creates or clears cookies.
  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.json({ success: true, provider: "firebase" });
  });
}
