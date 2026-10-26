import { apiFetch, readErrorMessage } from "./http.js";
import { AttachmentMeta } from "./tickets.js";

export async function uploadAttachment(ticketId: number, file: File): Promise<AttachmentMeta> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await apiFetch(`/api/tickets/${ticketId}/attachments`, { method: "POST", body: formData });
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to upload attachment."));
    return res.json();
}

export async function downloadAttachment(attachmentId: number): Promise<Blob> {
    const res = await apiFetch(`/api/attachments/${attachmentId}/download`);
    if (!res.ok) throw new Error(`Failed to download attachment (HTTP ${res.status})`);
    return res.blob();
}

export async function removeAttachment(attachmentId: number, reason: string): Promise<AttachmentMeta> {
    const res = await apiFetch(`/api/attachments/${attachmentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to remove attachment."));
    return res.json();
}