import { Request, Response, NextFunction } from "express";
import { validateSession } from "../auth/session.js";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "tt_session";

export { COOKIE_NAME };

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: { id: number; name: string; email: string; role: string; mustChangePassword: boolean };
        }
    }
}

// Attaches req.user from the session cookie, or responds 401.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token = req.signedCookies?.[COOKIE_NAME];
    const user = await validateSession(token);

    if (!user) {
        res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Not authenticated." } });
        return;
    }

    req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
    };
    next();
}

// Blocks access until the user has changed their initial password (BR-02).
// Apply AFTER requireAuth, and never on /api/auth/me or /api/auth/password.
export function requirePasswordChanged(req: Request, res: Response, next: NextFunction) {
    if (req.user?.mustChangePassword) {
        res.status(403).json({
            error: { code: "PASSWORD_CHANGE_REQUIRED", message: "You must change your password before continuing." },
        });
        return;
    }
    next();
}

// Restricts access to one or more roles. Apply AFTER requireAuth.
export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this resource." } });
            return;
        }
        next();
    };
}