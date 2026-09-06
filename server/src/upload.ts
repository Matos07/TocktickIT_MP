import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// BR-18: server-generated, collision-resistant stored filename — never the
// user-supplied original name — to prevent path traversal or overwrite.
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${randomUUID()}${ext}`);
    },
});

// BR-17: type validated by both extension and declared MIME type.
function fileFilter(
    _req: unknown,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = ALLOWED_MIME_TYPES.has(file.mimetype);
    const extOk = ALLOWED_EXTENSIONS.has(ext);

    if (!mimeOk || !extOk) {
        cb(new UnsupportedFileTypeError());
        return;
    }
    cb(null, true);
}

export class UnsupportedFileTypeError extends Error {
    constructor() {
        super("Unsupported file type.");
        this.name = "UnsupportedFileTypeError";
    }
}

export const upload = multer({
    storage,
    limits: { fileSize: MAX_SIZE_BYTES },
    fileFilter,
});

export { UPLOAD_DIR };