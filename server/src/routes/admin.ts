import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { requireAuth, requirePasswordChanged, requireRole } from "../middleware/auth.js";
import { hashPassword, validatePasswordComplexity } from "../auth/password.js";
import { leavesNoActiveAdministrator } from "../lib/adminRules.js";
import { isRole, validateUserInput } from "../validation/user.js";

export const adminRouter = Router();

// Authorization matrix (specification.md §5.2): user management is Administrator-only,
// and never reachable before the initial password has been changed.
adminRouter.use(requireAuth, requirePasswordChanged, requireRole("ADMINISTRATOR"));

// passwordHash is never selected: the credential does not leave the database through this API.
const USER_SELECT = { id: true, name: true, email: true, role: true, isActive: true } as const;

function parseId(raw: string): number | null {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function notFound(res: Response) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
}

function badRequest(res: Response, code: string, message: string, fields?: Record<string, string>) {
    res.status(400).json({ error: { code, message, ...(fields ? { fields } : {}) } });
}

function duplicateEmail(res: Response) {
    const message = "This email address is already in use.";
    res.status(409).json({ error: { code: "DUPLICATE_EMAIL", message, fields: { email: message } } });
}

function serverError(res: Response, route: string, err: unknown, message: string) {
    console.error(`[${route}]`, err);
    res.status(500).json({ error: { code: "SERVER_ERROR", message } });
}

const isUniqueViolation = (err: unknown) =>
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
const isSerializationFailure = (err: unknown) =>
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";

// GET /api/admin/users: name/email search and an optional role filter. No pagination (not required).
adminRouter.get("/users", async (req: Request, res: Response) => {
    try {
        const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
        const where: Prisma.UserWhereInput = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
            ];
        }
        if (isRole(req.query.role)) where.role = req.query.role; // an unknown role is ignored

        const users = await getPrisma().user.findMany({
            where,
            select: USER_SELECT,
            orderBy: [{ name: "asc" }, { id: "asc" }],
        });
        res.status(200).json(users);
    } catch (err) {
        serverError(res, "GET /api/admin/users", err, "Failed to retrieve users. Please try again.");
    }
});

// POST /api/admin/users: AC-18, BR-08, BR-11, BR-21, BR-22.
adminRouter.post("/users", async (req: Request, res: Response) => {
    const { fields, data } = validateUserInput(req.body ?? {}, "create");
    if (Object.keys(fields).length > 0) {
        return badRequest(res, "VALIDATION_ERROR", "One or more fields are invalid.", fields);
    }

    try {
        const prisma = getPrisma();

        const duplicate = await prisma.user.findFirst({
            where: { email: { equals: data.email!, mode: "insensitive" } },
            select: { id: true },
        });
        if (duplicate) return duplicateEmail(res);

        const user = await prisma.user.create({
            data: {
                name: data.name!,
                email: data.email!,
                role: data.role!,
                isActive: data.isActive ?? true,
                passwordHash: await hashPassword(data.initialPassword!),
                mustChangePassword: true, // an initial password must always be changed at first login
            },
            select: USER_SELECT,
        });

        res.status(201).json(user);
    } catch (err) {
        if (isUniqueViolation(err)) return duplicateEmail(res); // lost a race with another creation
        serverError(res, "POST /api/admin/users", err, "Failed to create the user. Please try again.");
    }
});

type Outcome =
    | { kind: "not-found" }
    | { kind: "duplicate" }
    | { kind: "last-admin" }
    | { kind: "ok"; user: { id: number; name: string; email: string; role: string; isActive: boolean } };

// PATCH /api/admin/users/:id: AC-19, AC-20, BR-21, BR-22, BR-23, BR-24, BR-30.
adminRouter.patch("/users/:id", async (req: Request, res: Response) => {
    const userId = parseId(req.params.id);
    if (!userId) return notFound(res);

    const { fields, data } = validateUserInput(req.body ?? {}, "update");
    if (Object.keys(fields).length > 0) {
        return badRequest(res, "VALIDATION_ERROR", "One or more fields are invalid.", fields);
    }
    if (data.name === undefined && data.email === undefined && data.role === undefined && data.isActive === undefined) {
        return badRequest(res, "VALIDATION_ERROR", "Nothing to update.");
    }

    // BR-23: an administrator cannot lock themselves out by deactivating their own account.
    if (data.isActive === false && userId === req.user!.id) {
        return badRequest(res, "CANNOT_DEACTIVATE_SELF", "You cannot deactivate your own account.");
    }

    try {
        // Serializable: two administrators deactivating each other at the same instant would
        // otherwise both pass the "another administrator remains" check and leave none (BR-24).
        const outcome: Outcome = await getPrisma().$transaction(
            async (tx): Promise<Outcome> => {
                const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
                if (!target) return { kind: "not-found" };

                if (data.email) {
                    const clash = await tx.user.findFirst({
                        where: { email: { equals: data.email, mode: "insensitive" }, id: { not: userId } },
                        select: { id: true },
                    });
                    if (clash) return { kind: "duplicate" };
                }

                const otherActiveAdministrators = await tx.user.count({
                    where: { role: "ADMINISTRATOR", isActive: true, id: { not: userId } },
                });
                if (leavesNoActiveAdministrator(target, { role: data.role, isActive: data.isActive }, otherActiveAdministrators)) {
                    return { kind: "last-admin" };
                }

                const user = await tx.user.update({
                    where: { id: userId },
                    data: { name: data.name, email: data.email, role: data.role, isActive: data.isActive },
                    select: USER_SELECT,
                });

                // BR-30: a deactivated account loses its sessions for good, so that reactivating it
                // later cannot bring an old session back to life.
                if (data.isActive === false) await tx.session.deleteMany({ where: { userId } });

                return { kind: "ok", user };
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        if (outcome.kind === "not-found") return notFound(res);
        if (outcome.kind === "duplicate") return duplicateEmail(res);
        if (outcome.kind === "last-admin") {
            return badRequest(
                res,
                "LAST_ADMINISTRATOR",
                "At least one active administrator must remain. Promote another administrator first."
            );
        }

        res.status(200).json(outcome.user);
    } catch (err) {
        if (isUniqueViolation(err)) return duplicateEmail(res);
        if (isSerializationFailure(err)) {
            res.status(409).json({
                error: { code: "CONCURRENT_UPDATE", message: "Another change happened at the same time. Please retry." },
            });
            return;
        }
        serverError(res, "PATCH /api/admin/users/:id", err, "Failed to update the user. Please try again.");
    }
});

// PATCH /api/admin/users/:id/reset-password: AC-21, BR-11, BR-26, BR-30.
adminRouter.patch("/users/:id/reset-password", async (req: Request, res: Response) => {
    const userId = parseId(req.params.id);
    if (!userId) return notFound(res);

    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    const problems = validatePasswordComplexity(newPassword);
    if (problems.length > 0) {
        return badRequest(res, "VALIDATION_ERROR", "The new password is invalid.", { newPassword: problems.join(" ") });
    }

    try {
        const prisma = getPrisma();
        const passwordHash = await hashPassword(newPassword);

        // One transaction: the new credential and the end of every old session happen together (BR-30).
        const [updated] = await prisma.$transaction([
            prisma.user.updateMany({ where: { id: userId }, data: { passwordHash, mustChangePassword: true } }),
            prisma.session.deleteMany({ where: { userId } }),
        ]);
        if (updated.count === 0) return notFound(res);

        res.status(200).json({ success: true });
    } catch (err) {
        serverError(res, "PATCH /api/admin/users/:id/reset-password", err, "Failed to reset the password. Please try again.");
    }
});