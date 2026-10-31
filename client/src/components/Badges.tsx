import { CSSProperties } from "react";
import { PRIORITY_LABEL, ROLE_LABEL, STATUS_LABEL } from "../lib/labels.js";

// Zen Green badge families. The label is always rendered, so meaning never relies on colour alone.
const base: CSSProperties = {
    display: "inline-block",
    padding: "0.25em 0.65em",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
};

const PALE_GREEN: CSSProperties = { backgroundColor: "#EAF6EF", color: "#0B7A46" };
const AMBER: CSSProperties = { backgroundColor: "#FCEFD8", color: "#8A5300" }; // darker text: >= 4.5:1 contrast
const RED: CSSProperties = { backgroundColor: "#FBE7E4", color: "#8A1F11" };
const SOLID_GREEN: CSSProperties = { backgroundColor: "#0B7A46", color: "#FFFFFF" };
const MUTED: CSSProperties = { backgroundColor: "#E9ECEA", color: "#5B6B63" };

const STATUS_STYLE: Record<string, CSSProperties> = {
    NEW: PALE_GREEN,
    OPEN: PALE_GREEN,
    IN_PROGRESS: PALE_GREEN,
    REOPENED: PALE_GREEN,
    WAITING_FOR_REQUESTER: AMBER,
    RESOLVED: SOLID_GREEN,
    CLOSED: SOLID_GREEN,
    CANCELLED: MUTED,
};

const PRIORITY_STYLE: Record<string, CSSProperties> = { LOW: PALE_GREEN, MEDIUM: AMBER, HIGH: RED };

export function StatusBadge({ value }: { value: string }) {
    return <span style={{ ...base, ...(STATUS_STYLE[value] ?? MUTED) }}>{STATUS_LABEL[value] ?? value}</span>;
}

export function PriorityBadge({ value }: { value: string | null }) {
    if (!value) {
        return (
            <span className="text-muted" title="Not set">
                —
            </span>
        );
    }
    return <span style={{ ...base, ...(PRIORITY_STYLE[value] ?? MUTED) }}>{PRIORITY_LABEL[value] ?? value}</span>;
}

export function RoleBadge({ value }: { value: string }) {
    return (
        <span style={{ ...base, backgroundColor: "#FFFFFF", color: "#3E5448", border: "1px solid #9DB5A8" }}>
            {ROLE_LABEL[value] ?? value}
        </span>
    );
}