import { Router, Request, Response } from "express";
import { getPrisma } from "../prisma.js";
import { hashPassword, verifyPassword, validatePasswordComplexity } from "../auth/password.js";
import { createSession, deleteSession } from "../auth/session.js";
import { requireAuth, COOKIE_NAME } from "../middleware/auth.js";

export const authRouter = Router();

const COOKIE_OPTIONS = {
    httpOnly: true,
    signed: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
};

// POST /api/auth/login
// AC-01, AC-05 (BR-06 generic message), AC-06 (BR-07 inactive message).
authRouter.post("/login", async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email and password are required." } });
        return;
    }

    try {
        const prisma = getPrisma();
        const user = await prisma.user.findUnique({ where: { email } });

        // BR-06: identical message whether the email exists or the password is wrong.
        if (!user || !(await verifyPassword(password, user.passwordHash))) {
            res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } });
            return;
        }

        // BR-07: distinct message for inactive accounts, checked only after
        // credentials verify, so an attacker can't use it to probe emails.
        if (!user.isActive) {
            res.status(403).json({
                error: { code: "ACCOUNT_INACTIVE", message: "This account is inactive. Contact an administrator." },
            });
            return;
        }

        const { token, expiresAt } = await createSession(user.id);
        res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTIONS, expires: expiresAt });

        res.status(200).json({
            id: user.id,
            name: user.name,
            role: user.role,
            mustChangePassword: user.mustChangePassword,
        });
    } catch (err) {
        console.error("[POST /api/auth/login]", err);
        res.status(500).json({ error: { code: "SERVER_ERROR", message: "Login failed. Please try again." } });
    }
});

// POST /api/auth/logout — idempotent, always 200.
// AC-07, BR-09: real server-side invalidation, not just clearing the cookie.
authRouter.post("/logout", async (req: Request, res: Response) => {
    const token = req.signedCookies?.[COOKIE_NAME];
    await deleteSession(token);
    res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
    res.status(200).json({ success: true });
});

// GET /api/auth/me — intentionally NOT gated by requirePasswordChanged,
// since the client needs this to learn mustChangePassword in the first place.
authRouter.get("/me", requireAuth, (req: Request, res: Response) => {
    res.status(200).json(req.user);
});

// PATCH /api/auth/password — the one route reachable while mustChangePassword
// is true. Requires requireAuth only, never requirePasswordChanged.
authRouter.patch("/password", requireAuth, async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body ?? {};

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Current and new password are required." } });
        return;
    }

    try {
        const prisma = getPrisma();
        const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });

        if (!(await verifyPassword(currentPassword, user.passwordHash))) {
            res.status(400).json({ error: { code: "INVALID_CURRENT_PASSWORD", message: "Current password is incorrect." } });
            return;
        }

        const complexityErrors = validatePasswordComplexity(newPassword);
        if (complexityErrors.length > 0) {
            res.status(400).json({ error: { code: "WEAK_PASSWORD", message: complexityErrors.join(" ") } });
            return;
        }

        const passwordHash = await hashPassword(newPassword);
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash, mustChangePassword: false },
        });

        res.status(200).json({ success: true });
    } catch (err) {
        console.error("[PATCH /api/auth/password]", err);
        res.status(500).json({ error: { code: "SERVER_ERROR", message: "Password change failed. Please try again." } });
    }
});