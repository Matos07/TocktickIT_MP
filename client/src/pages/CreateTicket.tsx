import { useEffect, useState, FormEvent } from "react";
import { useRequester } from "../context/RequesterContext.js";
import { fetchCategories, Category } from "../api/categories.js";
import { fetchRelatedSystems, RelatedSystem } from "../api/related-systems.js";
import { createTicket, CreateTicketError, Ticket, RequestedPriority } from "../api/tickets.js";
import { uploadAttachment } from "../api/attachments.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;


type ReferenceDataState = "loading" | "success" | "error";
type SubmitState = "idle" | "submitting" | "success" | "error";

interface PendingFile {
    file: File;
    error?: string;
}

export default function CreateTicket() {
    const { requester } = useRequester();

    const [refState, setRefState] = useState<ReferenceDataState>("loading");
    const [refError, setRefError] = useState("");
    const [categories, setCategories] = useState<Category[]>([]);
    const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

    const [categoryId, setCategoryId] = useState("");
    const [relatedSystemId, setRelatedSystemId] = useState("");
    const [summary, setSummary] = useState("");
    const [description, setDescription] = useState("");
    const [requestedPriority, setRequestedPriority] = useState<RequestedPriority | "">("");
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [submitState, setSubmitState] = useState<SubmitState>("idle");
    const [submitError, setSubmitError] = useState("");
    const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);
    const [uploadFailures, setUploadFailures] = useState<string[]>([]);

    useEffect(() => {
        let cancelled = false;
        Promise.all([fetchCategories(), fetchRelatedSystems()])
            .then(([cats, systems]) => {
                if (cancelled) return;
                setCategories(cats);
                setRelatedSystems(systems);
                setRefState("success");
            })
            .catch((err) => {
                if (cancelled) return;
                setRefError(err instanceof Error ? err.message : "Failed to load form data.");
                setRefState("error");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    function validate(): Record<string, string> {
        const errors: Record<string, string> = {};

        if (!categoryId) errors.categoryId = "Category is required.";
        if (!relatedSystemId) errors.relatedSystemId = "Related System is required.";

        const trimmedSummary = summary.trim();
        if (!trimmedSummary) {
            errors.summary = "Summary is required.";
        } else if (trimmedSummary.length < 5 || trimmedSummary.length > 120) {
            errors.summary = "Summary must be 5-120 characters.";
        }

        const trimmedDescription = description.trim();
        if (!trimmedDescription) {
            errors.description = "Description is required.";
        } else if (trimmedDescription.length < 10 || trimmedDescription.length > 2000) {
            errors.description = "Description must be 10-2000 characters.";
        }

        if (!requestedPriority) errors.requestedPriority = "Requested Priority is required.";

        return errors;
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        e.target.value = ""; // allow re-selecting the same file after removal

        const activeCount = pendingFiles.length;
        const next: PendingFile[] = [];

        for (const file of files) {
            if (activeCount + next.length >= MAX_ATTACHMENTS) {
                next.push({ file, error: `Maximum ${MAX_ATTACHMENTS} attachments allowed.` });
                continue;
            }
            if (file.size > MAX_SIZE_BYTES) {
                next.push({ file, error: "File exceeds the 5 MB size limit." });
                continue;
            }
            if (!ALLOWED_TYPES.includes(file.type)) {
                next.push({ file, error: "Unsupported file type. Use JPG, PNG, WEBP, or PDF." });
                continue;
            }
            next.push({ file });
        }

        setPendingFiles((prev) => [...prev, ...next]);
    }

    function removeFile(index: number) {
        setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const errors = validate();
        setFieldErrors(errors);

        if (Object.keys(errors).length > 0) return;
        if (!requester) return;

        setSubmitState("submitting");
        setSubmitError("");

        try {
            const ticket = await createTicket(requester.id, {
                categoryId: Number(categoryId),
                relatedSystemId: Number(relatedSystemId),
                summary: summary.trim(),
                description: description.trim(),
                requestedPriority: requestedPriority as RequestedPriority,
            });

            // BR-16: attachment upload is decoupled — the ticket is already saved
            // at this point regardless of what happens below.
            const failedUploads: string[] = [];
            for (const pf of pendingFiles) {
                if (pf.error) continue; // already-rejected files were never meant to upload
                try {
                    await uploadAttachment(requester.id, ticket.id, pf.file);
                } catch {
                    failedUploads.push(pf.file.name);
                }
            }

            setUploadFailures(failedUploads);
            setCreatedTicket(ticket);
            setSubmitState("success");
        } catch (err) {
            if (err instanceof CreateTicketError && err.fields) {
                setFieldErrors(err.fields);
            }
            setSubmitError(err instanceof Error ? err.message : "Failed to create ticket.");
            setSubmitState("error");
        }
    }

    function resetForm() {
        setCategoryId("");
        setRelatedSystemId("");
        setSummary("");
        setDescription("");
        setRequestedPriority("");
        setPendingFiles([]);
        setFieldErrors({});
        setSubmitError("");
        setCreatedTicket(null);
        setSubmitState("idle");
        setUploadFailures([])
    }

    if (refState === "loading") {
        return (
            <div className="container py-5" style={{ maxWidth: 640 }}>
                <p>Loading form…</p>
            </div>
        );
    }

    if (refState === "error") {
        return (
            <div className="container py-5" style={{ maxWidth: 640 }}>
                <div className="alert alert-danger">
                    <strong>Unable to load Create Ticket</strong>
                    <p className="mb-0 mt-1">{refError}</p>
                </div>
            </div>
        );
    }

    if (submitState === "success" && createdTicket) {
        return (
            <div className="container py-5" style={{ maxWidth: 640 }}>
                <div className="alert" style={{ backgroundColor: "#EAF6EF", border: "1px solid #0B7A46" }}>
                    <h2 className="h5 mb-2" style={{ color: "#0B7A46" }}>
                        Ticket created successfully
                    </h2>
                    {uploadFailures.length > 0 && (
                        <div className="alert alert-warning mt-2 mb-0">
                            <strong>Some attachments could not be uploaded:</strong> {uploadFailures.join(", ")}.
                            You can retry from the ticket's detail page.
                        </div>
                    )}
                    <p className="mb-1">
                        Ticket Number: <strong>{createdTicket.ticketNumber}</strong>
                    </p>
                    <p className="mb-3">
                        You can add attachments or view this ticket from My Tickets.
                    </p>
                    <button className="btn btn-success" onClick={resetForm}>
                        Create Another Ticket
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-5" style={{ maxWidth: 640 }}>
            <h1 className="h4 mb-4">Create Ticket</h1>

            {submitState === "error" && (
                <div className="alert alert-danger">
                    <strong>Something went wrong</strong>
                    <p className="mb-0 mt-1">{submitError}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <div className="mb-3">
                    <label htmlFor="category" className="form-label fw-semibold">
                        Category <span className="text-danger">*</span>
                    </label>
                    <select
                        id="category"
                        className={`form-select ${fieldErrors.categoryId ? "is-invalid" : ""}`}
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        disabled={submitState === "submitting"}
                    >
                        <option value="">Select a category…</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                    {fieldErrors.categoryId && <div className="invalid-feedback d-block">{fieldErrors.categoryId}</div>}
                </div>

                <div className="mb-3">
                    <label htmlFor="related-system" className="form-label fw-semibold">
                        Related System <span className="text-danger">*</span>
                    </label>
                    <select
                        id="related-system"
                        className={`form-select ${fieldErrors.relatedSystemId ? "is-invalid" : ""}`}
                        value={relatedSystemId}
                        onChange={(e) => setRelatedSystemId(e.target.value)}
                        disabled={submitState === "submitting"}
                    >
                        <option value="">Select a related system…</option>
                        {relatedSystems.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                    {fieldErrors.relatedSystemId && (
                        <div className="invalid-feedback d-block">{fieldErrors.relatedSystemId}</div>
                    )}
                </div>

                <div className="mb-3">
                    <label htmlFor="summary" className="form-label fw-semibold">
                        Summary <span className="text-danger">*</span>
                    </label>
                    <input
                        id="summary"
                        type="text"
                        className={`form-control ${fieldErrors.summary ? "is-invalid" : ""}`}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        disabled={submitState === "submitting"}
                    />
                    {fieldErrors.summary && <div className="invalid-feedback d-block">{fieldErrors.summary}</div>}
                </div>

                <div className="mb-3">
                    <label htmlFor="description" className="form-label fw-semibold">
                        Description <span className="text-danger">*</span>
                    </label>
                    <textarea
                        id="description"
                        className={`form-control ${fieldErrors.description ? "is-invalid" : ""}`}
                        rows={5}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={submitState === "submitting"}
                    />
                    {fieldErrors.description && <div className="invalid-feedback d-block">{fieldErrors.description}</div>}
                </div>

                <div className="mb-3">
                    <label htmlFor="requested-priority" className="form-label fw-semibold">
                        Requested Priority <span className="text-danger">*</span>
                    </label>
                    <select
                        id="requested-priority"
                        className={`form-select ${fieldErrors.requestedPriority ? "is-invalid" : ""}`}
                        value={requestedPriority}
                        onChange={(e) => setRequestedPriority(e.target.value as RequestedPriority)}
                        disabled={submitState === "submitting"}
                    >
                        <option value="">Select a priority…</option>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                    </select>
                    {fieldErrors.requestedPriority && (
                        <div className="invalid-feedback d-block">{fieldErrors.requestedPriority}</div>
                    )}
                </div>

                <div className="mb-4">
                    <label htmlFor="attachments" className="form-label fw-semibold">
                        Attachments
                    </label>
                    <input
                        id="attachments"
                        type="file"
                        className="form-control"
                        multiple
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        onChange={handleFileChange}
                        disabled={submitState === "submitting" || pendingFiles.length >= MAX_ATTACHMENTS}
                    />
                    <div className="form-text">
                        JPG, PNG, WEBP, or PDF — up to 5 MB each — {pendingFiles.length}/{MAX_ATTACHMENTS} attachments
                    </div>

                    {pendingFiles.length > 0 && (
                        <ul className="list-group mt-2">
                            {pendingFiles.map((pf, i) => (
                                <li key={i} className="list-group-item d-flex justify-content-between align-items-center">
                                    <div>
                                        <div>{pf.file.name}</div>
                                        {pf.error && <div className="text-danger small">{pf.error}</div>}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm"
                                        onClick={() => removeFile(i)}
                                    >
                                        Remove
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="form-text mt-1">
                        Attachments will be uploaded after the ticket is created.
                    </div>
                </div>

                <div className="d-flex justify-content-end">
                    <button type="submit" className="btn btn-success" disabled={submitState === "submitting"}>
                        {submitState === "submitting" ? "Submitting…" : "Submit"}
                    </button>
                </div>
            </form>
        </div>
    );
}