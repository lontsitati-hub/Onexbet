import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import { ForbiddenError } from "../../shared/_core/errors.js";
import { ENV } from "./env";

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

function adminUidSet(): Set<string> {
  return new Set(
    (process.env.FIREBASE_ADMIN_UIDS || "")
      .split(",")
      .map((uid) => uid.trim())
      .filter(Boolean),
  );
}

export type FirebaseToken = {
  uid: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
};

export type AuthenticatedUser = User & {
  firebaseUid: string;
};

export async function verifyFirebaseIdToken(token: string): Promise<FirebaseToken> {
  if (!isNonEmptyString(token)) throw ForbiddenError("Firebase token missing");
  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    algorithms: ["RS256"],
    issuer: `https://securetoken.google.com/${ENV.firebaseProjectId}`,
    audience: ENV.firebaseProjectId,
  });
  const uid = typeof payload.sub === "string" ? payload.sub : "";
  if (!uid) throw ForbiddenError("Firebase token subject missing");
  return {
    uid,
    email: typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
    emailVerified: payload.email_verified === true,
  };
}

function userFromToken(token: FirebaseToken): AuthenticatedUser {
  const now = new Date();
  const role = adminUidSet().has(token.uid) ? "admin" : "user";
  return {
    id: -1,
    openId: token.uid,
    name: token.name,
    email: token.email,
    loginMethod: "firebase",
    role,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    firebaseUid: token.uid,
  } as AuthenticatedUser;
}

export class FirebaseAuthSDK {
  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const header = req.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) {
      throw ForbiddenError("Firebase authentication required");
    }
    const token = await verifyFirebaseIdToken(header.slice("Bearer ".length).trim());
    return userFromToken(token);
  }
}

export const sdk = new FirebaseAuthSDK();
