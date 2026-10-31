import { useCallback, useEffect, useState, FormEvent } from "react";
import { fetchComments, postComment, PublicCommentDto } from "../api/tickets.js";
import { RoleBadge } from "./Badges.js";

const MAX_LENGTH = 2000; // BR-19

export default function CommentsSection({ ticketId }: { ticketId: number }) {
    const [comments, setComments] = useState<PublicCommentDto[]>([]);
    const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading");
    const [loadError, setLoadError] = useState("");
    const [content, setContent] = useState("");
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState("");

    const load = useCallback(async () => {
        try {
            setComments(await fetchComments(ticketId));
            setLoadState("success");
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : "Failed to load comments.");
            setLoadState("error");
        }
    }, [ticketId]);

    useEffect(() => {
        load();
    }, [load]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmed = content.trim();
        if (!trimmed) return;

        setPosting(true);
        setPostError("");
        try {
            await postComment(ticketId, trimmed);
            setContent("");
            await load();
        } catch (err) {
            setPostError(err instanceof Error ? err.message : "Failed to post comment.");
        } finally {
            setPosting(false);
        }
    }

    return (
        <div className="card mt-4">
            <div className="card-header fw-semibold" style={{ backgroundColor: "#EAF6EF" }}>
                Public Comments <span className="text-muted small">({comments.length})</span>
            </div>
            <div className="card-body">
                <form onSubmit={handleSubmit} className="mb-3">
                    <label htmlFor="new-comment" className="form-label small fw-semibold">
                        Add Public Comment
                    </label>
                    <textarea
                        id="new-comment"
                        className="form-control mb-2"
                        rows={3}
                        maxLength={MAX_LENGTH}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        disabled={posting}
                    />
                    {postError && <div className="text-danger small mb-2">{postError}</div>}
                    <button type="submit" className="btn btn-success btn-sm" disabled={posting || !content.trim()}>
                        {posting ? "Posting…" : "Post Comment"}
                    </button>
                </form>

                {loadState === "loading" && <p className="text-muted small mb-0">Loading comments…</p>}
                {loadState === "error" && <div className="alert alert-danger py-2 mb-0">{loadError}</div>}
                {loadState === "success" && comments.length === 0 && (
                    <p className="text-muted small mb-0">No comments yet.</p>
                )}
                {loadState === "success" && comments.length > 0 && (
                    <ul className="list-group">
                        {comments.map((c) => (
                            <li key={c.id} className="list-group-item">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                        <strong>{c.authorName}</strong>
                                        <span className="ms-2">
                                            <RoleBadge value={c.authorRole} />
                                        </span>
                                    </div>
                                    <span className="text-muted small">{new Date(c.createdAt).toLocaleString()}</span>
                                </div>
                                <div style={{ whiteSpace: "pre-wrap" }}>{c.content}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}