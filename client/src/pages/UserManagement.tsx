import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
    AdminUser,
    createUser,
    fetchUsers,
    resetUserPassword,
    updateUser,
    UserApiError,
    UserChanges,
    UserRole,
} from "../api/admin.js";
import { ForbiddenError } from "../api/http.js";
import { ActiveBadge, RoleBadge } from "../components/Badges.js";
import { useAuth } from "../context/AuthContext.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { ROLE_LABEL } from "../lib/labels.js";
import { Forbidden } from "../routes/RequireRole.js";

type LoadState = "loading" | "success" | "error" | "forbidden";
type PanelState = { mode: "create" } | { mode: "edit"; user: AdminUser } | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RULES = "At least 8 characters, with upper and lower case letters, a number and a special character.";
const SELF_DEACTIVATION_LOCK = "You cannot deactivate your own account.";

// Same rules as the server (BR-11). The server stays the authority; this only saves a round trip.
function isStrongPassword(password: string): boolean {
    return (
        password.length >= 8 &&
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /\d/.test(password) &&
        /[^A-Za-z0-9]/.test(password)
    );
}

interface PanelProps {
    mode: "create" | "edit";
    user?: AdminUser;
    selfId: number;
    onClose: () => void;
    onDone: (message: string) => void;
    onForbidden: () => void;
}

function UserPanel({ mode, user, selfId, onClose, onDone, onForbidden }: PanelProps) {
    const target = mode === "edit" && user ? user : null;
    const isSelf = target !== null && target.id === selfId;

    const [name, setName] = useState(target?.name ?? "");
    const [email, setEmail] = useState(target?.email ?? "");
    const [role, setRole] = useState<UserRole>(target?.role ?? "REQUESTER");
    const [isActive, setIsActive] = useState(true); // create mode only
    const [initialPassword, setInitialPassword] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState("");
    const [info, setInfo] = useState("");
    const [saving, setSaving] = useState(false);
    const [confirmDeactivate, setConfirmDeactivate] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [newPassword, setNewPassword] = useState("");

    // Runs one API call. Field messages from the server go under their inputs; anything
    // unexpected stays generic so no internal detail ever reaches the screen.
    async function run(action: () => Promise<unknown>, successMessage: string) {
        setSaving(true);
        setFormError("");
        setInfo("");
        setFieldErrors({});
        try {
            await action();
            onDone(successMessage);
        } catch (err) {
            if (err instanceof ForbiddenError) {
                onForbidden();
                return;
            }
            if (err instanceof UserApiError) {
                const fields = err.fields ?? {};
                setFieldErrors(fields);
                setFormError(Object.keys(fields).length > 0 ? "" : err.message);
            } else {
                setFormError("Something went wrong. Please try again.");
            }
            setConfirmDeactivate(false);
        } finally {
            setSaving(false);
        }
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();

        const errors: Record<string, string> = {};
        if (!trimmedName) errors.name = "Name is required.";
        else if (trimmedName.length > 100) errors.name = "Name must be 100 characters or fewer.";
        if (!trimmedEmail) errors.email = "Email address is required.";
        else if (!EMAIL_PATTERN.test(trimmedEmail)) errors.email = "Enter a valid email address.";
        if (!target && !isStrongPassword(initialPassword)) errors.initialPassword = "Password does not meet the rules above.";

        setFieldErrors(errors);
        setFormError("");
        setInfo("");
        if (Object.keys(errors).length > 0) return;

        if (!target) {
            await run(
                () => createUser({ name: trimmedName, email: trimmedEmail, role, isActive, initialPassword }),
                "User created."
            );
            return;
        }

        const changes: UserChanges = {};
        if (trimmedName !== target.name) changes.name = trimmedName;
        if (trimmedEmail.toLowerCase() !== target.email) changes.email = trimmedEmail;
        if (role !== target.role) changes.role = role;
        if (Object.keys(changes).length === 0) {
            setInfo("No changes to save.");
            return;
        }
        await run(() => updateUser(target.id, changes), "User updated.");
    }

    async function handleApplyReset() {
        if (!target) return;
        if (!isStrongPassword(newPassword)) {
            setFieldErrors({ newPassword: "Password does not meet the rules above." });
            return;
        }
        await run(
            () => resetUserPassword(target.id, newPassword),
            "New initial password set. The user must change it at next login."
        );
    }

    function cancelReset() {
        setResetOpen(false);
        setNewPassword("");
        setFieldErrors({});
    }

    return (
        <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
                <h2 className="h6 mb-0">{target ? "Edit User" : "Create New User"}</h2>
                <button type="button" className="btn-close" aria-label="Close panel" onClick={onClose} />
            </div>
            <div className="card-body">
                <form onSubmit={handleSubmit} noValidate>
                    {info && (
                        <div className="alert alert-secondary py-2" role="status">
                            {info}
                        </div>
                    )}
                    {formError && (
                        <div className="alert alert-danger py-2" role="alert">
                            {formError}
                        </div>
                    )}

                    <div className="mb-3">
                        <label htmlFor="user-name" className="form-label small fw-semibold">
                            Full Name <span className="text-danger">*</span>
                        </label>
                        <input
                            id="user-name"
                            className={`form-control ${fieldErrors.name ? "is-invalid" : ""}`}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={saving}
                        />
                        {fieldErrors.name && <div className="invalid-feedback d-block">{fieldErrors.name}</div>}
                    </div>

                    <div className="mb-3">
                        <label htmlFor="user-email" className="form-label small fw-semibold">
                            Email Address <span className="text-danger">*</span>
                        </label>
                        <input
                            id="user-email"
                            type="email"
                            className={`form-control ${fieldErrors.email ? "is-invalid" : ""}`}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={saving}
                        />
                        {fieldErrors.email && <div className="invalid-feedback d-block">{fieldErrors.email}</div>}
                    </div>

                    <div className="mb-3">
                        <label htmlFor="user-role" className="form-label small fw-semibold">
                            Role <span className="text-danger">*</span>
                        </label>
                        <select
                            id="user-role"
                            className={`form-select ${fieldErrors.role ? "is-invalid" : ""}`}
                            value={role}
                            onChange={(e) => setRole(e.target.value as UserRole)}
                            disabled={saving}
                        >
                            {Object.entries(ROLE_LABEL).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        {fieldErrors.role && <div className="invalid-feedback d-block">{fieldErrors.role}</div>}
                        {isSelf && (
                            <div className="form-text">Changing your own role removes your access to this screen.</div>
                        )}
                    </div>

                    {!target && (
                        <>
                            <div className="form-check form-switch mb-3">
                                <input
                                    id="user-active"
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    disabled={saving}
                                />
                                <label htmlFor="user-active" className="form-check-label">
                                    Active
                                </label>
                            </div>

                            <div className="mb-3">
                                <label htmlFor="user-initial-password" className="form-label small fw-semibold">
                                    Initial Password <span className="text-danger">*</span>
                                </label>
                                <input
                                    id="user-initial-password"
                                    type="password"
                                    autoComplete="new-password"
                                    className={`form-control ${fieldErrors.initialPassword ? "is-invalid" : ""}`}
                                    value={initialPassword}
                                    onChange={(e) => setInitialPassword(e.target.value)}
                                    disabled={saving}
                                />
                                {fieldErrors.initialPassword && (
                                    <div className="invalid-feedback d-block">{fieldErrors.initialPassword}</div>
                                )}
                                <div className="form-text">{PASSWORD_RULES} The user must change it at first login.</div>
                            </div>
                        </>
                    )}

                    <div className="d-grid gap-2">
                        <button type="submit" className="btn btn-success" disabled={saving}>
                            {saving ? "Saving…" : "Save User"}
                        </button>
                        <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                            Cancel
                        </button>
                    </div>
                </form>

                {target && (
                    <div className="mt-4 pt-3 border-top d-grid gap-3">
                        <div className="small text-muted">
                            Status: <ActiveBadge active={target.isActive} />
                        </div>

                        {resetOpen ? (
                            <div className="border rounded p-3">
                                <label htmlFor="user-new-password" className="form-label small fw-semibold">
                                    New initial password
                                </label>
                                <input
                                    id="user-new-password"
                                    type="password"
                                    autoComplete="new-password"
                                    className={`form-control ${fieldErrors.newPassword ? "is-invalid" : ""}`}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    disabled={saving}
                                />
                                {fieldErrors.newPassword && (
                                    <div className="invalid-feedback d-block">{fieldErrors.newPassword}</div>
                                )}
                                <div className="form-text mb-2">
                                    {PASSWORD_RULES} They are signed out now and must choose a new password at their next login.
                                </div>
                                <div className="d-flex gap-2">
                                    <button type="button" className="btn btn-success btn-sm" onClick={handleApplyReset} disabled={saving}>
                                        Apply New Password
                                    </button>
                                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={cancelReset} disabled={saving}>
                                        Cancel password reset
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button type="button" className="btn btn-outline-secondary" onClick={() => setResetOpen(true)} disabled={saving}>
                                Set New Password
                            </button>
                        )}

                        {target.isActive ? (
                            <div>
                                <button
                                    type="button"
                                    className="btn btn-outline-danger w-100"
                                    disabled={saving || isSelf}
                                    title={isSelf ? SELF_DEACTIVATION_LOCK : undefined}
                                    onClick={() => setConfirmDeactivate(true)}
                                >
                                    Deactivate User
                                </button>
                                {isSelf && <div className="form-text">{SELF_DEACTIVATION_LOCK}</div>}
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="btn btn-outline-success"
                                disabled={saving}
                                onClick={() => run(() => updateUser(target.id, { isActive: true }), "User reactivated.")}
                            >
                                Reactivate User
                            </button>
                        )}

                        {confirmDeactivate && (
                            <div className="alert alert-warning mb-0" role="alert">
                                <div className="mb-2">
                                    Deactivate {target.name}? They are signed out immediately and cannot log in until reactivated.
                                </div>
                                <div className="d-flex gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-danger btn-sm"
                                        disabled={saving}
                                        onClick={() => run(() => updateUser(target.id, { isActive: false }), "User deactivated.")}
                                    >
                                        Confirm Deactivation
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm"
                                        disabled={saving}
                                        onClick={() => setConfirmDeactivate(false)}
                                    >
                                        Go back
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function UserManagement() {
    const { user: me } = useAuth();
    const isMobile = useIsMobile();

    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [errorMessage, setErrorMessage] = useState("");
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<"" | UserRole>("");
    const [panel, setPanel] = useState<PanelState>(null);
    const [notice, setNotice] = useState("");

    const latestRequest = useRef(0);
    const hasFilters = search !== "" || roleFilter !== "";

    const load = useCallback(async () => {
        const requestId = ++latestRequest.current;
        setLoadState("loading");
        try {
            const data = await fetchUsers({ search: search || undefined, role: roleFilter || undefined });
            if (requestId !== latestRequest.current) return; // a newer request superseded this one
            setUsers(data);
            setLoadState("success");
        } catch (err) {
            if (requestId !== latestRequest.current) return;
            if (err instanceof ForbiddenError) {
                setLoadState("forbidden");
                return;
            }
            setErrorMessage(err instanceof UserApiError ? err.message : "Failed to load users.");
            setLoadState("error");
        }
    }, [search, roleFilter]);

    useEffect(() => {
        load();
    }, [load]);

    function openCreate() {
        setNotice("");
        setPanel({ mode: "create" });
    }

    function openEdit(user: AdminUser) {
        setNotice("");
        setPanel({ mode: "edit", user });
    }

    function handleDone(message: string) {
        setPanel(null);
        setNotice(message);
        load();
    }

    function clearFilters() {
        setSearch("");
        setRoleFilter("");
    }

    if (loadState === "forbidden") return <Forbidden />;

    return (
        <div className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h4 mb-1">User Management</h1>
                    <p className="text-muted small mb-0">Create accounts, assign one role, and activate or deactivate access.</p>
                </div>
                <button className="btn btn-success" onClick={openCreate}>
                    Create User
                </button>
            </div>

            {notice && (
                <div
                    role="status"
                    className="alert py-2"
                    style={{ backgroundColor: "#EAF6EF", border: "1px solid #0B7A46", color: "#0B7A46" }}
                >
                    {notice}
                </div>
            )}

            <div className="row g-4">
                <div className={panel ? "col-12 col-lg-8" : "col-12"}>
                    <div className="row g-2 mb-3">
                        <div className="col-12 col-md-8">
                            <label htmlFor="users-search" className="form-label small fw-semibold">
                                Search
                            </label>
                            <input
                                id="users-search"
                                type="text"
                                className="form-control"
                                placeholder="Search by name or email…"
                                value={search}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="col-12 col-md-4">
                            <label htmlFor="users-role-filter" className="form-label small fw-semibold">
                                Filter by Role
                            </label>
                            <select
                                id="users-role-filter"
                                className="form-select"
                                value={roleFilter}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) => setRoleFilter(e.target.value as "" | UserRole)}
                            >
                                <option value="">All Roles</option>
                                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {loadState === "loading" && <p>Loading users…</p>}

                    {loadState === "error" && (
                        <div className="alert alert-danger" role="alert">
                            <strong>Unable to load users</strong>
                            <p className="mb-0 mt-1">{errorMessage}</p>
                        </div>
                    )}

                    {loadState === "success" && users.length === 0 && !hasFilters && (
                        <div className="alert" style={{ backgroundColor: "#F5F7F6", border: "1px solid #E0E0E0" }}>
                            No users yet. Use Create User to add the first account.
                        </div>
                    )}

                    {loadState === "success" && users.length === 0 && hasFilters && (
                        <div className="alert alert-secondary">
                            <p className="mb-2">No users match your search or filters.</p>
                            <button className="btn btn-outline-secondary btn-sm" onClick={clearFilters}>
                                Clear Filters
                            </button>
                        </div>
                    )}

                    {loadState === "success" && users.length > 0 &&
                        (isMobile ? (
                            <ul className="list-group">
                                {users.map((u) => (
                                    <li key={u.id} className="list-group-item d-flex justify-content-between align-items-start gap-2">
                                        <div>
                                            <div className="fw-semibold">{u.name}</div>
                                            <div className="text-muted small">{u.email}</div>
                                            <div className="d-flex gap-2 mt-1">
                                                <RoleBadge value={u.role} />
                                                <ActiveBadge active={u.isActive} />
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-outline-secondary btn-sm"
                                            aria-label={`Edit ${u.name}`}
                                            onClick={() => openEdit(u)}
                                        >
                                            Edit
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="table-responsive">
                                <table className="table align-middle">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((u) => (
                                            <tr key={u.id}>
                                                <td>{u.name}</td>
                                                <td>{u.email}</td>
                                                <td>
                                                    <RoleBadge value={u.role} />
                                                </td>
                                                <td>
                                                    <ActiveBadge active={u.isActive} />
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-outline-secondary btn-sm"
                                                        aria-label={`Edit ${u.name}`}
                                                        onClick={() => openEdit(u)}
                                                    >
                                                        Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                </div>

                {panel && (
                    <div className="col-12 col-lg-4 order-first order-lg-last">
                        <UserPanel
                            key={panel.mode === "edit" ? `edit-${panel.user.id}` : "create"}
                            mode={panel.mode}
                            user={panel.mode === "edit" ? panel.user : undefined}
                            selfId={me?.id ?? -1}
                            onClose={() => setPanel(null)}
                            onDone={handleDone}
                            onForbidden={() => setLoadState("forbidden")}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}