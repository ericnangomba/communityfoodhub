import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import {
  AppRole,
  createSession,
  deleteSession,
  ensureConfiguredSuperAdmin,
  findUserByEmail,
  hashPassword,
  requireAuth,
  requireRoles,
  SESSION_COOKIE,
  verifyPassword,
} from "../lib/auth";

const fallbackUsers = new Map<string, any>();
const fallbackSessions = new Map<string, any>();
const hasDatabase = Boolean(process.env.DATABASE_URL);
const demoEmail = (process.env.SUPER_ADMIN_EMAIL ?? "admin@comhub.co.za").trim().toLowerCase();
const demoPassword = process.env.SUPER_ADMIN_PASSWORD ?? "Kamphata@2023";

if (!hasDatabase && !fallbackUsers.has(demoEmail)) {
  fallbackUsers.set(demoEmail, {
    id: 1,
    fullName: "Community Wealth Super Admin",
    email: demoEmail,
    phoneNumber: "",
    role: "SUPER_ADMIN",
    hubId: null,
    passwordHash: hashPassword(demoPassword),
  });
}

const router: IRouter = Router();

const credentials = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
});

const registerBody = credentials.extend({
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: z.string().trim().min(7).max(30),
});

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  };
}

router.get("/auth/me", async (req, res, next) => {
  try {
    await ensureConfiguredSuperAdmin();
    requireAuth(req, res, next);
  } catch (error) {
    next(error);
  }
}, (req, res) => {
  res.json({ user: req.authUser });
});

router.post("/auth/register", async (req, res, next) => {
  try {
    const input = registerBody.parse(req.body);
    if (await findUserByEmail(input.email)) {
      res.status(409).json({ error: "An account already exists for that email" });
      return;
    }
    if (!hasDatabase) {
      const user = {
        id: fallbackUsers.size + 1,
        fullName: input.fullName,
        email: input.email,
        phoneNumber: input.phoneNumber,
        role: "CLIENT",
        hubId: null,
        passwordHash: hashPassword(input.password),
      };
      fallbackUsers.set(user.email, user);
      const session = await createSession(user.id);
      res.cookie(SESSION_COOKIE, session.id, cookieOptions(session.expiresAt));
      res.status(201).json({ user: { id: user.id, fullName: user.fullName, email: user.email, phoneNumber: user.phoneNumber, role: user.role, hubId: user.hubId } });
      return;
    }
    const [user] = await db.insert(usersTable).values({
      fullName: input.fullName,
      email: input.email,
      passwordHash: hashPassword(input.password),
      phoneNumber: input.phoneNumber,
      role: "CLIENT",
    }).returning();
    const session = await createSession(user.id);
    res.cookie(SESSION_COOKIE, session.id, cookieOptions(session.expiresAt));
    res.status(201).json({ user: { id: user.id, fullName: user.fullName, email: user.email, phoneNumber: user.phoneNumber, role: user.role, hubId: user.hubId } });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/login", async (req, res, next) => {
  try {
    await ensureConfiguredSuperAdmin();
    const input = credentials.parse(req.body);
    const user = await findUserByEmail(input.email);
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      if (!hasDatabase) {
        const fallbackUser = fallbackUsers.get(input.email.toLowerCase());
        if (fallbackUser && verifyPassword(input.password, fallbackUser.passwordHash)) {
          const session = await createSession(fallbackUser.id);
          res.cookie(SESSION_COOKIE, session.id, cookieOptions(session.expiresAt));
          res.json({ user: { id: fallbackUser.id, fullName: fallbackUser.fullName, email: fallbackUser.email, phoneNumber: fallbackUser.phoneNumber, role: fallbackUser.role, hubId: fallbackUser.hubId } });
          return;
        }
      }
      res.status(401).json({ error: "Email or password is incorrect" });
      return;
    }
    const session = await createSession(user.id);
    res.cookie(SESSION_COOKIE, session.id, cookieOptions(session.expiresAt));
    res.json({ user: { id: user.id, fullName: user.fullName, email: user.email, phoneNumber: user.phoneNumber, role: user.role, hubId: user.hubId } });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/logout", async (req, res, next) => {
  try {
    await deleteSession(req.cookies?.[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/auth/users", requireAuth, requireRoles("SUPER_ADMIN"), async (_req, res, next) => {
  try {
    if (!hasDatabase) {
      res.json({ users: [...fallbackUsers.values()].map((user) => ({ id: user.id, fullName: user.fullName, email: user.email, phoneNumber: user.phoneNumber, role: user.role, hubId: user.hubId })) });
      return;
    }
    const users = await db.select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      email: usersTable.email,
      phoneNumber: usersTable.phoneNumber,
      role: usersTable.role,
      hubId: usersTable.hubId,
    }).from(usersTable);
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.patch("/auth/users/:userId/role", requireAuth, requireRoles("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const role = z.enum(["CLIENT", "HUB_ADMIN", "DELIVERY_AGENT", "SUPER_ADMIN"]).parse(req.body.role) as AppRole;
    const hubId = req.body.hubId === null || req.body.hubId === undefined ? null : z.number().int().positive().parse(req.body.hubId);
    const userId = z.coerce.number().int().positive().parse(req.params.userId);
    if (!hasDatabase) {
      const user = [...fallbackUsers.values()].find((candidate) => candidate.id === userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      user.role = role;
      user.hubId = hubId;
      res.json({ user: { id: user.id, fullName: user.fullName, email: user.email, phoneNumber: user.phoneNumber, role: user.role, hubId: user.hubId } });
      return;
    }
    const [updated] = await db.update(usersTable).set({ role, hubId }).where(eq(usersTable.id, userId)).returning({
      id: usersTable.id,
      fullName: usersTable.fullName,
      email: usersTable.email,
      phoneNumber: usersTable.phoneNumber,
      role: usersTable.role,
      hubId: usersTable.hubId,
    });
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
});

export default router;