import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AttachmentSection from "../../src/components/AttachmentSection.js";
import * as attachmentsApi from "../../src/api/attachments.js";

const ticketId = 42;

const activeAttachment = {
    id: 1,
    originalFileName: "screenshot.png",
    mimeType: "image/png",
    sizeBytes: 2048,
    uploadedAt: "2026-09-01T00:00:00.000Z",
    removedAt: null,
    removedReason: null,
};

function renderSection(onChange = vi.fn()) {
    render(<AttachmentSection ticketId={ticketId} attachments={[activeAttachment]} onChange={onChange} />);
    return onChange;
}

describe("AttachmentSection", () => {
    afterEach(() => vi.restoreAllMocks());

    it("AC-16: soft-removes an attachment after confirmation with a reason, reflected immediately", async () => {
        vi.spyOn(attachmentsApi, "removeAttachment").mockResolvedValue({
            ...activeAttachment,
            removedAt: "2026-09-02T00:00:00.000Z",
            removedReason: "Wrong screenshot, replaced.",
        });
        const onChange = renderSection();

        fireEvent.click(screen.getByRole("button", { name: /remove/i }));
        fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "Wrong screenshot, replaced." } });
        fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

        await waitFor(() => {
            expect(attachmentsApi.removeAttachment).toHaveBeenCalledWith(activeAttachment.id, "Wrong screenshot, replaced.");
        });
        expect(onChange).toHaveBeenCalled();
    });

    it("does not call removeAttachment if the confirmation is cancelled", () => {
        const removeSpy = vi.spyOn(attachmentsApi, "removeAttachment");
        renderSection();

        fireEvent.click(screen.getByRole("button", { name: /remove/i }));
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

        expect(removeSpy).not.toHaveBeenCalled();
    });

    it("AC-15: clicking Download triggers the download API for an active attachment", async () => {
        vi.spyOn(attachmentsApi, "downloadAttachment").mockResolvedValue(new Blob(["fake"]));
        // jsdom doesn't implement these; stub them so the click-to-download flow doesn't throw.
        global.URL.createObjectURL = vi.fn(() => "blob:mock");
        global.URL.revokeObjectURL = vi.fn();
        renderSection();

        fireEvent.click(screen.getByRole("button", { name: /download/i }));

        await waitFor(() => {
            expect(attachmentsApi.downloadAttachment).toHaveBeenCalledWith(activeAttachment.id);
        });
    });
});