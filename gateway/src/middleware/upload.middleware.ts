import multer from 'multer';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { config } from '../config';

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/tiff',
    'image/bmp',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',          // xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',  // pptx
    'application/msword',                                                          // doc
    'application/vnd.ms-excel',                                                    // xls
    'application/vnd.ms-powerpoint',                                               // ppt
    'text/plain',
    'text/html',
    'text/csv',
]);

const storage = multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        // Upload to OS temp dir; StorageService moves to job dir later
        cb(null, os.tmpdir());
    },
    filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        const ext = path.extname(file.originalname);
        const uniqueName = `${uuidv4()}${ext}`;
        cb(null, uniqueName);
    },
});

function fileFilter(
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
): void {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
}

/** Single file upload */
export const uploadSingle = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: config.storage.maxFileSizeMB * 1024 * 1024,
        files: 1,
    },
}).single('file');

/** Multiple file upload (for merge) */
export const uploadMultiple = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: config.storage.maxFileSizeMB * 1024 * 1024,
        files: 20,
    },
}).array('files', 20);
