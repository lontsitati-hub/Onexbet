import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { CouponShare, InsertUser, couponShares, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch {
      console.warn("[Database] Failed to connect");
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user");
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getCouponShare(code: string): Promise<CouponShare | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.select().from(couponShares).where(eq(couponShares.code, code)).limit(1);
  return result[0];
}

export async function upsertCouponShare(input: {
  code: string;
  ownerUid: string;
  payload: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const updated = await db
    .update(couponShares)
    .set({ payload: input.payload })
    .where(and(eq(couponShares.code, input.code), eq(couponShares.ownerUid, input.ownerUid)))
    .execute();
  if (updated[0].affectedRows > 0) return;
  try {
    await db.insert(couponShares).values(input);
  } catch (error) {
    const existing = await getCouponShare(input.code);
    if (existing?.ownerUid !== input.ownerUid) {
      const ownershipError = new Error("This coupon code is already owned by another account.");
      Object.assign(ownershipError, { statusCode: 409 });
      throw ownershipError;
    }
    throw error;
  }
}
