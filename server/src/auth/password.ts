import bcrypt from "bcryptjs";

const COST_FACTOR = 12;

export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, COST_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}

// BR-11: min 8 chars, upper, lower, digit, special character.
const COMPLEXITY_RULES: { test: (pw: string) => boolean; message: string }[] = [
    { test: (pw) => pw.length >= 8, message: "Password must be at least 8 characters." },
    { test: (pw) => /[A-Z]/.test(pw), message: "Password must include an uppercase letter." },
    { test: (pw) => /[a-z]/.test(pw), message: "Password must include a lowercase letter." },
    { test: (pw) => /\d/.test(pw), message: "Password must include a digit." },
    { test: (pw) => /[^A-Za-z0-9]/.test(pw), message: "Password must include a special character." },
];

export function validatePasswordComplexity(plain: string): string[] {
    return COMPLEXITY_RULES.filter((rule) => !rule.test(plain)).map((rule) => rule.message);
}