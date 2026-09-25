import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { NextFunction, Request, RequestHandler, Response } from "express";

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

type FallbackUser = AuthUser & { passwordHash: string };

type DbLike = {
  select: (...args: any[]) => any;
  insert: (table: unknown) => { values: (record: Record<string, unknown>) => { returning: () => Promise<Array<Record<string, unknown>>> } };
  update: (table: unknown) => { set: (record: Record<string, unknown>) => { where: (condition: unknown) => { returning: () => Promise<Array<Record<string, unknown>>> } } };
  delete: (table: unknown) => { where: (condition: unknown) => Promise<unknown> };
};

const fallbackUsers = new Map<string, FallbackUser>();
const fallbackSessions = new Map<string, { userId: number; expiresAt: Date }>();
let fallbackUserId = 1;

function configureDemoAuth() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "admin@comhub.co.za").trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "Kamphata@2023";
  const existing = fallbackUsers.get(email);
  if (existing) {
    if (existing.role !== "SUPER_ADMIN") existing.role = "SUPER_ADMIN";
    if (existing.passwordHash !== hashPassword(password)) existing.passwordHash = hashPassword(password);
    return { email, password };
  }
  fallbackUsers.set(email, {
    id: fallbackUserId++,
    fullName: "Community Wealth Super Admin",
    email,
    phoneNumber: "",
    role: "SUPER_ADMIN",
    hubId: null,
    passwordHash: hashPassword(password),
  });
  return { email, password };
}

async function resolveDb(): Promise<{ db: DbLike; usersTable: { id: { value: number }; email: { value: string }; role: { value: AppRole }; hubId: { value: number | null }; fullName: { value: string }; phoneNumber: { value: string }; passwordHash: { value: string } }; authSessionsTable: { id: { value: string }; userId: { value: number }; expiresAt: { value: Date } } } | null> {
  if (!process.env.DATABASE_URL) return null;
  const mod = await import("@workspace/db");
  return { db: mod.db as DbLike, usersTable: mod.usersTable as any, authSessionsTable: mod.authSessionsTable as any };
}

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

function publicUser(user: Partial<AuthUser> & { id: number; fullName?: string; email?: string; phoneNumber?: string; role?: AppRole; hubId?: number | null }): AuthUser {
  return {
    id: user.id,
    fullName: user.fullName ?? "",
    email: user.email ?? "",
    phoneNumber: user.phoneNumber ?? "",
    role: user.role ?? "CLIENT",
    hubId: user.hubId ?? null,
  };
}

export async function findUserByEmail(email: string) {
  const normalized = email.toLowerCase();
  const dbHandle = await resolveDb();
  if (!dbHandle) {
    return fallbackUsers.get(normalized) ?? null;
  }
  const [user] = await (dbHandle.db.select() as any).from(dbHandle.usersTable).where((eq as any)(dbHandle.usersTable.email, normalized)).limit(1);
  return user ?? null;
}

export async function ensureConfiguredSuperAdmin() {
  if (!process.env.DATABASE_URL) {
    configureDemoAuth();
    return;
  }
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "admin@comhub.co.za").trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "Kamphata@2023";
  if (!email || !password) return;
  const dbHandle = await resolveDb();
  if (!dbHandle) return;
  const existing = await findUserByEmail(email);
  if (existing) {
    if (existing.role !== "SUPER_ADMIN") {
      await (dbHandle.db.update(dbHandle.usersTable) as any).set({ role: "SUPER_ADMIN" }).where((eq as any)(dbHandle.usersTable.id, existing.id));
    }
    return;
  }
  await (dbHandle.db.insert(dbHandle.usersTable) as any).values({
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
  const dbHandle = await resolveDb();
  if (!dbHandle) {
    fallbackSessions.set(id, { userId, expiresAt });
    return { id, expiresAt };
  }
  await (dbHandle.db.insert(dbHandle.authSessionsTable) as any).values({ id, userId, expiresAt });
  return { id, expiresAt };
}

export async function getUserFromSession(sessionId?: string) {
  if (!sessionId) return null;
  const dbHandle = await resolveDb();
  if (!dbHandle) {
    const session = fallbackSessions.get(sessionId);
    if (!session || session.expiresAt <= new Date()) {
      fallbackSessions.delete(sessionId);
      return null;
    }
    const user = [...fallbackUsers.values()].find((entry) => entry.id === session.userId);
    return user ? publicUser(user) : null;
  }
  const [result] = await (dbHandle.db.select() as any)
    .from(dbHandle.authSessionsTable)
    .innerJoin(dbHandle.usersTable, (eq as any)(dbHandle.authSessionsTable.userId, dbHandle.usersTable.id))
    .where((and as any)((eq as any)(dbHandle.authSessionsTable.id, sessionId), (gt as any)(dbHandle.authSessionsTable.expiresAt, new Date())))
    .limit(1);
  return result ? publicUser(result.user) : null;
}

export async function deleteSession(sessionId?: string) {
  if (!sessionId) return;
  const dbHandle = await resolveDb();
  if (!dbHandle) {
    fallbackSessions.delete(sessionId);
    return;
  }
  await (dbHandle.db.delete(dbHandle.authSessionsTable) as any).where((eq as any)(dbHandle.authSessionsTable.id, sessionId));
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