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