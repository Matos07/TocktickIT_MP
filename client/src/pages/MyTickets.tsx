import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useRequester } from "../context/RequesterContext.js";
import { fetchTickets, TicketListItem } from "../api/tickets.js";
import { fetchCategories, Category } from "../api/categories.js";
import { useIsMobile } from "../hooks/useIsMobile.js";

type LoadState = "loading" | "success" | "error";

const PRIORITY_BADGE: Record<string, string> = {
    LOW: "bg-light text-success border border-success",
    MEDIUM: "bg-warning-subtle text-warning-emphasis",
    HIGH: "bg-danger-subtle text-danger-emphasis",
};

function PriorityBadge({ value }: { value: string | null }) {
    if (!value) return <span className="text-muted small">—</span>;
    return <span className={`badge ${PRIORITY_BADGE[value] ?? "bg-secondary"}`}>{value}</span>;
}

function StatusBadge({ value }: { value: string }) {
    return <span className="badge" style={{ backgroundColor: "#EAF6EF", color: "#0B7A46" }}>{value}</span>;
}

export default function MyTickets() {
    const { requester } = useRequester();

    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [errorMessage, setErrorMessage] = useState("");
    const [tickets, setTickets] = useState<TicketListItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const isMobile = useIsMobile();
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

    const [search, setSearch] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [requestedPriority, setRequestedPriority] = useState("");
    const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "ticketNumber">("createdAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(1);

    const [pagination, setPagination] = useState({ page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });

    const hasActiveFilters = search !== "" || categoryId !== "" || requestedPriority !== "";

    const load = useCallback(async () => {
        if (!requester) return;
        setLoadState("loading");
        try {
            const res = await fetchTickets(requester.id, {
                search: search || undefined,
                categoryId: categoryId ? Number(categoryId) : undefined,
                requestedPriority: (requestedPriority as "LOW" | "MEDIUM" | "HIGH") || undefined,
                sortBy,
                sortOrder,
                page,
            });
            setTickets(res.data);
            setPagination(res.pagination);
            setLoadState("success");
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to load tickets.");
            setLoadState("error");
        }
    }, [requester, search, categoryId, requestedPriority, sortBy, sortOrder, page]);

    useEffect(() => {
        setPage(1);
    }, [requester?.id]);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]);

    useEffect(() => {
        fetchCategories()
            .then(setCategories)
            .catch(() => {
                // Non-blocking: the filter dropdown just stays empty if this fails.
            });
    }, []);

    function clearFilters() {
        setSearch("");
        setCategoryId("");
        setRequestedPriority("");
        setPage(1);
    }

    return (
        <div className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h4 mb-1">My Tickets</h1>
                    <p className="text-muted small mb-0">View and track all of your support requests.</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-outline-secondary" onClick={clearFilters}>
                        Clear Filters
                    </button>
                    <Link className="btn btn-success" to="/create-ticket">
                        + Create Ticket
                    </Link>
                </div>
            </div>

            <div className="row g-2 mb-3">
                <div className="col-12 col-md-4">
                    <label htmlFor="search" className="form-label small fw-semibold">
                        Search
                    </label>
                    <input
                        id="search"
                        type="text"
                        className="form-control"
                        placeholder="Search by ticket number or summary…"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
                <div className="col-6 col-md-3">
                    <label htmlFor="category-filter" className="form-label small fw-semibold">
                        Category
                    </label>
                    <select
                        id="category-filter"
                        className="form-select"
                        value={categoryId}
                        onChange={(e) => {
                            setCategoryId(e.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">All Categories</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-6 col-md-3">
                    <label htmlFor="priority-filter" className="form-label small fw-semibold">
                        Requested Priority
                    </label>
                    <select
                        id="priority-filter"
                        className="form-select"
                        value={requestedPriority}
                        onChange={(e) => {
                            setRequestedPriority(e.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">All Priorities</option>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                    </select>
                </div>
                <div className="col-6 col-md-2">
                    <label htmlFor="sort-by" className="form-label small fw-semibold">
                        Sort By
                    </label>
                    <select
                        id="sort-by"
                        className="form-select"
                        value={`${sortBy}:${sortOrder}`}
                        onChange={(e) => {
                            const [field, order] = e.target.value.split(":");
                            setSortBy(field as typeof sortBy);
                            setSortOrder(order as typeof sortOrder);
                        }}
                    >
                        <option value="createdAt:desc">Newest first</option>
                        <option value="createdAt:asc">Oldest first</option>
                        <option value="updatedAt:desc">Last updated</option>
                        <option value="ticketNumber:asc">Ticket No. (A–Z)</option>
                    </select>
                </div>
            </div>

            {loadState === "loading" && <p>Loading tickets…</p>}

            {loadState === "error" && (
                <div className="alert alert-danger">
                    <strong>Unable to load tickets</strong>
                    <p className="mb-0 mt-1">{errorMessage}</p>
                </div>
            )}

            {loadState === "success" && tickets.length === 0 && !hasActiveFilters && (
                <div className="alert" style={{ backgroundColor: "#F5F7F6", border: "1px solid #E0E0E0" }}>
                    <p className="mb-3">You don't have any tickets yet.</p>
                    <Link className="btn btn-success" to="/create-ticket">
                        Create your first ticket
                    </Link>
                </div>
            )}

            {loadState === "success" && tickets.length === 0 && hasActiveFilters && (
                <div className="alert alert-secondary">
                    <p className="mb-2">No tickets match your search or filters.</p>
                    <button className="btn btn-outline-secondary btn-sm" onClick={clearFilters}>
                        Clear Filters
                    </button>
                </div>
            )}

            {loadState === "success" && tickets.length > 0 && (
                <>
                    {isMobile ? (
                        <ul className="list-group">
                            {tickets.map((t) => (
                                <li key={t.id} className="list-group-item">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <Link to={`/tickets/${t.id}`} className="fw-semibold">
                                            {t.ticketNumber}
                                        </Link>
                                        <StatusBadge value={t.currentStatus} />
                                    </div>
                                    <div className="mb-2">{t.summary}</div>
                                    <div className="text-muted small d-flex flex-wrap gap-2 align-items-center">
                                        <span>{categoryNameById.get(t.categoryId) ?? "—"}</span>
                                        <span>·</span>
                                        <PriorityBadge value={t.requestedPriority} />
                                        <span>·</span>
                                        <span>Updated {new Date(t.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-middle">
                                <thead>
                                    <tr>
                                        <th>Ticket No.</th>
                                        <th>Created Date</th>
                                        <th>Summary</th>
                                        <th>Category</th>
                                        <th>Requested Priority</th>
                                        <th>Current Status</th>
                                        <th>Last Updated</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.map((t) => (
                                        <tr key={t.id}>
                                            <td>
                                                <Link to={`/tickets/${t.id}`}>{t.ticketNumber}</Link>
                                            </td>
                                            <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                                            <td>{t.summary}</td>
                                            <td>{categoryNameById.get(t.categoryId) ?? "—"}</td>
                                            <td>
                                                <PriorityBadge value={t.requestedPriority} />
                                            </td>
                                            <td>
                                                <StatusBadge value={t.currentStatus} />
                                            </td>
                                            <td>{new Date(t.updatedAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="d-flex justify-content-between align-items-center mt-3">
                        <span className="text-muted small">
                            Showing page {pagination.page} of {pagination.totalPages || 1} ({pagination.totalItems} tickets)
                        </span>
                        <div className="d-flex gap-2">
                            <button
                                className="btn btn-outline-secondary btn-sm"
                                disabled={pagination.page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Previous
                            </button>
                            <button
                                className="btn btn-outline-secondary btn-sm"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}