import { useState } from "react";
import { AttachmentMeta } from "../api/tickets.js";
import { downloadStaffAttachment } from "../api/staff.js";

// Read-only for IT Staff: they can download active files but never add or remove any.
export default function StaffAttachmentList({ attachments }: { attachments: AttachmentMeta[] }) {
    const [error, setError] = useState("");

    async function handleDownload(attachment: AttachmentMeta) {
        setError("");
        try {
            const blob = await downloadStaffAttachment(attachment.id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = attachment.originalFileName;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to download attachment.");
        }
    }

    return (
        <div className="card mt-4">
            <div className="card-header fw-semibold">
                Attachments <span className="text-muted small">({attachments.filter((a) => !a.removedAt).length})</span>
            </div>
            <div className="card-body">
                {error && <div className="alert alert-danger py-2">{error}</div>}

                {attachments.length === 0 ? (
                    <p className="text-muted small mb-0">No attachments.</p>
                ) : (
                    <ul className="list-group">
                        {attachments.map((a) => {
                            const isRemoved = Boolean(a.removedAt);
                            return (
                                <li key={a.id} className="list-group-item d-flex justify-content-between align-items-start">
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
                                        <button className="btn btn-outline-secondary btn-sm" onClick={() => handleDownload(a)}>
                                            Download
                                        </button>
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