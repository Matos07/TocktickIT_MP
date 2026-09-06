import { Router, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { getPrisma } from "../prisma.js";
import { upload, UPLOAD_DIR, UnsupportedFileTypeError } from "../upload.js";

export const attachmentsRouter = Router();
export const ticketAttachmentsRouter = Router({ mergeParams: true });

const MAX_ACTIVE_ATTACHMENTS = 5;

async function resolveRequesterId(req: Request): Promise<number | null> {
    const prisma = getPrisma();
    const requesterId = Number(req.header("x-requester-id"));
    if (!Number.isInteger(requesterId) || requesterId <= 0) return null;

    const requester = await prisma.developmentRequester.findFirst({
        where: { id: requesterId, isActive: true },
        select: { id: true },
    });
    return requester ? requester.id : null;
}

function notFound(res: Response) {
    res.status(404).json({
        error: { code: "NOT_FOUND", message: "Resource not found." },
    });
}

// POST /api/tickets/:id/attachments
// AC-02, AC-05 (413), AC-06 (415), AC-07/BR-19 (409 quota), BR-21 (ownership).
ticketAttachmentsRouter.post(
    "/",
    (req: Request, res: Response, next: NextFunction) => {
        upload.single("file")(req, res, (err: unknown) => {
            if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
                res.status(413).json({
                    error: { code: "FILE_TOO_LARGE", message: "File exceeds the 5 MB size limit." },
                });
                return;
            }
            if (err instanceof UnsupportedFileTypeError) {
                res.status(415).json({
                    error: { code: "UNSUPPORTED_FILE_TYPE", message: "Unsupported file type. Use JPG, PNG, WEBP, or PDF." },
                });
                return;
            }
            if (err) {
                next(err);
                return;
            }
            next();
        });
    },
    async (req: Request, res: Response) => {
        const prisma = getPrisma();
        const ticketId = Number(req.params.id);

        try {
            const requesterId = await resolveRequesterId(req);
            if (!requesterId) return notFound(res);

            const ticket = await prisma.ticket.findFirst({
                where: { id: ticketId, requesterId },
                select: { id: true },
            });
            if (!ticket) {
                // Clean up the file multer already wrote to disk before rejecting.
                if (req.file) fs.unlink(req.file.path, () => { });
                return notFound(res);
            }

            if (!req.file) {
                res.status(400).json({
                    error: { code: "VALIDATION_ERROR", message: "No file was provided." },
                });
                return;
            }

            const activeCount = await prisma.attachment.count({
                where: { ticketId, removedAt: null },
            });
            if (activeCount >= MAX_ACTIVE_ATTACHMENTS) {
                fs.unlink(req.file.path, () => { });
                res.status(409).json({
                    error: { code: "ATTACHMENT_LIMIT_REACHED", message: "This ticket already has 5 active attachments." },
                });
                return;
            }

            const attachment = await prisma.attachment.create({
                data: {
                    ticketId,
                    originalFileName: req.file.originalname,
                    storedFileName: req.file.filename,
                    mimeType: req.file.mimetype,
                    sizeBytes: req.file.size,
                },
            });

            res.status(201).json({
                id: attachment.id,
                originalFileName: attachment.originalFileName,
                mimeType: attachment.mimeType,
                sizeBytes: attachment.sizeBytes,
                uploadedAt: attachment.uploadedAt,
                removedAt: attachment.removedAt,
            });
        } catch (err) {
            console.error("[POST /api/tickets/:id/attachments]", err);
            res.status(500).json({
                error: { code: "SERVER_ERROR", message: "Failed to upload attachment. Please try again." },
            });
        }
    }
);

// GET /api/attachments/:id/download
// AC-15, AC-17 (404 for removed — same shape as non-existent).
attachmentsRouter.get("/:id/download", async (req: Request, res: Response) => {
    const prisma = getPrisma();
    const attachmentId = Number(req.params.id);

    try {
        const requesterId = await resolveRequesterId(req);
        if (!requesterId) return notFound(res);

        const attachment = await prisma.attachment.findFirst({
            where: { id: attachmentId, removedAt: null, ticket: { requesterId } },
        });
        if (!attachment) return notFound(res); // covers not-found, not-owned, AND removed

        const filePath = path.join(UPLOAD_DIR, attachment.storedFileName);
        res.download(filePath, attachment.originalFileName, (err) => {
            if (err) {
                console.error("[GET /api/attachments/:id/download]", err);
                if (!res.headersSent) notFound(res);
            }
        });
    } catch (err) {
        console.error("[GET /api/attachments/:id/download]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to download attachment. Please try again." },
        });
    }
});

// GET /api/attachments/:id — metadata only.
attachmentsRouter.get("/:id", async (req: Request, res: Response) => {
    const prisma = getPrisma();
    const attachmentId = Number(req.params.id);

    try {
        const requesterId = await resolveRequesterId(req);
        if (!requesterId) return notFound(res);

        const attachment = await prisma.attachment.findFirst({
            where: { id: attachmentId, ticket: { requesterId } },
        });
        if (!attachment) return notFound(res);

        res.status(200).json({
            id: attachment.id,
            ticketId: attachment.ticketId,
            originalFileName: attachment.originalFileName,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            uploadedAt: attachment.uploadedAt,
            removedAt: attachment.removedAt,
            removedReason: attachment.removedReason,
        });
    } catch (err) {
        console.error("[GET /api/attachments/:id]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to retrieve attachment. Please try again." },
        });
    }
});

// DELETE /api/attachments/:id — soft removal.
// AC-16, BR-20, BR-21.
attachmentsRouter.delete("/:id", async (req: Request, res: Response) => {
    const prisma = getPrisma();
    const attachmentId = Number(req.params.id);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    try {
        const requesterId = await resolveRequesterId(req);
        if (!requesterId) return notFound(res);

        if (reason.length < 3 || reason.length > 200) {
            res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "Removal reason must be 3-200 characters." },
            });
            return;
        }

        const attachment = await prisma.attachment.findFirst({
            where: { id: attachmentId, ticket: { requesterId } },
        });
        if (!attachment) return notFound(res);

        if (attachment.removedAt) {
            res.status(409).json({
                error: { code: "ALREADY_REMOVED", message: "This attachment has already been removed." },
            });
            return;
        }

        const updated = await prisma.attachment.update({
            where: { id: attachmentId },
            data: { removedAt: new Date(), removedReason: reason },
        });

        res.status(200).json({
            id: updated.id,
            removedAt: updated.removedAt,
            removedReason: updated.removedReason,
        });
    } catch (err) {
        console.error("[DELETE /api/attachments/:id]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to remove attachment. Please try again." },
        });
    }
});