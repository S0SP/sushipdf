import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sanitize from 'sanitize-filename';
import { config } from '../config';
import { logger } from '../utils/logger';
import { FileMetadata } from '../interfaces';

/**
 * StorageService — manages temporary file storage with auto-cleanup.
 *
 * Phase 1: local filesystem (/tmp/pdf-tools-storage/<jobId>/)
 * Phase 2: can be swapped for S3-compatible storage via IStorageService interface.
 */
export class StorageService {
    private readonly basePath: string;

    constructor() {
        this.basePath = config.storage.basePath;
        this.ensureBaseDir();
    }

    /** Create a unique job directory and return its path + jobId */
    async createJobDirectory(): Promise<{ jobId: string; jobDir: string }> {
        const jobId = uuidv4();
        const jobDir = path.join(this.basePath, jobId);
        await fs.promises.mkdir(jobDir, { recursive: true });
        logger.debug(`Created job directory: ${jobDir}`);
        return { jobId, jobDir };
    }

    /** Sanitize a filename to prevent path traversal and special characters */
    sanitizeFilename(originalName: string): string {
        const sanitized = sanitize(originalName);
        if (!sanitized || sanitized.length === 0) {
            return `file_${Date.now()}`;
        }
        return sanitized;
    }

    /** Save an uploaded file into the job directory */
    async saveUploadedFile(
        file: Express.Multer.File,
        jobDir: string,
        jobId: string,
    ): Promise<FileMetadata> {
        const sanitizedName = this.sanitizeFilename(file.originalname);
        const destPath = path.join(jobDir, sanitizedName);

        // multer already saved the file to a temp path; move it
        if (file.path && file.path !== destPath) {
            await fs.promises.rename(file.path, destPath);
        }

        const expiresAt = new Date(Date.now() + config.storage.fileRetentionMinutes * 60_000);

        return {
            originalName: file.originalname,
            sanitizedName,
            mimeType: file.mimetype,
            size: file.size,
            storagePath: destPath,
            jobId,
            createdAt: new Date(),
            expiresAt,
        };
    }

    /** Remove an entire job directory */
    async deleteJobDirectory(jobId: string): Promise<void> {
        const jobDir = path.join(this.basePath, jobId);
        try {
            await fs.promises.rm(jobDir, { recursive: true, force: true });
            logger.debug(`Deleted job directory: ${jobDir}`);
        } catch (err) {
            logger.error(`Failed to delete job directory ${jobDir}: ${err}`);
        }
    }

    /** Clean up expired job directories */
    async cleanupExpiredJobs(): Promise<number> {
        let cleaned = 0;
        try {
            const entries = await fs.promises.readdir(this.basePath, { withFileTypes: true });
            const now = Date.now();
            const maxAge = config.storage.fileRetentionMinutes * 60_000;

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const dirPath = path.join(this.basePath, entry.name);
                try {
                    const stat = await fs.promises.stat(dirPath);
                    if (now - stat.mtimeMs > maxAge) {
                        await fs.promises.rm(dirPath, { recursive: true, force: true });
                        cleaned++;
                        logger.debug(`Cleaned up expired job: ${entry.name}`);
                    }
                } catch {
                    // Directory may have been already deleted
                }
            }

            if (cleaned > 0) {
                logger.info(`Cleanup: removed ${cleaned} expired job directories`);
            }
        } catch (err) {
            logger.error(`Cleanup sweep failed: ${err}`);
        }
        return cleaned;
    }

    private ensureBaseDir(): void {
        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath, { recursive: true });
            logger.info(`Created storage base directory: ${this.basePath}`);
        }
    }
}

export const storageService = new StorageService();
