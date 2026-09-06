import { RequestedPriority } from "@prisma/client";

export interface CreateTicketInput {
    categoryId?: unknown;
    relatedSystemId?: unknown;
    summary?: unknown;
    description?: unknown;
    requestedPriority?: unknown;
}

export interface ValidationResult {
    valid: boolean;
    fields: Record<string, string>;
    data: {
        categoryId: number;
        relatedSystemId: number;
        summary: string;
        description: string;
        requestedPriority: RequestedPriority;
    } | null;
}

const VALID_PRIORITIES: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH"];

// BR-11: Summary 5-120 trimmed chars, Description 10-2000 trimmed chars.
// BR-13: requestedPriority must be one of LOW/MEDIUM/HIGH, required.
export function validateCreateTicketInput(input: CreateTicketInput): ValidationResult {
    const fields: Record<string, string> = {};

    const categoryId = Number(input.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
        fields.categoryId = "categoryId is required and must be a valid id.";
    }

    const relatedSystemId = Number(input.relatedSystemId);
    if (!Number.isInteger(relatedSystemId) || relatedSystemId <= 0) {
        fields.relatedSystemId = "relatedSystemId is required and must be a valid id.";
    }

    const summary = typeof input.summary === "string" ? input.summary.trim() : "";
    if (summary.length < 5 || summary.length > 120) {
        fields.summary = "Summary must be 5-120 characters.";
    }

    const description = typeof input.description === "string" ? input.description.trim() : "";
    if (description.length < 10 || description.length > 2000) {
        fields.description = "Description must be 10-2000 characters.";
    }

    const requestedPriority = input.requestedPriority as RequestedPriority;
    if (!VALID_PRIORITIES.includes(requestedPriority)) {
        fields.requestedPriority = "requestedPriority must be one of LOW, MEDIUM, HIGH.";
    }

    if (Object.keys(fields).length > 0) {
        return { valid: false, fields, data: null };
    }

    return {
        valid: true,
        fields: {},
        data: { categoryId, relatedSystemId, summary, description, requestedPriority },
    };
}