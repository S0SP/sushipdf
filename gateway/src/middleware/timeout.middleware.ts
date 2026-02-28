import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Request timeout middleware.
 * Aborts the request if it exceeds the configured timeout.
 */
export function requestTimeout(req: Request, res: Response, next: NextFunction): void {
    const timeout = config.security.requestTimeoutMs;

    const timer = setTimeout(() => {
        if (!res.headersSent) {
            logger.warn(`Request timeout: ${req.method} ${req.originalUrl}`);
            res.status(408).json({
                success: false,
                error: 'Request timed out. The operation took too long.',
                timestamp: new Date().toISOString(),
            });
        }
    }, timeout);

    // Clear timeout when response finishes
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
}
