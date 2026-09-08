import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useRequester } from "../context/RequesterContext.js";
import { fetchTicket, TicketDetail as TicketDetailType, TicketNotFoundError } from "../api/tickets.js";
import AttachmentSection from "../components/AttachmentSection.js";

type LoadState = "loading" | "success" | "not-found" | "error";

const PRIORITY_LABEL: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

export default function TicketDetail() {
    const { id } = useParams<{ id: string }>();
    const { requester } = useRequester();

    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [errorMessage, setErrorMessage] = useState("");
    const [ticket, setTicket] = useState<TicketDetailType | null>(null);

    const load = useCallback(async () => {
        if (!requester || !id) return;
        setLoadState("loading");
        try {
            const data = await fetchTicket(requester.id, Number(id));
            setTicket(data);
            setLoadState("success");
        } catch (err) {
            if (err instanceof TicketNotFoundError) {
                setLoadState("not-found");
                return;
            }
            setErrorMessage(err instanceof Error ? err.message : "Failed to load ticket.");
            setLoadState("error");
        }
    }, [requester, id]);

    useEffect(() => {
        load();
    }, [load]);

    if (loadState === "loading") {
        return (
            <div className="container py-4">
                <p>Loading ticket…</p>
            </div>
        );
    }

    if (loadState === "not-found") {
        return (
            <div className="container py-4">
                <div className="alert alert-warning">
                    <strong>Ticket not found</strong>
                    <p className="mb-0 mt-1">
                        This ticket doesn't exist, or doesn't belong to the current requester.
                    </p>
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

    if (!ticket || !requester) return null;

    const fieldStyle = { backgroundColor: "#F1F3EE", border: "none" };

    return (
        <div className="container py-4" style={{ maxWidth: 800 }}>
            <h1 className="h4 mb-4">Ticket <span>{ticket.ticketNumber}</span></h1>

            <div className="card mb-4">
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-6 col-md-3">
                            <label htmlFor="ticket-number" className="form-label small fw-semibold">Ticket No.</label>
                            <input id="ticket-number" className="form-control" style={fieldStyle} readOnly value={ticket.ticketNumber} />
                        </div>
                        <div className="col-6 col-md-3">
                            <label htmlFor="ticket-date" className="form-label small fw-semibold">Ticket Date</label>
                            <input
                                id="ticket-date"
                                className="form-control"
                                style={fieldStyle}
                                readOnly
                                value={new Date(ticket.createdAt).toLocaleString()}
                            />
                        </div>
                        <div className="col-6 col-md-3">
                            <span className="form-label small fw-semibold d-block">Requested Priority</span>
                            <div>
                                <span className="badge bg-light text-dark border">
                                    {PRIORITY_LABEL[ticket.requestedPriority]}
                                </span>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <span className="form-label small fw-semibold d-block">Current Status</span>
                            <div>
                                <span className="badge" style={{ backgroundColor: "#EAF6EF", color: "#0B7A46" }}>
                                    {ticket.currentStatus}
                                </span>
                            </div>
                        </div>

                        <div className="col-12">
                            <label htmlFor="ticket-summary" className="form-label small fw-semibold">Summary</label>
                            <input id="ticket-summary" className="form-control" style={fieldStyle} readOnly value={ticket.summary} />
                        </div>

                        <div className="col-12">
                            <label htmlFor="ticket-description" className="form-label small fw-semibold">Description</label>
                            <textarea
                                id="ticket-description"
                                className="form-control"
                                style={fieldStyle}
                                readOnly
                                rows={4}
                                value={ticket.description}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <AttachmentSection
                requesterId={requester.id}
                ticketId={ticket.id}
                attachments={ticket.attachments}
                onChange={load}
            />
        </div>
    );
}