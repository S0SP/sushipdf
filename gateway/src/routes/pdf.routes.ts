import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import {
    uploadSingle,
    uploadMultiple,
    uploadRateLimiter,
    requireFile,
    requireFiles,
    requirePdf,
    requireBodyParams,
    requestTimeout,
    authMiddleware,
} from '../middleware';
import { stirlingService, storageService } from '../services';
import { logger } from '../utils/logger';

const router = Router();

// Apply auth (no-op Phase 1) and timeout to all PDF routes
router.use(authMiddleware);
router.use(requestTimeout);

// ────────────────────────────────────────────────────────
// POST /api/v1/pdf/merge
// ────────────────────────────────────────────────────────
router.post(
    '/merge',
    uploadRateLimiter,
    (req: Request, res: Response, next: NextFunction) => {
        uploadMultiple(req, res, (err: unknown) => {
            if (err) return next(err);
            next();
        });
    },
    requireFiles(2),
    async (req: Request, res: Response, next: NextFunction) => {
        const { jobId, jobDir } = await storageService.createJobDirectory();

        try {
            const files = req.files as Express.Multer.File[];
            logger.info(`[${jobId}] Merge request — ${files.length} files`);

            // Move uploaded files to job directory
            const inputPaths: string[] = [];
            for (const file of files) {
                const meta = await storageService.saveUploadedFile(file, jobDir, jobId);
                inputPaths.push(meta.storagePath);
            }

            const outputPath = await stirlingService.mergePdfs(inputPaths, jobDir);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="merged_${jobId}.pdf"`);
            res.setHeader('X-Job-Id', jobId);

            const stream = fs.createReadStream(outputPath);
            stream.pipe(res);
            stream.on('end', () => {
                void storageService.deleteJobDirectory(jobId);
            });
            stream.on('error', (err) => next(err));
        } catch (err) {
            void storageService.deleteJobDirectory(jobId);
            next(err);
        }
    },
);

// ────────────────────────────────────────────────────────
// POST /api/v1/pdf/split
// ────────────────────────────────────────────────────────
router.post(
    '/split',
    uploadRateLimiter,
    (req: Request, res: Response, next: NextFunction) => {
        uploadSingle(req, res, (err: unknown) => {
            if (err) return next(err);
            next();
        });
    },
    requirePdf,
    requireBodyParams('pages'),
    async (req: Request, res: Response, next: NextFunction) => {
        const { jobId, jobDir } = await storageService.createJobDirectory();

        try {
            const file = req.file!;
            const pages = req.body.pages as string;
            logger.info(`[${jobId}] Split request — pages=${pages}`);

            const meta = await storageService.saveUploadedFile(file, jobDir, jobId);
            const outputPath = await stirlingService.splitPdf(meta.storagePath, jobDir, pages);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="split_${jobId}.pdf"`);
            res.setHeader('X-Job-Id', jobId);

            const stream = fs.createReadStream(outputPath);
            stream.pipe(res);
            stream.on('end', () => {
                void storageService.deleteJobDirectory(jobId);
            });
            stream.on('error', (err) => next(err));
        } catch (err) {
            void storageService.deleteJobDirectory(jobId);
            next(err);
        }
    },
);

// ────────────────────────────────────────────────────────
// POST /api/v1/pdf/convert-to-pdf
// ────────────────────────────────────────────────────────
router.post(
    '/convert-to-pdf',
    uploadRateLimiter,
    (req: Request, res: Response, next: NextFunction) => {
        uploadSingle(req, res, (err: unknown) => {
            if (err) return next(err);
            next();
        });
    },
    requireFile,
    async (req: Request, res: Response, next: NextFunction) => {
        const { jobId, jobDir } = await storageService.createJobDirectory();

        try {
            const file = req.file!;
            logger.info(`[${jobId}] Convert-to-PDF request — ${file.originalname}`);

            const meta = await storageService.saveUploadedFile(file, jobDir, jobId);
            const outputPath = await stirlingService.convertToPdf(meta.storagePath, jobDir);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="converted_${jobId}.pdf"`,
            );
            res.setHeader('X-Job-Id', jobId);

            const stream = fs.createReadStream(outputPath);
            stream.pipe(res);
            stream.on('end', () => {
                void storageService.deleteJobDirectory(jobId);
            });
            stream.on('error', (err) => next(err));
        } catch (err) {
            void storageService.deleteJobDirectory(jobId);
            next(err);
        }
    },
);

// ────────────────────────────────────────────────────────
// POST /api/v1/pdf/pdf-to-image
// ────────────────────────────────────────────────────────
router.post(
    '/pdf-to-image',
    uploadRateLimiter,
    (req: Request, res: Response, next: NextFunction) => {
        uploadSingle(req, res, (err: unknown) => {
            if (err) return next(err);
            next();
        });
    },
    requirePdf,
    async (req: Request, res: Response, next: NextFunction) => {
        const { jobId, jobDir } = await storageService.createJobDirectory();

        try {
            const file = req.file!;
            const format = (req.body.format as string) || 'png';
            logger.info(`[${jobId}] PDF-to-image request — format=${format}`);

            const meta = await storageService.saveUploadedFile(file, jobDir, jobId);
            const outputPath = await stirlingService.pdfToImage(meta.storagePath, jobDir, format);

            // Stirling may return a zip for multi-page PDFs
            const ext = path.extname(outputPath).toLowerCase();
            const contentType =
                ext === '.zip' ? 'application/zip' : `image/${format}`;

            res.setHeader('Content-Type', contentType);
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="images_${jobId}${ext}"`,
            );
            res.setHeader('X-Job-Id', jobId);

            const stream = fs.createReadStream(outputPath);
            stream.pipe(res);
            stream.on('end', () => {
                void storageService.deleteJobDirectory(jobId);
            });
            stream.on('error', (err) => next(err));
        } catch (err) {
            void storageService.deleteJobDirectory(jobId);
            next(err);
        }
    },
);

export default router;
