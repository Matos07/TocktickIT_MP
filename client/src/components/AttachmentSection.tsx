import { useState } from "react";
import { AttachmentMeta } from "../api/tickets.js";
import { uploadAttachment, downloadAttachment, removeAttachment } from "../api/attachments.js";

interface Props {
    requesterId: number;
    ticketId: number;
    attachments: AttachmentMeta[];
    onChange: () => void;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

export default function AttachmentSection({ requesterId, ticketId, attachments, onChange }: Props) {
    const [uploadError, setUploadError] = useState("");
    const [uploading, setUploading] = useState(false);
    const [pendingRemovalId, setPendingRemovalId] = useState<number | null>(null);
    const [reason, setReason] = useState("");
    const [actionError, setActionError] = useState("");

    const activeCount = attachments.filter((a) => !a.removedAt).length;

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        setUploadError("");

        if (activeCount >= MAX_ATTACHMENTS) {
            setUploadError(`Maximum ${MAX_ATTACHMENTS} attachments allowed.`);
            return;
        }
        if (file.size > MAX_SIZE_BYTES) {
            setUploadError("File exceeds the 5 MB size limit.");
            return;
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            setUploadError("Unsupported file type. Use JPG, PNG, WEBP, or PDF.");
            return;
        }

        setUploading(true);
        try {
            await uploadAttachment(requesterId, ticketId, file);
            onChange();
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : "Failed to upload attachment.");
        } finally {
            setUploading(false);
        }
    }

    async function handleDownload(attachment: AttachmentMeta) {
        setActionError("");
        try {
            const blob = await downloadAttachment(requesterId, attachment.id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = attachment.originalFileName;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setActionError(err instanceof Error ? err.message : "Failed to download attachment.");
        }
    }

    function startRemoval(attachmentId: number) {
        setPendingRemovalId(attachmentId);
        setReason("");
        setActionError("");
    }

    function cancelRemoval() {
        setPendingRemovalId(null);
        setReason("");
    }

    async function confirmRemoval() {
        if (pendingRemovalId === null) return;
        setActionError("");
        try {
            await removeAttachment(requesterId, pendingRemovalId, reason);
            setPendingRemovalId(null);
            setReason("");
            onChange();
        } catch (err) {
            setActionError(err instanceof Error ? err.message : "Failed to remove attachment.");
        }
    }

    return (
        <div className="card mt-4">
            <div className="card-header fw-semibold">
                Attachments <span className="text-muted small">({activeCount}/{MAX_ATTACHMENTS})</span>
            </div>
            <div className="card-body">
                <div className="mb-3">
                    <label htmlFor="attachment-upload" className="form-label small fw-semibold">
                        Add attachment
                    </label>
                    <input
                        id="attachment-upload"
                        type="file"
                        className="form-control"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        onChange={handleFileChange}
                        disabled={uploading || activeCount >= MAX_ATTACHMENTS}
                    />
                    {uploadError && <div className="text-danger small mt-1">{uploadError}</div>}
                </div>

                {actionError && <div className="alert alert-danger py-2">{actionError}</div>}

                {attachments.length === 0 ? (
                    <p className="text-muted small mb-0">No attachments yet.</p>
                ) : (
                    <ul className="list-group">
                        {attachments.map((a) => {
                            const isRemoved = Boolean(a.removedAt);
                            const isPending = pendingRemovalId === a.id;

                            return (
                                <li key={a.id} className="list-group-item">
                                    <div className="d-flex justify-content-between align-items-start">
                                        <div>
                                            <div className={isRemoved ? "text-decoration-line-through text-muted" : ""}>
                                                {a.originalFileName}
                                            </div>
                                            <div className="text-muted small">
                                                {(a.sizeBytes / 1024).toFixed(0)} KB · uploaded{" "}
                                                {new Date(a.uploadedAt).toLocaleDateString()}
                                            </div>
                                            {isRemoved && (
                                                <div className="mt-1">
                                                    <span className="badge bg-secondary">Removed</span>
                                                    <span className="text-muted small ms-2">{a.removedReason}</span>
                                                </div>
                                            )}
                                        </div>

                                        {!isRemoved && (
                                            <div className="d-flex gap-2">
                                                <button
                                                    className="btn btn-outline-secondary btn-sm"
                                                    onClick={() => handleDownload(a)}
                                                >
                                                    Download
                                                </button>
                                                <button
                                                    className="btn btn-outline-danger btn-sm"
                                                    onClick={() => startRemoval(a.id)}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {isPending && (
                                        <div className="mt-3 p-3" style={{ backgroundColor: "#F5F7F6" }}>
                                            <label htmlFor={`reason-${a.id}`} className="form-label small fw-semibold">
                                                Reason for removal <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                id={`reason-${a.id}`}
                                                type="text"
                                                className="form-control mb-2"
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                            />
                                            <div className="d-flex gap-2">
                                                <button
                                                    className="btn btn-outline-secondary btn-sm"
                                                    onClick={cancelRemoval}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    disabled={reason.trim().length < 3}
                                                    onClick={confirmRemoval}
                                                >
                                                    Confirm Removal
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}