import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    Assignee,
    assignTicket,
    claimTicket,
    fetchAssignees,
    fetchStaffTicket,
    setItPriority,
    setTicketStatus,
    StaffTicketDetail as TicketDetailData,
} from "../api/staff.js";
import { ForbiddenError } from "../api/http.js";
import { RequestedPriority, TicketNotFoundError, TicketStatus } from "../api/tickets.js";
import { PriorityBadge } from "../components/Badges.js";
import CommentsSection from "../components/CommentsSection.js";
import InternalNotesSection from "../components/InternalNotesSection.js";
import StaffAttachmentList from "../components/StaffAttachmentList.js";
import { PRIORITY_LABEL, STATUS_LABEL } from "../lib/labels.js";
import { Forbidden } from "../routes/RequireRole.js";

type LoadState = "loading" | "success" | "not-found" | "forbidden" | "error";

// BR-29: statuses that end or close the work ask for confirmation first.
const CONFIRM_MESSAGES: Partial<Record<TicketStatus, string>> = {
    CANCELLED: "Cancel this ticket? A cancelled ticket cannot be changed again.",
    CLOSED: "Close this ticket? It can still be reopened later.",
};

const readOnlyStyle = { backgroundColor: "#F1F3EE", border: "none" };

export default function StaffTicketDetail() {
    const { id } = useParams<{ id: string }>();

    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [errorMessage, setErrorMessage] = useState("");
    const [ticket, setTicket] = useState<TicketDetailData | null>(null);
    const [assignees, setAssignees] = useState<Assignee[]>([]);
    const [saving, setSaving] = useState(false);
    const [actionError, setActionError] = useState("");
    const [notice, setNotice] = useState("");
    const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null);

    const load = useCallback(
        async (silent = false) => {
            const ticketId = Number(id);
            if (!Number.isInteger(ticketId) || ticketId <= 0) {
                setLoadState("not-found");
                return;
            }
            if (!silent) setLoadState("loading");
            try {
                setTicket(await fetchStaffTicket(ticketId));
                setLoadState("success");
            } catch (err) {
                if (silent) return; // keep what is on screen; the action error is already shown
                if (err instanceof TicketNotFoundError) setLoadState("not-found");
                else if (err instanceof ForbiddenError) setLoadState("forbidden");
                else {
                    setErrorMessage(err instanceof Error ? err.message : "Failed to load the ticket.");
                    setLoadState("error");
                }
            }
        },
        [id]
    );

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        // Non-blocking: without it the owner menu simply lists the current owner only.
        fetchAssignees().then(setAssignees).catch(() => { });
    }, []);

    if (loadState === "loading") {
        return (
            <div className="container py-4">
                <p>Loading ticket…</p>
            </div>
        );
    }
    if (loadState === "forbidden") return <Forbidden />;
    if (loadState === "not-found") {
        return (
            <div className="container py-4">
                <div className="alert alert-warning">
                    <strong>Ticket not found</strong>
                    <p className="mb-2 mt-1">This ticket doesn't exist.</p>
                    <Link to="/queue" className="btn btn-outline-secondary btn-sm">
                        ← Back to Queue
                    </Link>
                </div>
            </div>
        );
    }
    if (loadState === "error") {
        return (
            <div className="container py-4">
                <div className="alert alert-danger">
                    <strong>Unable to load ticket</strong>
                    <p className="mb-0 mt-1">{errorMessage}</p>
                </div>
            </div>
        );
    }
    if (!ticket) return null;

    // Runs one operation, then replaces the whole ticket with the server's answer.
    async function runAction(action: () => Promise<TicketDetailData>) {
        setSaving(true);
        setActionError("");
        setNotice("");
        try {
            setTicket(await action());
            setNotice("Ticket updated.");
        } catch (err) {
            if (err instanceof ForbiddenError) {
                setLoadState("forbidden");
                return;
            }
            setActionError(err instanceof Error ? err.message : "The change could not be saved.");
            await load(true); // resync: someone else may have changed the ticket
        } finally {
            setSaving(false);
            setPendingStatus(null);
        }
    }

    const current = ticket;

    function handleOwnerChange(e: ChangeEvent<HTMLSelectElement>) {
        const ownerId = Number(e.target.value);
        if (ownerId) runAction(() => assignTicket(current.id, ownerId));
    }

    function handlePriorityChange(e: ChangeEvent<HTMLSelectElement>) {
        runAction(() => setItPriority(current.id, e.target.value as RequestedPriority));
    }

    function handleStatusChange(e: ChangeEvent<HTMLSelectElement>) {
        const next = e.target.value as TicketStatus;
        if (next === current.currentStatus) return;
        if (CONFIRM_MESSAGES[next]) {
            setPendingStatus(next); // nothing is sent until the user confirms
            return;
        }
        runAction(() => setTicketStatus(current.id, next));
    }

    const ownerListed = current.ticketOwnerId === null || assignees.some((a) => a.id === current.ticketOwnerId);
    const statusOptions = [current.currentStatus, ...current.allowedTransitions];

    return (
        <div className="container py-4" style={{ maxWidth: 900 }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1 className="h4 mb-0">
                    Ticket <span>{current.ticketNumber}</span>
                </h1>
                <Link to="/queue" className="btn btn-outline-secondary btn-sm">
                    ← Back to Queue
                </Link>
            </div>

            <div className="card">
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-6 col-md-3">
                            <label htmlFor="staff-ticket-number" className="form-label small fw-semibold">Ticket No.</label>
                            <input id="staff-ticket-number" className="form-control" style={readOnlyStyle} readOnly value={current.ticketNumber} />
                        </div>
                        <div className="col-6 col-md-3">
                            <label htmlFor="staff-ticket-date" className="form-label small fw-semibold">Ticket Date</label>
                            <input
                                id="staff-ticket-date"
                                className="form-control"
                                style={readOnlyStyle}
                                readOnly
                                value={new Date(current.createdAt).toLocaleString()}
                            />
                        </div>
                        <div className="col-6 col-md-3">
                            <label htmlFor="staff-requester" className="form-label small fw-semibold">Requester</label>
                            <input id="staff-requester" className="form-control" style={readOnlyStyle} readOnly value={current.requesterName} />
                        </div>
                        <div className="col-6 col-md-3">
                            <span className="form-label small fw-semibold d-block">Requested Priority</span>
                            <PriorityBadge value={current.requestedPriority} />
                        </div>
                        <div className="col-6">
                            <label htmlFor="staff-category" className="form-label small fw-semibold">Category</label>
                            <input id="staff-category" className="form-control" style={readOnlyStyle} readOnly value={current.categoryName} />
                        </div>
                        <div className="col-6">
                            <label htmlFor="staff-related-system" className="form-label small fw-semibold">Related System</label>
                            <input id="staff-related-system" className="form-control" style={readOnlyStyle} readOnly value={current.relatedSystemName} />
                        </div>
                        <div className="col-12">
                            <label htmlFor="staff-summary" className="form-label small fw-semibold">Summary</label>
                            <input id="staff-summary" className="form-control" style={readOnlyStyle} readOnly value={current.summary} />
                        </div>
                        <div className="col-12">
                            <label htmlFor="staff-description" className="form-label small fw-semibold">Description</label>
                            <textarea id="staff-description" className="form-control" style={readOnlyStyle} readOnly rows={4} value={current.description} />
                        </div>
                    </div>

                    <hr className="my-4" />
                    <h2 className="h6 mb-3">Handling</h2>

                    <div className="row g-3">
                        <div className="col-12 col-md-5">
                            <label htmlFor="ticket-owner" className="form-label small fw-semibold">Ticket Owner</label>
                            <div className="d-flex gap-2">
                                <select
                                    id="ticket-owner"
                                    className="form-select"
                                    value={current.ticketOwnerId ?? ""}
                                    onChange={handleOwnerChange}
                                    disabled={saving}
                                >
                                    {current.ticketOwnerId === null && (
                                        <option value="" disabled>
                                            Unassigned
                                        </option>
                                    )}
                                    {!ownerListed && <option value={current.ticketOwnerId!}>{current.ticketOwnerName}</option>}
                                    {assignees.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}
                                        </option>
                                    ))}
                                </select>
                                {current.ticketOwnerId === null && (
                                    <button
                                        className="btn btn-success text-nowrap"
                                        onClick={() => runAction(() => claimTicket(current.id))}
                                        disabled={saving}
                                    >
                                        Claim this ticket
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="col-6 col-md-3">
                            <label htmlFor="ticket-it-priority" className="form-label small fw-semibold">IT Priority</label>
                            <select
                                id="ticket-it-priority"
                                className="form-select"
                                value={current.itPriority ?? ""}
                                onChange={handlePriorityChange}
                                disabled={saving}
                            >
                                {current.itPriority === null && (
                                    <option value="" disabled>
                                        Not set
                                    </option>
                                )}
                                {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-6 col-md-4">
                            <label htmlFor="ticket-status" className="form-label small fw-semibold">Current Status</label>
                            <select
                                id="ticket-status"
                                className="form-select"
                                value={pendingStatus ?? current.currentStatus}
                                onChange={handleStatusChange}
                                disabled={saving || current.allowedTransitions.length === 0}
                            >
                                {statusOptions.map((s) => (
                                    <option key={s} value={s}>
                                        {STATUS_LABEL[s] ?? s}
                                    </option>
                                ))}
                            </select>
                            {current.allowedTransitions.length === 0 && (
                                <div className="form-text">
                                    No further changes are possible for a {(STATUS_LABEL[current.currentStatus] ?? "").toLowerCase()} ticket.
                                </div>
                            )}
                        </div>
                    </div>

                    {pendingStatus && (
                        <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2 mt-3 mb-0" role="alert">
                            <span>{CONFIRM_MESSAGES[pendingStatus]}</span>
                            <button
                                className="btn btn-danger btn-sm"
                                onClick={() => runAction(() => setTicketStatus(current.id, pendingStatus))}
                                disabled={saving}
                            >
                                Confirm
                            </button>
                            <button className="btn btn-outline-secondary btn-sm" onClick={() => setPendingStatus(null)} disabled={saving}>
                                Go back
                            </button>
                        </div>
                    )}

                    <div role="status" className="small mt-3" style={{ color: "#0B7A46", minHeight: "1.25rem" }}>
                        {saving ? "Saving…" : notice}
                    </div>
                    {actionError && (
                        <div className="alert alert-danger mt-2 mb-0" role="alert">
                            {actionError}
                        </div>
                    )}

                    {current.requesterConfirmedResolved && (
                        <div
                            className="mt-3 p-2 small"
                            style={{ backgroundColor: "#EAF6EF", border: "1px solid #0B7A46", color: "#0B7A46" }}
                        >
                            The requester indicated this problem appears resolved. Review it, then resolve or close the ticket.
                        </div>
                    )}
                </div>
            </div>

            <StaffAttachmentList attachments={current.attachments} />
            <CommentsSection ticketId={current.id} />
            <InternalNotesSection ticketId={current.id} />
        </div>
    );
}