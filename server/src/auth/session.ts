import { randomBytes } from "crypto";
import { getPrisma } from "../prisma.js";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // BR-10: 24h sliding expiry

export function generateSessionToken(): string {
    return randomBytes(32).toString("hex");
}

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
    const prisma = getPrisma();
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await prisma.session.create({ data: { id: token, userId, expiresAt } });
    return { token, expiresAt };
}

export async function validateSession(token: string | undefined) {
    if (!token) return null;
    const prisma = getPrisma();

    const session = await prisma.session.findUnique({
        where: { id: token },
        include: { user: true },
    });

    if (!session) return null;
    if (session.expiresAt.getTime() < Date.now()) {
        // Expired — clean up and treat as no session (BR-10).
        await prisma.session.delete({ where: { id: token } }).catch(() => { });
        return null;
    }
    if (!session.user.isActive) return null;

    return session.user;
}

export async function deleteSession(token: string | undefined): Promise<void> {
    if (!token) return;
    const prisma = getPrisma();
    await prisma.session.delete({ where: { id: token } }).catch(() => {
        // Idempotent: deleting an already-gone session is not an error.
    });
}