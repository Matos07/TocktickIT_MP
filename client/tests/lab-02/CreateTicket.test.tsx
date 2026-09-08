import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CreateTicket from "../../src/pages/CreateTicket.js";
import { RequesterContext } from "../../src/context/RequesterContext.js";
import * as categoriesApi from "../../src/api/categories.js";
import * as relatedSystemsApi from "../../src/api/related-systems.js";
import * as ticketsApi from "../../src/api/tickets.js";
import * as attachmentsApi from "../../src/api/attachments.js";

const mockRequester = { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com" };

function renderWithContext() {
    return render(
        <MemoryRouter>
            <RequesterContext.Provider
                value={{ requester: mockRequester, setRequester: vi.fn(), clearRequester: vi.fn() }}
            >
                <CreateTicket />
            </RequesterContext.Provider>
        </MemoryRouter>
    );
}

describe("CreateTicket", () => {
    afterEach(() => vi.restoreAllMocks());

    it("AC-04: shows a field-level error and does not call the API when Summary is empty", async () => {
        vi.spyOn(categoriesApi, "fetchCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
        vi.spyOn(relatedSystemsApi, "fetchRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
        const createSpy = vi.spyOn(ticketsApi, "createTicket");

        renderWithContext();
        await waitFor(() => expect(screen.getByLabelText(/category/i)).toBeInTheDocument());

        fireEvent.click(screen.getByRole("button", { name: /submit/i }));

        await waitFor(() => {
            expect(screen.getByText(/summary is required/i)).toBeInTheDocument();
        });
        expect(createSpy).not.toHaveBeenCalled();
    });

    it("AC-01: submits valid data and shows the generated ticket number on success", async () => {
        vi.spyOn(categoriesApi, "fetchCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
        vi.spyOn(relatedSystemsApi, "fetchRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
        vi.spyOn(ticketsApi, "createTicket").mockResolvedValue({
            id: 42,
            ticketNumber: "TKT-2026-000042",
            requesterId: 1,
            categoryId: 1,
            relatedSystemId: 1,
            summary: "Laptop battery drains quickly",
            description: "Battery drains much faster than usual.",
            requestedPriority: "MEDIUM",
            itPriority: null,
            currentStatus: "NEW",
            createdAt: "2026-09-05T10:00:00.000Z",
            updatedAt: "2026-09-05T10:00:00.000Z",
        });

        renderWithContext();
        await waitFor(() => expect(screen.getByLabelText(/category/i)).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "1" } });
        fireEvent.change(screen.getByLabelText(/related system/i), { target: { value: "1" } });
        fireEvent.change(screen.getByLabelText(/summary/i), { target: { value: "Laptop battery drains quickly" } });
        fireEvent.change(screen.getByLabelText(/description/i), {
            target: { value: "Battery drains much faster than usual." },
        });
        fireEvent.change(screen.getByLabelText(/requested priority/i), { target: { value: "MEDIUM" } });

        fireEvent.click(screen.getByRole("button", { name: /submit/i }));

        await waitFor(() => {
            expect(screen.getByText(/TKT-2026-000042/)).toBeInTheDocument();
        });
    });

    it("BR-15: retains field values and shows an error banner when the API call fails", async () => {
        vi.spyOn(categoriesApi, "fetchCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
        vi.spyOn(relatedSystemsApi, "fetchRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
        vi.spyOn(ticketsApi, "createTicket").mockRejectedValue(new Error("Failed to create ticket (HTTP 500)"));

        renderWithContext();
        await waitFor(() => expect(screen.getByLabelText(/category/i)).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "1" } });
        fireEvent.change(screen.getByLabelText(/related system/i), { target: { value: "1" } });
        fireEvent.change(screen.getByLabelText(/summary/i), { target: { value: "Laptop battery drains quickly" } });
        fireEvent.change(screen.getByLabelText(/description/i), {
            target: { value: "Battery drains much faster than usual." },
        });
        fireEvent.change(screen.getByLabelText(/requested priority/i), { target: { value: "MEDIUM" } });

        fireEvent.click(screen.getByRole("button", { name: /submit/i }));

        await waitFor(() => {
            expect(screen.getByText(/failed to create ticket/i)).toBeInTheDocument();
        });
        expect(screen.getByLabelText(/summary/i)).toHaveValue("Laptop battery drains quickly");
    });
});

// Helper to build a File with a specific size, since jsdom doesn't size
// Blobs from just a name/type.
function makeFile(name: string, sizeBytes: number, type: string): File {
    return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("CreateTicket — attachment selection validation", () => {
    afterEach(() => vi.restoreAllMocks());

    async function renderReady() {
        vi.spyOn(categoriesApi, "fetchCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
        vi.spyOn(relatedSystemsApi, "fetchRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
        renderWithContext();
        await waitFor(() => expect(screen.getByLabelText(/category/i)).toBeInTheDocument());
    }

    it("AC-05: rejects a file over 5 MB with a clear message before upload", async () => {
        await renderReady();
        const bigFile = makeFile("big.png", 6 * 1024 * 1024, "image/png");

        fireEvent.change(screen.getByLabelText(/attachments/i), { target: { files: [bigFile] } });

        expect(await screen.findByText(/exceeds the 5 mb size limit/i)).toBeInTheDocument();
    });

    it("AC-06: rejects a disallowed file type with a clear message", async () => {
        await renderReady();
        const badFile = makeFile("script.exe", 1024, "application/x-msdownload");

        fireEvent.change(screen.getByLabelText(/attachments/i), { target: { files: [badFile] } });

        expect(await screen.findByText(/unsupported file type/i)).toBeInTheDocument();
    });

    it("AC-07: rejects a 6th attachment with a quota message", async () => {
        await renderReady();
        const input = screen.getByLabelText(/attachments/i);

        const fiveFiles = Array.from({ length: 5 }, (_, i) =>
            makeFile(`file${i}.png`, 1024, "image/png")
        );
        fireEvent.change(input, { target: { files: fiveFiles } });
        await screen.findByText("file4.png");

        const sixthFile = makeFile("file5.png", 1024, "image/png");
        fireEvent.change(input, { target: { files: [sixthFile] } });

        expect(await screen.findByText(/maximum 5 attachments allowed/i)).toBeInTheDocument();
    });
});

describe("CreateTicket — busy submission state", () => {
    afterEach(() => vi.restoreAllMocks());

    it("BR-14: disables Submit and shows a busy label while the request is in flight", async () => {
        vi.spyOn(categoriesApi, "fetchCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
        vi.spyOn(relatedSystemsApi, "fetchRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);

        let resolveCreate: (t: import("../../src/api/tickets.js").Ticket) => void;
        const pending = new Promise<import("../../src/api/tickets.js").Ticket>((resolve) => {
            resolveCreate = resolve;
        });
        vi.spyOn(ticketsApi, "createTicket").mockReturnValue(pending);

        renderWithContext();
        await waitFor(() => expect(screen.getByLabelText(/category/i)).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "1" } });
        fireEvent.change(screen.getByLabelText(/related system/i), { target: { value: "1" } });
        fireEvent.change(screen.getByLabelText(/summary/i), { target: { value: "Laptop battery drains quickly" } });
        fireEvent.change(screen.getByLabelText(/description/i), {
            target: { value: "Battery drains much faster than usual." },
        });
        fireEvent.change(screen.getByLabelText(/requested priority/i), { target: { value: "MEDIUM" } });

        fireEvent.click(screen.getByRole("button", { name: /submit/i }));

        expect(await screen.findByRole("button", { name: /submitting/i })).toBeDisabled();

        resolveCreate!({
            id: 1,
            ticketNumber: "TKT-2026-000001",
            requesterId: 1,
            categoryId: 1,
            relatedSystemId: 1,
            summary: "Laptop battery drains quickly",
            description: "Battery drains much faster than usual.",
            requestedPriority: "MEDIUM",
            itPriority: null,
            currentStatus: "NEW",
            createdAt: "2026-09-05T10:00:00.000Z",
            updatedAt: "2026-09-05T10:00:00.000Z",
        });

        await waitFor(() => expect(screen.getByText(/TKT-2026-000001/)).toBeInTheDocument());
    });
});

it("AC-02: uploads selected attachments after ticket creation succeeds", async () => {
    vi.spyOn(categoriesApi, "fetchCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(relatedSystemsApi, "fetchRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
    vi.spyOn(ticketsApi, "createTicket").mockResolvedValue({
        id: 42, ticketNumber: "TKT-2026-000042", requesterId: 1, categoryId: 1, relatedSystemId: 1,
        summary: "Laptop battery drains quickly", description: "Battery drains much faster than usual.",
        requestedPriority: "MEDIUM", itPriority: null, currentStatus: "NEW",
        createdAt: "2026-09-05T10:00:00.000Z", updatedAt: "2026-09-05T10:00:00.000Z",
    });
    const uploadSpy = vi.spyOn(attachmentsApi, "uploadAttachment").mockResolvedValue({
        id: 1, originalFileName: "photo.png", mimeType: "image/png", sizeBytes: 1024,
        uploadedAt: "2026-09-05T10:00:00.000Z", removedAt: null, removedReason: null,
    });

    renderWithContext();
    await waitFor(() => expect(screen.getByLabelText(/category/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/related system/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/summary/i), { target: { value: "Laptop battery drains quickly" } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Battery drains much faster than usual." } });
    fireEvent.change(screen.getByLabelText(/requested priority/i), { target: { value: "MEDIUM" } });

    const file = new File(["fake"], "photo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/attachments/i), { target: { files: [file] } });
    await screen.findByText("photo.png");

    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
        expect(uploadSpy).toHaveBeenCalledWith(1, 42, file);
    });
});