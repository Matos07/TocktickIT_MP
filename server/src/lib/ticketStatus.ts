export type TicketStatusValue =
    | "NEW"
    | "OPEN"
    | "IN_PROGRESS"
    | "WAITING_FOR_REQUESTER"
    | "RESOLVED"
    | "CLOSED"
    | "REOPENED"
    | "CANCELLED";

// specification.md §5.1: the single source of truth for BR-17. CANCELLED is the only dead end.
export const STATUS_TRANSITIONS: Record<TicketStatusValue, TicketStatusValue[]> = {
    NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
    OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
    IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
    RESOLVED: ["CLOSED", "REOPENED"],
    CLOSED: ["REOPENED"],
    REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
    CANCELLED: [],
};

const ALL_STATUSES = Object.keys(STATUS_TRANSITIONS) as TicketStatusValue[];

// Own-keys check on purpose: a plain `in` test would accept "toString".
export function isTicketStatus(value: unknown): value is TicketStatusValue {
    return typeof value === "string" && ALL_STATUSES.includes(value as TicketStatusValue);
}

export function allowedTransitions(from: TicketStatusValue): TicketStatusValue[] {
    return STATUS_TRANSITIONS[from];
}

export function isTransitionAllowed(from: TicketStatusValue, to: TicketStatusValue): boolean {
    return STATUS_TRANSITIONS[from].includes(to);
}