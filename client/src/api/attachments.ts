import { AttachmentMeta } from "./tickets.js";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function uploadAttachment(
    requesterId: number,
    ticketId: number,
    file: File
): Promise<AttachmentMeta> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/api/tickets/${ticketId}/attachments`, {
        method: "POST",
        headers: { "x-requester-id": String(requesterId) },
        body: formData,
    });

    if (!res.ok) {
        let message = "Failed to upload attachment.";
        try {
            const body = await res.json();
            if (body?.error?.message) message = body.error.message;
        } catch {
            // ignore
        }
        throw new Error(message);
    }
    return res.json();
}

export async function downloadAttachment(
    requesterId: number,
    attachmentId: number
): Promise<Blob> {
    const res = await fetch(`${API_BASE}/api/attachments/${attachmentId}/download`, {
        headers: { "x-requester-id": String(requesterId) },
    });
    if (!res.ok) throw new Error(`Failed to download attachment (HTTP ${res.status})`);
    return res.blob();
}

export async function removeAttachment(
    requesterId: number,
    attachmentId: number,
    reason: string
): Promise<AttachmentMeta> {
    const res = await fetch(`${API_BASE}/api/attachments/${attachmentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-requester-id": String(requesterId) },
        body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
        let message = "Failed to remove attachment.";
        try {
            const body = await res.json();
            if (body?.error?.message) message = body.error.message;
        } catch {
            // ignore
        }
        throw new Error(message);
    }
    return res.json();
}