import { useCallback, useEffect, useState, FormEvent } from "react";
import { PublicCommentDto } from "../api/tickets.js";
import { RoleBadge } from "./Badges.js";

const MAX_LENGTH = 2000; // BR-19

// Public comments and internal notes behave identically; only the look and the wording differ,
// so an internal note can never be mistaken for a public comment.
const THEME = {
    public: { header: "#EAF6EF", border: "#CFE6D8", button: "btn btn-success btn-sm" },
    internal: { header: "#FCEFD8", border: "#E0B15A", button: "btn btn-warning btn-sm" },
};

interface Props {
    ticketId: number;
    variant: "public" | "internal";
    title: string;
    notice?: string;
    inputLabel: string;
    submitLabel: string;
    emptyText: string;
    load: (ticketId: number) => Promise<PublicCommentDto[]>;
    post: (ticketId: number, content: string) => Promise<unknown>;
}

export default function ThreadSection({
    ticketId,
    variant,
    title,
    notice,
    inputLabel,
    submitLabel,
    emptyText,
    load,
    post,
}: Props) {
    const theme = THEME[variant];
    const inputId = `${variant}-thread-input`;

    const [items, setItems] = useState<PublicCommentDto[]>([]);
    const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading");
    const [loadError, setLoadError] = useState("");
    const [content, setContent] = useState("");
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState("");

    const reload = useCallback(async () => {
        try {
            setItems(await load(ticketId));
            setLoadState("success");
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : "Failed to load.");
            setLoadState("error");
        }
    }, [load, ticketId]);

    useEffect(() => {
        reload();
    }, [reload]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmed = content.trim();
        if (!trimmed) return;

        setPosting(true);
        setPostError("");
        try {
            await post(ticketId, trimmed);
            setContent("");
            await reload();
        } catch (err) {
            setPostError(err instanceof Error ? err.message : "Failed to post.");
        } finally {
            setPosting(false);
        }
    }

    return (
        <div className="card mt-4" style={{ borderColor: theme.border }}>
            <div className="card-header fw-semibold" style={{ backgroundColor: theme.header }}>
                {title} <span className="text-muted small">({items.length})</span>
            </div>
            <div className="card-body">
                {notice && (
                    <div className="small fw-semibold mb-3" style={{ color: "#8A5300" }}>
                        {notice}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mb-3">
                    <label htmlFor={inputId} className="form-label small fw-semibold">
                        {inputLabel}
                    </label>
                    <textarea
                        id={inputId}
                        className="form-control mb-2"
                        rows={3}
                        maxLength={MAX_LENGTH}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        disabled={posting}
                    />
                    {postError && <div className="text-danger small mb-2">{postError}</div>}
                    <button type="submit" className={theme.button} disabled={posting || !content.trim()}>
                        {posting ? "Posting…" : submitLabel}
                    </button>
                </form>

                {loadState === "loading" && <p className="text-muted small mb-0">Loading…</p>}
                {loadState === "error" && <div className="alert alert-danger py-2 mb-0">{loadError}</div>}
                {loadState === "success" && items.length === 0 && <p className="text-muted small mb-0">{emptyText}</p>}
                {loadState === "success" && items.length > 0 && (
                    <ul className="list-group">
                        {items.map((item) => (
                            <li key={item.id} className="list-group-item">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                        <strong>{item.authorName}</strong>
                                        <span className="ms-2">
                                            <RoleBadge value={item.authorRole} />
                                        </span>
                                    </div>
                                    <span className="text-muted small">{new Date(item.createdAt).toLocaleString()}</span>
                                </div>
                                {/* Plain text only: React escapes it, and nothing here uses dangerouslySetInnerHTML. */}
                                <div style={{ whiteSpace: "pre-wrap" }}>{item.content}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}