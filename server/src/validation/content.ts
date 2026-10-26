export const MAX_CONTENT_LENGTH = 2000;

// BR-19: required, trimmed, 1-2000 characters. Whitespace-only is rejected.
export function validateContent(raw: unknown): { value: string } | { error: string } {
    if (typeof raw !== "string") return { error: "Content is required." };

    const value = raw.trim();
    if (value.length === 0) return { error: "Content is required." };
    if (value.length > MAX_CONTENT_LENGTH) {
        return { error: `Content must be at most ${MAX_CONTENT_LENGTH} characters.` };
    }
    return { value };
}