import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import {
    uploadSingle,
    uploadRateLimiter,
    requirePdf,
    requestTimeout,
    authMiddleware,
} from '../middleware';
import { CompressionServiceFactory, storageService } from '../services';
import { logger } from '../utils/logger';
import { ApiResponse, CompressionResult } from '../interfaces';

const router = Router();

router.use(authMiddleware);
router.use(requestTimeout);

// ────────────────────────────────────────────────────────
// POST /api/v1/pdf/compress
// ────────────────────────────────────────────────────────
// Phase 1: uses Stirling via CompressionServiceFactory
// Phase 2: factory can route to custom worker
// ────────────────────────────────────────────────────────
router.post(
    '/',
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
            const optimizeLevel = parseInt(req.body.optimizeLevel || '3', 10);
            const quality = req.body.quality as 'low' | 'medium' | 'high' | 'lossless' | undefined;

            logger.info(
                `[${jobId}] Compress request — file=${file.originalname} ` +
                `size=${(file.size / 1024 / 1024).toFixed(2)}MB level=${optimizeLevel}`,
            );

            const meta = await storageService.saveUploadedFile(file, jobDir, jobId);

            const compressionService = CompressionServiceFactory.create();
            const result: CompressionResult = await compressionService.compressDefault(
                meta.storagePath,
                { optimizeLevel, quality },
            );

            // Stream the compressed file back
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="compressed_${jobId}.pdf"`,
            );
            res.setHeader('X-Job-Id', jobId);
            res.setHeader('X-Original-Size', String(result.originalSize));
            res.setHeader('X-Compressed-Size', String(result.compressedSize));
            res.setHeader('X-Compression-Ratio', String(result.compressionRatio));
            res.setHeader('X-Compression-Engine', result.engine);

            const stream = fs.createReadStream(result.outputPath);
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
// POST /api/v1/pdf/compress/target-size   (Phase 2)
// ────────────────────────────────────────────────────────
router.post(
    '/target-size',
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
            const targetMB = parseFloat(req.body.targetMB);

            if (isNaN(targetMB) || targetMB <= 0) {
                res.status(400).json({
                    success: false,
                    error: 'targetMB must be a positive number',
                    timestamp: new Date().toISOString(),
                } as ApiResponse);
                return;
            }

            logger.info(
                `[${jobId}] CompressToTarget request — target=${targetMB}MB`,
            );

            const meta = await storageService.saveUploadedFile(file, jobDir, jobId);

            const compressionService = CompressionServiceFactory.create();
            const result = await compressionService.compressToTargetSize(
                meta.storagePath,
                targetMB,
            );

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="compressed_${jobId}.pdf"`,
            );
            res.setHeader('X-Job-Id', jobId);
            res.setHeader('X-Original-Size', String(result.originalSize));
            res.setHeader('X-Compressed-Size', String(result.compressedSize));
            res.setHeader('X-Compression-Ratio', String(result.compressionRatio));
            res.setHeader('X-Compression-Engine', result.engine);

            const stream = fs.createReadStream(result.outputPath);
            stream.pipe(res);
            stream.on('end', () => {
                void storageService.deleteJobDirectory(jobId);
            });
            stream.on('error', (err) => next(err));
        } catch (err) {
            void storageService.deleteJobDirectory(jobId);

            // If it's a "not implemented" error from Phase 1 stub, return 501
            if (err instanceof Error && err.message.includes('not available in Phase 1')) {
                res.status(501).json({
                    success: false,
                    error: err.message,
                    timestamp: new Date().toISOString(),
                } as ApiResponse);
                return;
            }

            next(err);
        }
    },
);

// ────────────────────────────────────────────────────────
// GET /api/v1/pdf/compress/engine
// ────────────────────────────────────────────────────────
router.get('/engine', (_req: Request, res: Response) => {
    const compressionService = CompressionServiceFactory.create();
    res.json({
        success: true,
        data: {
            engine: compressionService.getEngineName(),
            features: {
                compressDefault: true,
                compressToTargetSize: compressionService.getEngineName() !== 'stirling',
            },
        },
        timestamp: new Date().toISOString(),
    } as ApiResponse);
});

export default router;
