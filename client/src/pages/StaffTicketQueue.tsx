import { useCallback, useEffect, useRef, useState, ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { Assignee, fetchAssignees, fetchStaffTickets, StaffTicketListItem } from "../api/staff.js";
import { fetchCategories, Category } from "../api/categories.js";
import { ForbiddenError } from "../api/http.js";
import { RequestedPriority, TicketStatus } from "../api/tickets.js";
import { PriorityBadge, StatusBadge } from "../components/Badges.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { PRIORITY_LABEL, STATUS_LABEL } from "../lib/labels.js";
import { Forbidden } from "../routes/RequireRole.js";

type LoadState = "loading" | "success" | "error" | "forbidden";
type SortKey = "createdAt" | "updatedAt" | "ticketNumber";

const SORT_OPTIONS = [
    { value: "createdAt:desc", label: "Newest first" },
    { value: "createdAt:asc", label: "Oldest first" },
    { value: "updatedAt:desc", label: "Last updated" },
    { value: "ticketNumber:asc", label: "Ticket No. (A–Z)" },
    { value: "ticketNumber:desc", label: "Ticket No. (Z–A)" },
];

function OwnerName({ name }: { name: string | null }) {
    return name ? <>{name}</> : <em className="text-muted">Unassigned</em>;
}

export default function StaffTicketQueue() {
    const isMobile = useIsMobile();

    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [errorMessage, setErrorMessage] = useState("");
    const [tickets, setTickets] = useState<StaffTicketListItem[]>([]);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });

    const [categories, setCategories] = useState<Category[]>([]);
    const [assignees, setAssignees] = useState<Assignee[]>([]);

    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [ownerId, setOwnerId] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [requestedPriority, setRequestedPriority] = useState("");
    const [itPriority, setItPriority] = useState("");
    const [sort, setSort] = useState("createdAt:desc");
    const [page, setPage] = useState(1);

    const latestRequest = useRef(0);
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
    const hasActiveFilters = [search, status, ownerId, categoryId, requestedPriority, itPriority].some((v) => v !== "");

    const load = useCallback(async () => {
        const requestId = ++latestRequest.current;
        setLoadState("loading");
        const [sortBy, sortOrder] = sort.split(":") as [SortKey, "asc" | "desc"];

        try {
            const res = await fetchStaffTickets({
                search: search || undefined,
                status: (status as TicketStatus) || undefined,
                ownerId: ownerId === "" ? undefined : ownerId === "unassigned" ? "unassigned" : Number(ownerId),
                categoryId: categoryId ? Number(categoryId) : undefined,
                requestedPriority: (requestedPriority as RequestedPriority) || undefined,
                itPriority: (itPriority as RequestedPriority) || undefined,
                sortBy,
                sortOrder,
                page,
            });
            if (requestId !== latestRequest.current) return; // a newer request superseded this one
            setTickets(res.data);
            setPagination(res.pagination);
            setLoadState("success");
        } catch (err) {
            if (requestId !== latestRequest.current) return;
            if (err instanceof ForbiddenError) {
                setLoadState("forbidden");
                return;
            }
            setErrorMessage(err instanceof Error ? err.message : "Failed to load the ticket queue.");
            setLoadState("error");
        }
    }, [search, status, ownerId, categoryId, requestedPriority, itPriority, sort, page]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        // Non-blocking: the filter dropdowns simply stay short if these fail.
        fetchCategories().then(setCategories).catch(() => { });
        fetchAssignees().then(setAssignees).catch(() => { });
    }, []);

    // Any change to a filter or the sort goes back to the first page.
    const onChange =
        (setter: (value: string) => void) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            setter(e.target.value);
            setPage(1);
        };

    function clearFilters() {
        setSearch("");
        setStatus("");
        setOwnerId("");
        setCategoryId("");
        setRequestedPriority("");
        setItPriority("");
        setPage(1);
    }

    if (loadState === "forbidden") return <Forbidden />;

    const firstItem = pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
    const lastItem = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);

    return (
        <div className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h4 mb-1">Ticket Queue</h1>
                    <p className="text-muted small mb-0">Find, prioritize and open support requests from all requesters.</p>
                </div>
                <button className="btn btn-outline-secondary" onClick={clearFilters} disabled={!hasActiveFilters}>
                    Clear Filters
                </button>
            </div>

            <div className="row g-2 mb-3">
                <div className="col-12 col-lg-4">
                    <label htmlFor="queue-search" className="form-label small fw-semibold">
                        Search
                    </label>
                    <input
                        id="queue-search"
                        type="text"
                        className="form-control"
                        placeholder="Search by ticket number or summary…"
                        value={search}
                        onChange={onChange(setSearch)}
                    />
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                    <label htmlFor="queue-status" className="form-label small fw-semibold">
                        Status
                    </label>
                    <select id="queue-status" className="form-select" value={status} onChange={onChange(setStatus)}>
                        <option value="">All Statuses</option>
                        {Object.entries(STATUS_LABEL).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                    <label htmlFor="queue-owner" className="form-label small fw-semibold">
                        Owner
                    </label>
                    <select id="queue-owner" className="form-select" value={ownerId} onChange={onChange(setOwnerId)}>
                        <option value="">All Owners</option>
                        <option value="unassigned">Unassigned</option>
                        {assignees.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                    <label htmlFor="queue-category" className="form-label small fw-semibold">
                        Category
                    </label>
                    <select
                        id="queue-category"
                        className="form-select"
                        value={categoryId}
                        onChange={onChange(setCategoryId)}
                    >
                        <option value="">All Categories</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                    <label htmlFor="queue-req-priority" className="form-label small fw-semibold">
                        Requested Priority
                    </label>
                    <select
                        id="queue-req-priority"
                        className="form-select"
                        value={requestedPriority}
                        onChange={onChange(setRequestedPriority)}
                    >
                        <option value="">All Priorities</option>
                        {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                    <label htmlFor="queue-it-priority" className="form-label small fw-semibold">
                        IT Priority
                    </label>
                    <select
                        id="queue-it-priority"
                        className="form-select"
                        value={itPriority}
                        onChange={onChange(setItPriority)}
                    >
                        <option value="">All Priorities</option>
                        {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                    <label htmlFor="queue-sort" className="form-label small fw-semibold">
                        Sort By
                    </label>
                    <select id="queue-sort" className="form-select" value={sort} onChange={onChange(setSort)}>
                        {SORT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loadState === "loading" && <p>Loading ticket queue…</p>}

            {loadState === "error" && (
                <div className="alert alert-danger" role="alert">
                    <strong>Unable to load the ticket queue</strong>
                    <p className="mb-0 mt-1">{errorMessage}</p>
                </div>
            )}

            {loadState === "success" && tickets.length === 0 && !hasActiveFilters && (
                <div className="alert" style={{ backgroundColor: "#F5F7F6", border: "1px solid #E0E0E0" }}>
                    The ticket queue is empty. No tickets have been submitted yet.
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
                                        <Link to={`/staff/tickets/${t.id}`} className="fw-semibold">
                                            {t.ticketNumber}
                                        </Link>
                                        <StatusBadge value={t.currentStatus} />
                                    </div>
                                    <div className="mb-2">{t.summary}</div>
                                    <div className="text-muted small d-flex flex-wrap gap-2 align-items-center">
                                        <span>{categoryNameById.get(t.categoryId) ?? "—"}</span>
                                        <span>·</span>
                                        <PriorityBadge value={t.requestedPriority} />
                                        <span>→</span>
                                        <PriorityBadge value={t.itPriority} />
                                        <span>·</span>
                                        <OwnerName name={t.ticketOwnerName} />
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
                                        <th>Created</th>
                                        <th>Summary</th>
                                        <th>Category</th>
                                        <th>Req. Priority</th>
                                        <th>IT Priority</th>
                                        <th>Status</th>
                                        <th>Owner</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.map((t) => (
                                        <tr key={t.id}>
                                            <td>
                                                <Link to={`/staff/tickets/${t.id}`}>{t.ticketNumber}</Link>
                                            </td>
                                            <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                                            <td>{t.summary}</td>
                                            <td>{categoryNameById.get(t.categoryId) ?? "—"}</td>
                                            <td>
                                                <PriorityBadge value={t.requestedPriority} />
                                            </td>
                                            <td>
                                                <PriorityBadge value={t.itPriority} />
                                            </td>
                                            <td>
                                                <StatusBadge value={t.currentStatus} />
                                            </td>
                                            <td>
                                                <OwnerName name={t.ticketOwnerName} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="d-flex justify-content-between align-items-center mt-3">
                        <span className="text-muted small">
                            Showing {firstItem}–{lastItem} of {pagination.totalItems} tickets
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