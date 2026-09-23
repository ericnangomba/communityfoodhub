import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { db } from "@workspace/db";
import { authSessionsTable, usersTable } from "@workspace/db/schema";

export const SESSION_COOKIE = "cwh_session";
const SESSION_DAYS = 30;

export type AppRole = "CLIENT" | "HUB_ADMIN" | "DELIVERY_AGENT" | "SUPER_ADMIN";

export type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: AppRole;
  hubId: number | null;
};

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function publicUser(user: typeof usersTable.$inferSelect): AuthUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role as AppRole,
    hubId: user.hubId,
  };
}

export async function findUserByEmail(email: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  return user;
}

export async function ensureConfiguredSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) return;
  const existing = await findUserByEmail(email);
  if (existing) {
    if (existing.role !== "SUPER_ADMIN") {
      await db.update(usersTable).set({ role: "SUPER_ADMIN" }).where(eq(usersTable.id, existing.id));
    }
    return;
  }
  await db.insert(usersTable).values({
    fullName: "Community Wealth Super Admin",
    email,
    passwordHash: hashPassword(password),
    phoneNumber: "",
    role: "SUPER_ADMIN",
  });
}

export async function createSession(userId: number) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(authSessionsTable).values({ id, userId, expiresAt });
  return { id, expiresAt };
}

export async function getUserFromSession(sessionId?: string) {
  if (!sessionId) return null;
  const [result] = await db
    .select({ user: usersTable, session: authSessionsTable })
    .from(authSessionsTable)
    .innerJoin(usersTable, eq(authSessionsTable.userId, usersTable.id))
    .where(and(eq(authSessionsTable.id, sessionId), gt(authSessionsTable.expiresAt, new Date())))
    .limit(1);
  return result ? publicUser(result.user) : null;
}

export async function deleteSession(sessionId?: string) {
  if (sessionId) await db.delete(authSessionsTable).where(eq(authSessionsTable.id, sessionId));
}

export const requireAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getUserFromSession(req.cookies?.[SESSION_COOKIE]);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    req.authUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

export function requireRoles(...roles: AppRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      res.status(403).json({ error: "This account does not have access to this workspace" });
      return;
    }
    next();
  };
}

export { publicUser };

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}